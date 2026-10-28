/**
 * 页面交互层：左侧 TAB 切换、编辑器渲染、三个 JSON 动作、草稿与复制。
 * 不依赖任何框架，也不发起网络请求。
 */
(function () {
  'use strict';

  var MAX_HIGHLIGHT_LENGTH = 200000;
  // 每个工具用自己的草稿键，后续加工具沿用 dev-toolkit.draft.<tool>.v1
  var DRAFT_KEY = 'dev-toolkit.draft.json.v1';

  var ACTION_HINTS = {
    format: '格式化：把 JSON 整理成 2 空格缩进的多行结构',
    minify: '压缩转义：压成一行并转成带引号的转义字符串，可直接贴进代码',
    unescape: '去除转义：还原 \\" 与 \\n 等转义，还原成可读 JSON'
  };

  var ACTIONS = {
    format: function (text) { return JsonTool.format(text); },
    minify: function (text) { return JsonTool.minifyEscape(text); },
    unescape: function (text) { return JsonTool.unescape(text); }
  };

  /* ---------------- 本地存储（扩展环境用 chrome.storage，直开 index.html 时降级 localStorage） ---------------- */

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function storageGet(key) {
    return new Promise(function (resolve) {
      if (hasChromeStorage()) {
        chrome.storage.local.get([key], function (result) {
          resolve(result ? result[key] : undefined);
        });
        return;
      }
      try {
        var raw = window.localStorage.getItem(key);
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch (err) {
        resolve(undefined);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise(function (resolve) {
      if (hasChromeStorage()) {
        chrome.storage.local.set(makeMap(key, value), resolve);
        return;
      }
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        // 存储不可用时静默忽略，草稿只是加分项
      }
      resolve();
    });
  }

  function makeMap(key, value) {
    var map = {};
    map[key] = value;
    return map;
  }

  /* ---------------- 编辑器：行号 + 语法高亮层 + 透明 textarea ---------------- */

  function createEditor(pane, textarea) {
    var highlightEl = pane.querySelector('.highlight');
    var codeEl = pane.querySelector('.highlight code');
    var gutterInner = pane.querySelector('.gutter-inner');
    var errorLine = 0;
    var frame = 0;
    var inputListener = null;

    function renderGutter() {
      var total = textarea.value ? textarea.value.split('\n').length : 1;
      var html = '';
      for (var i = 1; i <= total; i += 1) {
        html += '<span class="ln' + (i === errorLine ? ' is-error' : '') + '">' + i + '</span>';
      }
      gutterInner.innerHTML = html;
    }

    function renderHighlight() {
      var value = textarea.value;
      if (value.length > MAX_HIGHLIGHT_LENGTH) {
        // 超大文本放弃着色，保证输入时不卡顿
        codeEl.textContent = value;
        return;
      }
      codeEl.innerHTML = JsonTool.highlight(value) + '\n';
    }

    function syncScroll() {
      highlightEl.style.transform =
        'translate(' + (-textarea.scrollLeft) + 'px,' + (-textarea.scrollTop) + 'px)';
      gutterInner.style.transform = 'translateY(' + (-textarea.scrollTop) + 'px)';
    }

    function refresh() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        renderGutter();
        renderHighlight();
        syncScroll();
      });
    }

    textarea.addEventListener('input', function () {
      refresh();
      if (inputListener) inputListener(textarea.value);
    });
    textarea.addEventListener('scroll', syncScroll);

    var editor = {
      value: function () { return textarea.value; },
      setValue: function (text) {
        textarea.value = text == null ? '' : String(text);
        refresh();
      },
      setErrorLine: function (line) {
        errorLine = line > 0 ? line : 0;
        pane.classList.toggle('has-error', errorLine > 0);
        refresh();
      },
      onInput: function (listener) { inputListener = listener; },
      focus: function () { textarea.focus(); },
      gotoPosition: function (position) {
        if (position < 0) return;
        textarea.focus();
        textarea.setSelectionRange(position, Math.min(position + 1, textarea.value.length));
        refresh();
      },
      scrollToTop: function () {
        textarea.scrollTop = 0;
        textarea.scrollLeft = 0;
        syncScroll();
      },
      refresh: refresh
    };

    refresh();
    return editor;
  }

  /* ---------------- 页面元素 ---------------- */

  var nav = document.getElementById('nav');
  var actionHint = document.getElementById('action-hint');
  var inputStat = document.getElementById('input-stat');
  var inputStatus = document.getElementById('input-status');
  var outputStat = document.getElementById('output-stat');
  var outputStatus = document.getElementById('output-status');
  var toastEl = document.getElementById('toast');

  var inputEditor = createEditor(document.getElementById('pane-input'), document.getElementById('input'));
  var outputEditor = createEditor(document.getElementById('pane-output'), document.getElementById('output'));

  var currentAction = 'format';
  var saveTimer = null;
  var toastTimer = null;

  /* ---------------- 小工具 ---------------- */

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 1800);
  }

  function updateInputStat() {
    var value = inputEditor.value();
    inputStat.textContent = value.length + ' 字符 · ' + (value ? value.split('\n').length : 0) + ' 行';
  }

  function updateOutputStat(value) {
    if (!value) {
      outputStat.textContent = '等待处理';
      return;
    }
    outputStat.textContent = value.length + ' 字符 · ' + value.split('\n').length + ' 行';
  }

  function setInputError(error) {
    if (!error) {
      inputStatus.textContent = '';
      inputStatus.className = 'status';
      inputStatus.onclick = null;
      inputStatus.removeAttribute('title');
      return;
    }

    var located = error.line > 0;
    inputStatus.textContent = located
      ? '第 ' + error.line + ' 行第 ' + error.column + ' 列 · ' + error.message
      : error.message;
    inputStatus.className = 'status is-error';

    var tips = [];
    if (error.detail && error.detail !== error.message) tips.push('原文：' + error.detail);
    if (located && error.position >= 0) tips.push('点击定位到错误位置');
    inputStatus.title = tips.join(' · ');

    if (located && error.position >= 0) {
      inputStatus.onclick = function () { inputEditor.gotoPosition(error.position); };
    } else {
      inputStatus.onclick = null;
    }
  }

  function setOutputNote(text, isError) {
    outputStatus.textContent = text || '';
    outputStatus.className = text ? 'status' + (isError ? ' is-error' : '') : 'status';
  }

  /* ---------------- 草稿 ---------------- */

  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      storageSet(DRAFT_KEY, {
        input: inputEditor.value(),
        output: outputEditor.value(),
        action: currentAction,
        savedAt: Date.now()
      });
    }, 400);
  }

  function restoreDraft() {
    storageGet(DRAFT_KEY).then(function (draft) {
      if (!draft) return;
      if (draft.input) inputEditor.setValue(draft.input);
      if (draft.output) outputEditor.setValue(draft.output);
      if (draft.action && ACTIONS[draft.action]) selectAction(draft.action, true);
      updateInputStat();
      updateOutputStat(outputEditor.value());
      if (draft.input) showToast('已恢复上次编辑的内容');
    });
  }

  /* ---------------- 三个核心动作 ---------------- */

  function selectAction(action, silent) {
    currentAction = action;
    actionHint.textContent = ACTION_HINTS[action];
    if (!silent) saveDraft();
  }

  function run(action) {
    selectAction(action, true);
    var result = ACTIONS[action](inputEditor.value());

    if (!result.ok) {
      inputEditor.setErrorLine(result.error.line || 1);
      setInputError(result.error);
      outputEditor.setValue('');
      updateOutputStat('');
      setOutputNote('处理失败，请先修正输入', true);
      return;
    }

    inputEditor.setErrorLine(0);
    setInputError(null);
    outputEditor.setValue(result.value);
    outputEditor.scrollToTop();
    updateOutputStat(result.value);
    setOutputNote(result.detail ? '已完成 · ' + result.detail : '已完成', false);
    saveDraft();
  }

  /* ---------------- 复制 ---------------- */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.top = '-9999px';
      document.body.appendChild(helper);
      helper.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(helper);
      if (ok) resolve();
      else reject(new Error('copy failed'));
    });
  }

  /* ---------------- 事件绑定 ---------------- */

  document.querySelectorAll('[data-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      run(button.getAttribute('data-action'));
    });
  });

  document.getElementById('btn-clear').addEventListener('click', function () {
    inputEditor.setValue('');
    outputEditor.setValue('');
    inputEditor.setErrorLine(0);
    setInputError(null);
    setOutputNote('');
    updateInputStat();
    updateOutputStat('');
    inputEditor.focus();
    saveDraft();
  });

  document.getElementById('btn-copy').addEventListener('click', function () {
    var value = outputEditor.value();
    if (!value) {
      showToast('还没有可复制的内容');
      return;
    }
    copyText(value).then(function () {
      showToast('已复制到剪贴板');
    }).catch(function () {
      showToast('复制失败，请手动选中复制');
    });
  });

  document.getElementById('btn-use-as-input').addEventListener('click', function () {
    var value = outputEditor.value();
    if (!value) {
      showToast('还没有可回填的内容');
      return;
    }
    inputEditor.setValue(value);
    inputEditor.setErrorLine(0);
    setInputError(null);
    updateInputStat();
    inputEditor.focus();
    saveDraft();
  });

  inputEditor.onInput(function () {
    updateInputStat();
    if (inputStatus.classList.contains('is-error')) {
      inputEditor.setErrorLine(0);
      setInputError(null);
    }
    saveDraft();
  });

  // 左侧 TAB：按 data-tool 与 data-panel 对应切换，后续加工具只需改 HTML
  nav.addEventListener('click', function (event) {
    var item = event.target.closest('.nav-item');
    if (!item || item.classList.contains('is-disabled')) return;
    var tool = item.getAttribute('data-tool');
    if (!tool) return;

    nav.querySelectorAll('.nav-item').forEach(function (node) {
      node.classList.toggle('is-active', node === item);
    });
    document.querySelectorAll('.panel').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-panel') !== tool;
    });
  });

  /* ---------------- 启动 ---------------- */

  updateInputStat();
  restoreDraft();
})();
