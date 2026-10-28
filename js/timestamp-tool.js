/**
 * 时间戳转换核心能力：时间戳 ⇄ 日期，及本地/UTC/ISO/相对时间。
 * 纯函数、无 DOM 依赖，对外暴露 window.TimestampTool。
 */
(function (global) {
  'use strict';

  // 秒与毫秒的分界：1e11 秒是公元 5138 年，1e11 毫秒是 1973 年
  var SECONDS_THRESHOLD = 100000000000;
  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad(value, length) {
    var str = String(value);
    while (str.length < length) str = '0' + str;
    return str;
  }

  function fail(message) {
    return { ok: false, error: { message: message } };
  }

  function formatLocal(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) +
      '.' + pad(d.getMilliseconds(), 3);
  }

  function formatUtc(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2) +
      ' ' + pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2) + ':' + pad(d.getUTCSeconds(), 2) +
      '.' + pad(d.getUTCMilliseconds(), 3);
  }

  function timezoneInfo(ms) {
    var offsetMinutes = -new Date(ms).getTimezoneOffset();
    var sign = offsetMinutes >= 0 ? '+' : '-';
    var abs = Math.abs(offsetMinutes);
    var gmt = 'GMT' + sign + Math.floor(abs / 60) + (abs % 60 ? ':' + pad(abs % 60, 2) : '');
    var zone = '';
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (err) {
      zone = '';
    }
    return { zone: zone, gmt: gmt };
  }

  function relative(ms, now) {
    var diff = ms - now;
    var abs = Math.abs(diff);
    var suffix = diff >= 0 ? '后' : '前';
    if (abs < 5000) return '刚刚';

    var table = [
      [31536000000, '年'],
      [2592000000, '个月'],
      [86400000, '天'],
      [3600000, '小时'],
      [60000, '分钟'],
      [1000, '秒']
    ];
    for (var i = 0; i < table.length; i += 1) {
      if (abs >= table[i][0]) {
        var value = Math.round(abs / table[i][0]);
        // 差一点点满一年时按个月算会得到「12 个月前」，读起来别扭，直接归到年
        if (table[i][1] === '个月' && value >= 12) {
          return Math.max(1, Math.round(abs / 31536000000)) + ' 年' + suffix;
        }
        return value + ' ' + table[i][1] + suffix;
      }
    }
    return '刚刚';
  }

  /**
   * 解析输入：
   *   纯数字（可带小数、负号）→ 按位数自动区分秒 / 毫秒
   *   2026-10-28、2026/10/28 20:30、2026-10-28 20:30:00.123 → 按本地时区
   *   其他 → 交给 Date.parse（ISO 8601 等）
   */
  function parseInput(text) {
    var input = (text || '').trim();
    if (!input) return fail('内容为空，请输入时间戳或日期');

    if (/^-?\d+(\.\d+)?$/.test(input)) {
      var num = Number(input);
      var isSeconds = Math.abs(num) < SECONDS_THRESHOLD;
      var ms = Math.round(isSeconds ? num * 1000 : num);
      if (!isFinite(ms)) return fail('时间戳超出可表示范围');
      return { ok: true, ms: ms, kind: isSeconds ? '秒级时间戳' : '毫秒级时间戳' };
    }

    var matched = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/.exec(input);
    if (matched) {
      var year = Number(matched[1]);
      var month = Number(matched[2]);
      var day = Number(matched[3]);
      var hour = Number(matched[4] || 0);
      var minute = Number(matched[5] || 0);
      var second = Number(matched[6] || 0);
      var milli = Number((matched[7] || '0').padEnd(3, '0'));

      var date = new Date(year, month - 1, day, hour, minute, second, milli);
      var valid = date.getFullYear() === year && date.getMonth() === month - 1 &&
        date.getDate() === day && date.getHours() === hour &&
        date.getMinutes() === minute && date.getSeconds() === second;
      if (!valid) return fail('日期不存在，请检查月份、日期或时分秒');
      return { ok: true, ms: date.getTime(), kind: '日期时间' };
    }

    var parsed = Date.parse(input);
    if (!isNaN(parsed)) {
      return { ok: true, ms: parsed, kind: '日期时间' };
    }
    return fail('无法识别，请输入时间戳，或 2026-10-28 20:30:00 这样的日期');
  }

  /** 把一个毫秒时间戳展开成界面上要展示的各个视角 */
  function describe(ms, now) {
    var current = now === undefined ? Date.now() : now;
    var date = new Date(ms);
    var zoneInfo = timezoneInfo(ms);
    return {
      local: formatLocal(ms),
      utc: formatUtc(ms),
      iso: date.toISOString(),
      seconds: Math.floor(ms / 1000),
      milliseconds: ms,
      weekday: WEEKDAYS[date.getDay()],
      relative: relative(ms, current),
      zone: zoneInfo.zone,
      gmt: zoneInfo.gmt
    };
  }

  /** 输入 → 结果，UI 一次调用拿全 */
  function convert(text, now) {
    var parsed = parseInput(text);
    if (!parsed.ok) return parsed;
    var current = now === undefined ? Date.now() : now;
    return {
      ok: true,
      kind: parsed.kind,
      ms: parsed.ms,
      detail: describe(parsed.ms, current)
    };
  }

  global.TimestampTool = {
    convert: convert,
    parseInput: parseInput,
    describe: describe,
    formatLocal: formatLocal,
    formatUtc: formatUtc,
    relative: relative
  };
})(window);
