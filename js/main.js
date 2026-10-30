/**
 * 页面骨架：注册工具、切换 TAB、维护顶部标题，以及侧栏折叠、双栏宽度这类全局布局。
 * 具体功能都在 js/tools/<tool>-panel.js 里，新增工具只改这里的 TOOLS 表。
 */
(function () {
  'use strict';

  var TOOLS = {
    json: {
      title: 'JSON 处理工具',
      desc: '一次粘贴，三种处理：格式化、压缩转义、去除转义',
      module: window.JsonPanel
    },
    codec: {
      title: '编码转换',
      desc: 'Base64 / URL / Unicode 三种编码，编码与解码双向转换',
      module: window.CodecPanel
    },
    timestamp: {
      title: '时间戳转换',
      desc: '秒 / 毫秒时间戳与日期互转，同时给出 UTC、ISO 与相对时间',
      module: window.TimestampPanel
    }
  };

  var nav = document.getElementById('nav');
  var titleEl = document.getElementById('tool-title');
  var descEl = document.getElementById('tool-desc');
  var instances = {};

  var LAYOUT_KEY = 'dev-toolkit.ui.layout.v1';
  var SPLIT_DEFAULT = 50;
  var SPLIT_MIN = 20;
  var SPLIT_MAX = 80;
  var SPLIT_STEP = 2;

  function activate(toolName) {
    var config = TOOLS[toolName];
    if (!config) return;

    document.querySelectorAll('.panel').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-panel') !== toolName;
    });
    nav.querySelectorAll('.nav-item').forEach(function (node) {
      node.classList.toggle('is-active', node.getAttribute('data-tool') === toolName);
    });

    titleEl.textContent = config.title;
    descEl.textContent = config.desc;

    var instance = instances[toolName];
    if (instance && instance.onShow) instance.onShow();
  }

  /* ---------------- 布局：侧栏折叠 + 双栏宽度 ---------------- */

  function initLayout() {
    var app = document.querySelector('.app');
    var toggle = document.getElementById('sidebar-toggle');
    var splitters = Array.prototype.slice.call(document.querySelectorAll('.splitter'));
    var state = { collapsed: false, split: SPLIT_DEFAULT };
    var saveTimer = null;

    function clampSplit(percent) {
      return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(percent)));
    }

    function apply() {
      app.classList.toggle('is-sidebar-collapsed', state.collapsed);
      app.style.setProperty('--split', state.split + '%');
      toggle.setAttribute('aria-expanded', String(!state.collapsed));
      var label = state.collapsed ? '展开侧栏' : '收起侧栏';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      splitters.forEach(function (node) {
        node.setAttribute('aria-valuenow', String(state.split));
      });
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        UI.storageSet(LAYOUT_KEY, state);
      }, 400);
    }

    // 宽度变了，编辑器要把高亮层与行号重新对齐，否则会错位
    function notifyResize() {
      Object.keys(instances).forEach(function (name) {
        var instance = instances[name];
        if (instance && instance.onResize) instance.onResize();
      });
    }

    function setSplit(percent) {
      state.split = clampSplit(percent);
      apply();
    }

    splitters.forEach(function (splitter) {
      var workspace = splitter.parentElement;

      function percentAt(clientX) {
        var rect = workspace.getBoundingClientRect();
        if (!rect.width) return state.split;
        return ((clientX - rect.left) / rect.width) * 100;
      }

      splitter.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return;
        event.preventDefault();
        splitter.focus();
        splitter.setPointerCapture(event.pointerId);
        splitter.classList.add('is-active');
        document.body.classList.add('is-resizing');

        function onMove(moveEvent) {
          setSplit(percentAt(moveEvent.clientX));
        }

        function finish() {
          splitter.classList.remove('is-active');
          document.body.classList.remove('is-resizing');
          splitter.removeEventListener('pointermove', onMove);
          splitter.removeEventListener('pointerup', finish);
          splitter.removeEventListener('pointercancel', finish);
          notifyResize();
          scheduleSave();
        }

        splitter.addEventListener('pointermove', onMove);
        splitter.addEventListener('pointerup', finish);
        splitter.addEventListener('pointercancel', finish);
      });

      splitter.addEventListener('dblclick', function () {
        setSplit(SPLIT_DEFAULT);
        notifyResize();
        scheduleSave();
      });

      splitter.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowLeft') next = state.split - SPLIT_STEP;
        else if (event.key === 'ArrowRight') next = state.split + SPLIT_STEP;
        else if (event.key === 'Home') next = SPLIT_MIN;
        else if (event.key === 'End') next = SPLIT_MAX;
        if (next === null) return;
        event.preventDefault();
        setSplit(next);
        notifyResize();
        scheduleSave();
      });
    });

    toggle.addEventListener('click', function () {
      state.collapsed = !state.collapsed;
      apply();
      // 收起时有 0.18s 过渡，等宽度真正到位再让编辑器重新对齐
      setTimeout(notifyResize, 200);
      scheduleSave();
    });

    apply();

    UI.storageGet(LAYOUT_KEY).then(function (saved) {
      if (!saved) return;
      if (typeof saved.collapsed === 'boolean') state.collapsed = saved.collapsed;
      if (typeof saved.split === 'number') state.split = clampSplit(saved.split);
      apply();
      notifyResize();
    });
  }

  Object.keys(TOOLS).forEach(function (name) {
    var config = TOOLS[name];
    var panel = document.querySelector('.panel[data-panel="' + name + '"]');
    if (!panel || !config.module) return;
    instances[name] = config.module.init(panel);
  });

  nav.addEventListener('click', function (event) {
    var item = event.target.closest('.nav-item');
    if (!item) return;
    activate(item.getAttribute('data-tool'));
  });

  initLayout();
  activate('json');
})();
