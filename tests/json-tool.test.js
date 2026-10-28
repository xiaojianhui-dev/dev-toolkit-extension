/**
 * 核心逻辑自测，零依赖：node tests/json-tool.test.js
 */
const path = require('path');
const assert = require('assert');

global.window = global;
require(path.join(__dirname, '..', 'js', 'json-tool.js'));

const { format, minify, minifyEscape, unescape, highlight } = global.JsonTool;

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

check('格式化：2 空格缩进的多行 JSON', () => {
  const res = format('{"a":1,"b":[1,2],"c":{"d":true}}');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(
    res.value,
    '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ],\n  "c": {\n    "d": true\n  }\n}'
  );
});

check('格式化：中文与特殊字符不被破坏', () => {
  const res = format('{"name":"中文","path":"a/b"}');
  assert.strictEqual(res.ok, true);
  assert.ok(res.value.includes('"name": "中文"'));
  assert.ok(res.value.includes('"path": "a/b"'));
});

check('压缩：输出单行且去掉空白', () => {
  const res = minify('{\n  "a": 1,\n  "b": [1, 2]\n}');
  assert.strictEqual(res.value, '{"a":1,"b":[1,2]}');
});

check('压缩转义：输出带外层引号的字符串字面量', () => {
  const res = minifyEscape('{"a":1,"b":"中文"}');
  assert.strictEqual(res.value, '"{\\"a\\":1,\\"b\\":\\"中文\\"}"');
});

check('去除转义：外层引号的字符串字面量', () => {
  const res = unescape('"{\\"a\\":1,\\"b\\":[1,2]}"');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.value, '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
});

check('去除转义：没有外层引号，仅内部转义', () => {
  const res = unescape('{\\"a\\":1}');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.value, '{\n  "a": 1\n}');
});

check('去除转义：\\u 形式的 unicode', () => {
  const res = unescape('"{\\"name\\":\\"\\u4e2d\\u6587\\"}"');
  assert.strictEqual(res.ok, true);
  assert.ok(res.value.includes('"name": "中文"'));
});

check('去除转义：保留 JSON 内部的 \\n 转义语义', () => {
  const res = unescape('{\\"a\\":\\"line1\\\\nline2\\"}');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.value, '{\n  "a": "line1\\nline2"\n}');
});

check('去除转义：本来就是合法 JSON 时原样还原', () => {
  const res = unescape('{"a": 1}');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.value, '{\n  "a": 1\n}');
});

check('压缩转义 → 去除转义 往返一致', () => {
  const source = '{"id":123,"list":["a","b"],"ok":true}';
  const escaped = minifyEscape(source);
  assert.strictEqual(escaped.ok, true);
  const back = unescape(escaped.value);
  assert.strictEqual(back.ok, true);
  assert.strictEqual(back.value, '{\n  "id": 123,\n  "list": [\n    "a",\n    "b"\n  ],\n  "ok": true\n}');
});

check('错误定位：多行输入给出正确的行列', () => {
  const res = format('{\n  "a": 1,\n}');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error.line, 3);
  assert.strictEqual(res.error.column, 1);
});

check('错误定位：单行输入给出位置', () => {
  const res = format('{"a":1,}');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error.line, 1);
  assert.ok(res.error.column > 1);
});

check('空输入：返回可读提示而不是抛错', () => {
  const res = format('   ');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.message.includes('内容为空'));
});

check('语法高亮：转义 HTML 并标注 token', () => {
  const html = highlight('{"a":"<b>&","n":1,"ok":true}');
  assert.ok(html.includes('tok-key'));
  assert.ok(html.includes('tok-str'));
  assert.ok(html.includes('tok-num'));
  assert.ok(html.includes('&lt;b&gt;&amp;'));
  assert.ok(!html.includes('<b>'));
});

console.log('\n' + passed + ' 项检查全部通过');
