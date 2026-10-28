/**
 * 编码转换面板：Base64 / URL / Unicode，编码与解码共用一套输入输出。
 */
(function (global) {
  'use strict';

  var DRAFT_KEY = 'dev-toolkit.draft.codec.v1';

  var HINTS = {
    base64: {
      encode: 'Base64 编码：按 UTF-8 把文本转成 Base64',
      decode: 'Base64 解码：兼容 URL-safe 与缺省 padding，按 UTF-8 还原'
    },
    url: {
      encode: 'URL 编码：等价于 encodeURIComponent，适合拼进 query 或 path',
      decode: 'URL 解码：还原 %XX 序列，不会把 + 当成空格'
    },
    unicode: {
      encode: 'Unicode 转义：非 ASCII 转成 \\uXXXX，ASCII 保持原样',
      decode: 'Unicode 还原：支持 \\uXXXX 与 \\u{1F600} 两种写法'
    }
  };

  function init(panel) {
    function el(name) { return panel.querySelector('[data-codec="' + name + '"]'); }

    var input = el('input');
    var output = el('output');
    var hint = el('hint');
    var inputStat = el('input-stat');
    var outputStat = el('output-stat');
    var status = el('status');
    var outputStatus = el('output-status');

    var type = 'base64';
    var direction = 'encode';
    var draft = UI.createDraft(DRAFT_KEY);

    draft.bind(function () {
      return { input: input.value, type: type, direction: direction, savedAt: Date.now() };
    });

    function updateStats() {
      inputStat.textContent = input.value ? UI.formatStat(input.value) : '0 字符';
      outputStat.textContent = output.value ? UI.formatStat(output.value) : '等待处理';
    }

    function setStatus(message) {
      status.textContent = message || '';
      status.className = message ? 'status is-error' : 'status';
    }

    function setOutputStatus(message, isError) {
      outputStatus.textContent = message || '';
      outputStatus.className = message ? 'status' + (isError ? ' is-error' : '') : 'status';
    }

    function applyState() {
      panel.querySelectorAll('[data-codec="types"] [data-type]').forEach(function (node) {
        node.classList.toggle('is-active', node.getAttribute('data-type') === type);
      });
      panel.querySelectorAll('[data-codec="directions"] [data-direction]').forEach(function (node) {
        node.classList.toggle('is-active', node.getAttribute('data-direction') === direction);
      });
      hint.textContent = HINTS[type][direction];
    }

    function convertNow() {
      var text = input.value;
      if (!text) {
        output.value = '';
        setStatus('');
        setOutputStatus('');
        updateStats();
        return;
      }

      var result = CodecTool.convert(type, direction, text);
      if (!result.ok) {
        output.value = '';
        setStatus(result.error.message);
        setOutputStatus('处理失败', true);
        updateStats();
        return;
      }

      output.value = result.value;
      setStatus('');
      setOutputStatus('已完成');
      updateStats();
    }

    panel.querySelectorAll('[data-codec="types"] [data-type]').forEach(function (node) {
      node.addEventListener('click', function () {
        type = node.getAttribute('data-type');
        applyState();
        convertNow();
        draft.save();
      });
    });

    panel.querySelectorAll('[data-codec="directions"] [data-direction]').forEach(function (node) {
      node.addEventListener('click', function () {
        direction = node.getAttribute('data-direction');
        applyState();
        convertNow();
        draft.save();
      });
    });

    input.addEventListener('input', function () {
      convertNow();
      draft.save();
    });

    el('clear').addEventListener('click', function () {
      input.value = '';
      output.value = '';
      setStatus('');
      setOutputStatus('');
      updateStats();
      input.focus();
      draft.save();
    });

    el('copy').addEventListener('click', function () {
      if (!output.value) {
        UI.toast('还没有可复制的内容');
        return;
      }
      UI.copy(output.value).then(function () {
        UI.toast('已复制到剪贴板');
      }).catch(function () {
        UI.toast('复制失败，请手动选中复制');
      });
    });

    el('use-as-input').addEventListener('click', function () {
      if (!output.value) {
        UI.toast('还没有可回填的内容');
        return;
      }
      input.value = output.value;
      convertNow();
      input.focus();
      draft.save();
    });

    applyState();
    updateStats();

    draft.load().then(function (saved) {
      if (!saved) return;
      if (saved.type && HINTS[saved.type]) type = saved.type;
      if (saved.direction === 'decode') direction = 'decode';
      if (saved.input) input.value = saved.input;
      applyState();
      convertNow();
    });

    return {
      onShow: function () { updateStats(); }
    };
  }

  global.CodecPanel = { init: init };
})(window);
