/**
 * 页面骨架：注册工具、切换 TAB、维护顶部标题。
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

  activate('json');
})();
