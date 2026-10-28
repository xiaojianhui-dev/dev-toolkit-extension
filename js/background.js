// 点击工具栏图标时，以新标签页的形式打开工具箱页面。
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
