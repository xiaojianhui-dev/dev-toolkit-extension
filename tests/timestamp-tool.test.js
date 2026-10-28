/**
 * 时间戳转换自测，零依赖：node tests/timestamp-tool.test.js
 */
const path = require('path');
const assert = require('assert');

global.window = global;
require(path.join(__dirname, '..', 'js', 'timestamp-tool.js'));

const { convert, parseInput, describe, relative } = global.TimestampTool;

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

check('识别 13 位毫秒时间戳', () => {
  const res = parseInput('1761658200000');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.ms, 1761658200000);
  assert.strictEqual(res.kind, '毫秒级时间戳');
});

check('识别 10 位秒时间戳', () => {
  const res = parseInput('1761658200');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.ms, 1761658200000);
  assert.strictEqual(res.kind, '秒级时间戳');
});

check('解析本地日期时间', () => {
  const expected = new Date(2026, 9, 28, 20, 30, 0, 0).getTime();
  const res = parseInput('2026-10-28 20:30:00');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.ms, expected);
  assert.strictEqual(res.kind, '日期时间');
});

check('解析带毫秒与斜杠的日期', () => {
  const expected = new Date(2026, 9, 28, 20, 30, 5, 123).getTime();
  assert.strictEqual(parseInput('2026/10/28 20:30:05.123').ms, expected);
});

check('只有日期时按当天零点', () => {
  const expected = new Date(2026, 9, 28, 0, 0, 0, 0).getTime();
  assert.strictEqual(parseInput('2026-10-28').ms, expected);
});

check('不存在的日期报错', () => {
  const res = parseInput('2026-02-30');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.message.includes('日期不存在'));
});

check('非法输入报错', () => {
  const res = parseInput('hello');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.message.includes('无法识别'));
});

check('空输入报错', () => {
  assert.strictEqual(parseInput('  ').ok, false);
});

check('相对时间：过去', () => {
  const now = 1761658200000;
  assert.strictEqual(relative(now - 3 * 60000, now), '3 分钟前');
  assert.strictEqual(relative(now - 2 * 3600000, now), '2 小时前');
  assert.strictEqual(relative(now - 5 * 86400000, now), '5 天前');
});

check('相对时间：未来', () => {
  const now = 1761658200000;
  assert.strictEqual(relative(now + 2 * 86400000, now), '2 天后');
});

check('相对时间：不足一年仍按月，跨过年限改用年', () => {
  const now = 1761658200000;
  assert.strictEqual(relative(now - 330 * 86400000, now), '11 个月前');
  assert.strictEqual(relative(now - 364 * 86400000, now), '1 年前');
  assert.strictEqual(relative(now - 700 * 86400000, now), '2 年前');
});

check('相对时间：彼此接近时是刚刚', () => {
  const now = 1761658200000;
  assert.strictEqual(relative(now + 1000, now), '刚刚');
});

check('结果包含秒、毫秒、ISO 与星期', () => {
  const res = convert('1761658200000', 1761658200000);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.detail.milliseconds, 1761658200000);
  assert.strictEqual(res.detail.seconds, 1761658200);
  assert.strictEqual(res.detail.iso, new Date(1761658200000).toISOString());
  assert.ok(['周日', '周一', '周二', '周三', '周四', '周五', '周六'].includes(res.detail.weekday));
  assert.strictEqual(res.detail.relative, '刚刚');
});

check('本地与 UTC 时间都按毫秒对齐', () => {
  const ms = new Date(2026, 9, 28, 20, 30, 5, 7).getTime();
  const detail = describe(ms, ms);
  assert.ok(detail.local.endsWith('20:30:05.007'));
  assert.ok(detail.utc.endsWith(':05.007'));
  assert.ok(/GMT[+-]\d/.test(detail.gmt));
});

check('日期 → 时间戳 往返一致', () => {
  const ms = new Date(2026, 9, 28, 20, 30, 0, 0).getTime();
  const back = convert('2026-10-28 20:30:00', ms);
  assert.strictEqual(back.ms, ms);
  assert.strictEqual(back.detail.seconds, Math.floor(ms / 1000));
});

console.log('\n' + passed + ' 项检查全部通过');
