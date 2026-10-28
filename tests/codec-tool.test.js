/**
 * 编码转换自测，零依赖：node tests/codec-tool.test.js
 */
const path = require('path');
const assert = require('assert');

global.window = global;
require(path.join(__dirname, '..', 'js', 'codec-tool.js'));

const { convert, encodeBase64, decodeBase64, encodeUrl, decodeUrl, encodeUnicode, decodeUnicode } = global.CodecTool;

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

check('Base64 编码：ASCII', () => {
  assert.strictEqual(encodeBase64('hello').value, 'aGVsbG8=');
});

check('Base64 编码：中文按 UTF-8', () => {
  assert.strictEqual(encodeBase64('你好').value, '5L2g5aW9');
});

check('Base64 解码：中文还原', () => {
  assert.strictEqual(decodeBase64('5L2g5aW9').value, '你好');
});

check('Base64 解码：允许换行与 URL-safe 字符', () => {
  const encoded = encodeBase64('a+b/c 测试').value;
  const urlSafe = encoded.replace(/\+/g, '-').replace(/\//g, '_');
  assert.strictEqual(decodeBase64('  ' + urlSafe + '\n').value, 'a+b/c 测试');
});

check('Base64 解码：缺少 padding 也能处理', () => {
  assert.strictEqual(decodeBase64('5L2g5aW9'.replace(/=+$/, '')).value, '你好');
});

check('Base64 解码：非法字符报错', () => {
  const res = decodeBase64('@@@not-base64@@@');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.message.includes('Base64'));
});

check('Base64 解码：长度非法报错', () => {
  assert.strictEqual(decodeBase64('aGVsbG8ta').ok, false);
});

check('URL 编码：保留中文与特殊字符的转义', () => {
  assert.strictEqual(encodeUrl('a b&c=中文').value, 'a%20b%26c%3D%E4%B8%AD%E6%96%87');
});

check('URL 解码：还原成原文', () => {
  assert.strictEqual(decodeUrl('a%20b%26c%3D%E4%B8%AD%E6%96%87').value, 'a b&c=中文');
});

check('URL 解码：不完整的 % 序列报错', () => {
  const res = decodeUrl('%E4%B8');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.message.includes('URL'));
});

check('Unicode 转义：ASCII 保留、中文转 \\u', () => {
  assert.strictEqual(encodeUnicode('a中').value, 'a\\u4E2D');
});

check('Unicode 转义：emoji 输出代理对', () => {
  assert.strictEqual(encodeUnicode('😀').value, '\\uD83D\\uDE00');
});

check('Unicode 还原：\\uXXXX', () => {
  assert.strictEqual(decodeUnicode('\\u4E2D\\u6587').value, '中文');
});

check('Unicode 还原：\\u{...} 码点写法', () => {
  assert.strictEqual(decodeUnicode('\\u{1F600}').value, '😀');
});

check('Unicode 还原：没有转义时报错', () => {
  const res = decodeUnicode('plain text');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.message.includes('\\u'));
});

check('统一入口：类型 + 方向', () => {
  assert.strictEqual(convert('base64', 'encode', 'hi').value, 'aGk=');
  assert.strictEqual(convert('base64', 'decode', 'aGk=').value, 'hi');
  assert.strictEqual(convert('url', 'encode', '中').value, '%E4%B8%AD');
  assert.strictEqual(convert('unicode', 'decode', '\\u4E2D').value, '中');
});

check('统一入口：空输入直接返回空串', () => {
  assert.strictEqual(convert('base64', 'encode', '').value, '');
});

check('往返一致：Base64 / URL / Unicode', () => {
  const text = 'Hello 中文 😀 & 100%';
  assert.strictEqual(decodeBase64(encodeBase64(text).value).value, text);
  assert.strictEqual(decodeUrl(encodeUrl(text).value).value, text);
  assert.strictEqual(decodeUnicode(encodeUnicode(text).value).value, text);
});

console.log('\n' + passed + ' 项检查全部通过');
