/**
 * JSON 处理面板：把 JsonTool 的纯函数接到界面上。
 */
(function (global) {
  'use strict';

  var DRAFT_KEY = 'dev-toolkit.draft.json.v1';

  var HINTS = {
    format: '格式化：把 JSON 整理成 2 空格缩进的多行结构',
    minify: '压缩转义：压成一行并转成带引号的转义字符串，可直接贴进代码',
    unescape: '去除转义：还原 \\" 与 \\n 等转义，还原成可读 JSON'
  };

  var ACTIONS = {
    format: function (text) { return JsonTool.format(text); },
    minify: function (text) { return JsonTool.minifyEscape(text); },
    unescape: function (text) { return JsonTool.unescape(text); }
  };

  function init(panel) {
    function el(name) { return panel.querySelector('[data-json="' + name + '"]'); }

    var hint = el('hint');
    var wrapToggle = el('wrap');
    var inputStat = el('input-stat');
    var inputStatus = el('input-status');
    var outputStat = el('output-stat');
    var outputStatus = el('output-status');

    var inputEditor = UI.createEditor(el('pane-input'), { highlight: JsonTool.highlight });
    var outputEditor = UI.createEditor(el('pane-output'), { highlight: JsonTool.highlight });

    var currentAction = 'format';
    var draft = UI.createDraft(DRAFT_KEY);

    // 自动换行：两侧编辑器一起切，行号也会跟着折行变高
    function applyWrap(on) {
      inputEditor.setWrap(on);
      outputEditor.setWrap(on);
    }

    draft.bind(function () {
      return {
        input: inputEditor.value(),
        output: outputEditor.value(),
        action: currentAction,
        wrap: wrapToggle.checked,
        savedAt: Date.now()
      };
    });

    function updateInputStat() {
      inputStat.textContent = UI.formatStat(inputEditor.value());
    }

    function updateOutputStat(value) {
      outputStat.textContent = value ? UI.formatStat(value) : '等待处理';
    }

    function setInputError(error) {
      if (!error) {
        inputStatus.textContent = '';
        inputStatus.className = 'status';
        inputStatus.title = '';
        inputStatus.onclick = null;
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
      inputStatus.onclick = located && error.position >= 0
        ? function () { inputEditor.gotoPosition(error.position); }
        : null;
    }

    function setOutputNote(text, isError) {
      outputStatus.textContent = text || '';
      outputStatus.className = text ? 'status' + (isError ? ' is-error' : '') : 'status';
    }

    function selectAction(action) {
      currentAction = action;
      hint.textContent = HINTS[action];
    }

    function run(action) {
      selectAction(action);
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
      draft.save();
    }

    panel.querySelectorAll('[data-json-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        run(button.getAttribute('data-json-action'));
      });
    });

    el('clear').addEventListener('click', function () {
      inputEditor.setValue('');
      outputEditor.setValue('');
      inputEditor.setErrorLine(0);
      setInputError(null);
      setOutputNote('');
      updateInputStat();
      updateOutputStat('');
      inputEditor.focus();
      draft.save();
    });

    el('copy').addEventListener('click', function () {
      var value = outputEditor.value();
      if (!value) {
        UI.toast('还没有可复制的内容');
        return;
      }
      UI.copy(value).then(function () {
        UI.toast('已复制到剪贴板');
      }).catch(function () {
        UI.toast('复制失败，请手动选中复制');
      });
    });

    el('use-as-input').addEventListener('click', function () {
      var value = outputEditor.value();
      if (!value) {
        UI.toast('还没有可回填的内容');
        return;
      }
      inputEditor.setValue(value);
      inputEditor.setErrorLine(0);
      setInputError(null);
      updateInputStat();
      inputEditor.focus();
      draft.save();
    });

    inputEditor.onInput(function () {
      updateInputStat();
      if (inputStatus.classList.contains('is-error')) {
        inputEditor.setErrorLine(0);
        setInputError(null);
      }
      draft.save();
    });

    wrapToggle.addEventListener('change', function () {
      applyWrap(wrapToggle.checked);
      draft.save();
    });

    updateInputStat();
    applyWrap(wrapToggle.checked);

    draft.load().then(function (saved) {
      if (!saved) return;
      if (saved.input) inputEditor.setValue(saved.input);
      if (saved.output) outputEditor.setValue(saved.output);
      if (saved.action && ACTIONS[saved.action]) selectAction(saved.action);
      if (typeof saved.wrap === 'boolean') {
        wrapToggle.checked = saved.wrap;
        applyWrap(saved.wrap);
      }
      updateInputStat();
      updateOutputStat(outputEditor.value());
    });

    function realign() {
      // 面板尺寸变化时重新对齐高亮层、行号与横向滚动位置
      inputEditor.refresh();
      outputEditor.refresh();
    }

    return { onShow: realign, onResize: realign };
  }

  global.JsonPanel = { init: init };
})(window);
