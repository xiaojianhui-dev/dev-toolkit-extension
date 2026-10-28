/**
 * 编码转换核心能力：Base64 / URL / Unicode。
 * 纯函数、无 DOM 依赖，对外暴露 window.CodecTool。
 */
(function (global) {
  'use strict';

  function ok(value) {
    return { ok: true, value: value };
  }

  function fail(message) {
    return { ok: false, error: { message: message } };
  }

  /* ---------------- Base64 ---------------- */

  // 分块转换，避免 String.fromCharCode.apply 在长文本上爆栈
  function bytesToBinary(bytes) {
    var chunk = 0x8000;
    var out = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return out;
  }

  function encodeBase64(text) {
    if (!text) return ok('');
    try {
      var bytes = new TextEncoder().encode(text);
      return ok(btoa(bytesToBinary(bytes)));
    } catch (err) {
      return fail('Base64 编码失败：' + ((err && err.message) || '未知错误'));
    }
  }

  function decodeBase64(text) {
    // 允许带换行的 Base64，同时兼容 URL-safe 的 - 和 _
    var normalized = (text || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!normalized) return fail('内容为空，没有可解码的 Base64 文本');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      return fail('包含 Base64 之外的字符，请检查是否复制完整');
    }

    var remainder = normalized.length % 4;
    if (remainder === 1) return fail('Base64 长度不合法，可能缺少字符');
    if (remainder > 0) {
      normalized += new Array(5 - remainder).join('=');
    }

    try {
      var binary = atob(normalized);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return ok(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (err) {
      return fail('解码失败：不是合法的 Base64，或内容不是 UTF-8 文本');
    }
  }

  /* ---------------- URL ---------------- */

  function encodeUrl(text) {
    try {
      return ok(encodeURIComponent(text));
    } catch (err) {
      return fail('URL 编码失败：文本里有不成对的代理字符');
    }
  }

  function decodeUrl(text) {
    try {
      return ok(decodeURIComponent(text));
    } catch (err) {
      return fail('URL 解码失败：存在不完整的 % 转义序列');
    }
  }

  /* ---------------- Unicode 转义 ---------------- */

  function encodeUnicode(text) {
    var out = '';
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      // ASCII 保持原样，其余（含 emoji 的代理对）逐个转义
      if (code < 128) {
        out += text.charAt(i);
      } else {
        out += '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
      }
    }
    return ok(out);
  }

  function decodeUnicode(text) {
    var replaced = 0;
    var out = text.replace(
      /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,
      function (match, codePoint, unit, byte) {
        var code = parseInt(codePoint || unit || byte, 16);
        if (!codePoint && code > 0x10ffff) return match;
        replaced += 1;
        return codePoint ? String.fromCodePoint(code) : String.fromCharCode(code);
      }
    );
    if (!replaced) return fail('没有找到 \\uXXXX 形式的转义内容');
    return ok(out);
  }

  /* ---------------- 统一入口 ---------------- */

  var TYPES = {
    base64: { encode: encodeBase64, decode: decodeBase64, label: 'Base64' },
    url: { encode: encodeUrl, decode: decodeUrl, label: 'URL' },
    unicode: { encode: encodeUnicode, decode: decodeUnicode, label: 'Unicode' }
  };

  function convert(type, direction, text) {
    var handler = TYPES[type];
    if (!handler) return fail('不支持的编码类型：' + type);
    if (text === '' || text == null) return ok('');
    return handler[direction === 'decode' ? 'decode' : 'encode'](text);
  }

  global.CodecTool = {
    convert: convert,
    types: TYPES,
    encodeBase64: encodeBase64,
    decodeBase64: decodeBase64,
    encodeUrl: encodeUrl,
    decodeUrl: decodeUrl,
    encodeUnicode: encodeUnicode,
    decodeUnicode: decodeUnicode
  };
})(window);
