/**
 * 时间戳转换面板：一个输入框，双向识别时间戳与日期，展开多种视角。
 */
(function (global) {
  'use strict';

  var DRAFT_KEY = 'dev-toolkit.draft.timestamp.v1';
  var NOW_TICK = 250;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function init(panel) {
    function el(name) { return panel.querySelector('[data-ts="' + name + '"]'); }

    var input = el('input');
    var resultEl = el('result');
    var nowMsEl = el('now-ms');
    var nowSEl = el('now-s');
    var nowLocalEl = el('now-local');

    var draft = UI.createDraft(DRAFT_KEY);
    var copyValues = [];
    var tickTimer = null;

    draft.bind(function () {
      return { input: input.value, savedAt: Date.now() };
    });

    /* ---------------- 当前时间 ---------------- */

    function tickNow() {
      var now = Date.now();
      nowMsEl.textContent = String(now);
      nowSEl.textContent = String(Math.floor(now / 1000));
      nowLocalEl.textContent = TimestampTool.formatLocal(now);
    }

    function startTicking() {
      if (tickTimer) return;
      tickNow();
      tickTimer = setInterval(tickNow, NOW_TICK);
    }

    /* ---------------- 结果渲染 ---------------- */

    function renderRows(kind, rows) {
      copyValues = rows.map(function (row) { return row[1]; });

      var html = '<div class="ts-summary"><span class="ts-chip">' + escapeHtml(kind) + '</span>' +
        '<span>共 ' + rows.length + ' 个视角，可分别复制</span></div>' +
        '<div class="ts-grid">';
      rows.forEach(function (row, index) {
        html += '<div class="ts-row">' +
          '<span class="ts-row-label">' + escapeHtml(row[0]) + '</span>' +
          '<span class="ts-row-value">' + escapeHtml(row[1]) + '</span>' +
          '<button class="link-btn" type="button" data-copy-index="' + index + '">复制</button>' +
          '</div>';
      });
      html += '</div>';
      resultEl.innerHTML = html;
    }

    function renderEmpty(message) {
      copyValues = [];
      resultEl.innerHTML = '<div class="ts-empty">' + escapeHtml(message) + '</div>';
    }

    function renderError(message) {
      copyValues = [];
      resultEl.innerHTML = '<div class="ts-error">' + escapeHtml(message) + '</div>';
    }

    function convertNow() {
      var text = input.value.trim();
      if (!text) {
        renderEmpty('输入时间戳或日期，结果会在这里展开');
        return;
      }

      var result = TimestampTool.convert(text);
      if (!result.ok) {
        renderError(result.error.message);
        return;
      }

      var detail = result.detail;
      renderRows('识别为 ' + result.kind, [
        ['本地时间', detail.local + '（' + detail.gmt + '）'],
        ['UTC 时间', detail.utc + ' UTC'],
        ['ISO 8601', detail.iso],
        ['秒级时间戳', String(detail.seconds)],
        ['毫秒级时间戳', String(detail.milliseconds)],
        ['星期', detail.weekday],
        ['相对现在', detail.relative],
        ['本地时区', detail.zone ? detail.zone + '（' + detail.gmt + '）' : detail.gmt]
      ]);
    }

    /* ---------------- 事件 ---------------- */

    input.addEventListener('input', function () {
      convertNow();
      draft.save();
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        convertNow();
        draft.save();
      }
    });

    el('convert').addEventListener('click', function () {
      convertNow();
      draft.save();
    });

    el('fill-now').addEventListener('click', function () {
      input.value = String(Date.now());
      convertNow();
      input.focus();
      draft.save();
    });

    panel.querySelectorAll('[data-ts="copy-now"]').forEach(function (button) {
      button.addEventListener('click', function () {
        var src = button.getAttribute('data-src');
        var value = el(src).textContent;
        if (!value || value === '—') return;
        UI.copy(value).then(function () {
          UI.toast('已复制：' + value);
        }).catch(function () {
          UI.toast('复制失败，请手动选中复制');
        });
      });
    });

    resultEl.addEventListener('click', function (event) {
      var button = event.target.closest('[data-copy-index]');
      if (!button) return;
      var value = copyValues[Number(button.getAttribute('data-copy-index'))];
      if (!value) return;
      UI.copy(value).then(function () {
        UI.toast('已复制到剪贴板');
      }).catch(function () {
        UI.toast('复制失败，请手动选中复制');
      });
    });

    startTicking();
    renderEmpty('输入时间戳或日期，结果会在这里展开');

    draft.load().then(function (saved) {
      if (!saved || !saved.input) return;
      input.value = saved.input;
      convertNow();
    });

    return {
      onShow: function () {
        tickNow();
        if (input.value) convertNow();
      }
    };
  }

  global.TimestampPanel = { init: init };
})(window);
