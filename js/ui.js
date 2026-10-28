/**
 * 通用 UI 能力：本地存储、Toast、复制、编辑器、草稿。
 * 各工具面板只依赖这里，不直接碰 chrome.storage 或 DOM 细节。
 */
(function (global) {
  'use strict';

  var toastEl = document.getElementById('toast');
  var toastTimer = null;

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
        var map = {};
        map[key] = value;
        chrome.storage.local.set(map, resolve);
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

  /* ---------------- Toast ---------------- */

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 1800);
  }

  /* ---------------- 复制 ---------------- */

  function copy(text) {
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

  /* ---------------- 编辑器：行号 + 高亮层 + 透明 textarea ---------------- */

  function createEditor(pane, options) {
    var opts = options || {};
    var highlight = typeof opts.highlight === 'function' ? opts.highlight : null;
    var showGutter = opts.gutter !== false;
    var maxHighlight = opts.maxHighlight || 200000;

    var textarea = pane.querySelector('textarea');
    var highlightEl = pane.querySelector('.highlight');
    var codeEl = pane.querySelector('.highlight code');
    var gutterInner = pane.querySelector('.gutter-inner');
    var errorLine = 0;
    var frame = 0;
    var inputListener = null;

    function renderGutter() {
      if (!showGutter || !gutterInner) return;
      var total = textarea.value ? textarea.value.split('\n').length : 1;
      var html = '';
      for (var i = 1; i <= total; i += 1) {
        html += '<span class="ln' + (i === errorLine ? ' is-error' : '') + '">' + i + '</span>';
      }
      gutterInner.innerHTML = html;
    }

    function renderHighlight() {
      if (!highlightEl || !codeEl) return;
      var value = textarea.value;
      if (!highlight || value.length > maxHighlight) {
        codeEl.textContent = value;
      } else {
        codeEl.innerHTML = highlight(value) + '\n';
      }
    }

    function syncScroll() {
      if (highlightEl) {
        highlightEl.style.transform =
          'translate(' + (-textarea.scrollLeft) + 'px,' + (-textarea.scrollTop) + 'px)';
      }
      if (gutterInner) {
        gutterInner.style.transform = 'translateY(' + (-textarea.scrollTop) + 'px)';
      }
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

    refresh();

    return {
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
  }

  /* ---------------- 草稿：防抖写本地，按工具分 key ---------------- */

  function createDraft(key) {
    var timer = null;
    var collector = null;

    return {
      bind: function (fn) { collector = fn; },
      load: function () { return storageGet(key); },
      save: function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (collector) storageSet(key, collector());
        }, 400);
      }
    };
  }

  /* ---------------- 文本统计 ---------------- */

  function formatStat(value) {
    var text = value || '';
    var lines = text ? text.split('\n').length : 0;
    return text.length + ' 字符 · ' + lines + ' 行';
  }

  global.UI = {
    storageGet: storageGet,
    storageSet: storageSet,
    toast: toast,
    copy: copy,
    createEditor: createEditor,
    createDraft: createDraft,
    formatStat: formatStat
  };
})(window);
