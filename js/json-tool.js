/**
 * JSON 处理核心能力，纯函数、无 DOM 依赖，便于单独测试。
 * 对外暴露 window.JsonTool。
 */
(function (global) {
  'use strict';

  var INDENT = 2;

  // V8 的报错是英文的，这里给常见错误配一句中文说明，原文保留在 detail 里
  var ERROR_HINTS = [
    [/Unexpected end of JSON input/i, 'JSON 内容不完整，可能缺少闭合的括号或引号'],
    [/Expected double-quoted property name/i, '属性名必须用双引号包裹，或最后一个属性后多了逗号'],
    [/Expected ',' or '\}'/i, '缺少逗号，或对象没有闭合'],
    [/Expected ',' or '\]'/i, '缺少逗号，或数组没有闭合'],
    [/Expected ':' after property name/i, '属性名后面缺少冒号'],
    [/Unterminated string/i, '字符串缺少闭合的双引号'],
    [/Bad control character/i, '字符串里有未转义的控制字符（如换行、Tab）'],
    [/Bad escaped character/i, '存在非法的反斜杠转义'],
    [/Unexpected non-whitespace character/i, 'JSON 结束后还有多余内容'],
    [/Unexpected number/i, '数字格式不正确'],
    [/Unexpected token/i, '出现多余的字符或非法符号']
  ];

  function localize(message) {
    for (var i = 0; i < ERROR_HINTS.length; i += 1) {
      if (ERROR_HINTS[i][0].test(message)) return ERROR_HINTS[i][1];
    }
    return '';
  }

  function isEmpty(text) {
    return !text || !text.trim();
  }

  /**
   * 把 JSON.parse 抛出的原始错误，翻译成「行 / 列 / 位置」。
   * V8 的报错形如：
   *   Unexpected token } in JSON at position 42
   *   Expected ',' or '}' after property value in JSON at position 42 (line 3 column 10)
   */
  function describeError(raw, text) {
    var source = String(raw || 'JSON 解析失败');
    var positionMatch = /position\s+(\d+)/i.exec(source);
    var lineColMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(source);
    var position = positionMatch ? Number(positionMatch[1]) : -1;
    var line = lineColMatch ? Number(lineColMatch[1]) : -1;
    var column = lineColMatch ? Number(lineColMatch[2]) : -1;

    if (position < 0 && line > 0) {
      position = offsetOf(text, line, column);
    }
    if (line < 0 && position >= 0) {
      var point = lineColumnOf(text, position);
      line = point.line;
      column = point.column;
    }

    var message = source
      .replace(/\s*in JSON at position \d+.*$/i, '')
      .replace(/\s*\(line \d+ column \d+\)\s*$/i, '')
      .trim();

    return {
      message: localize(message) || message,
      detail: message,
      position: position,
      line: line,
      column: column
    };
  }

  /** 0 基偏移量 -> { line, column }，均从 1 开始 */
  function lineColumnOf(text, position) {
    var before = text.slice(0, Math.max(position, 0)).split('\n');
    return { line: before.length, column: before[before.length - 1].length + 1 };
  }

  /** { line, column } -> 0 基偏移量 */
  function offsetOf(text, line, column) {
    var lines = text.split('\n');
    var offset = 0;
    for (var i = 0; i < Math.min(line - 1, lines.length); i += 1) {
      offset += lines[i].length + 1;
    }
    return offset + Math.max(column - 1, 0);
  }

  function emptyError() {
    return { message: '内容为空，请先输入 JSON 文本', position: -1, line: -1, column: -1 };
  }

  /** 解析输入文本，失败时带回行列信息 */
  function parse(text) {
    if (isEmpty(text)) {
      return { ok: false, error: emptyError() };
    }
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      return { ok: false, error: describeError(err && err.message, text) };
    }
  }

  /** 格式化：2 空格缩进的多行 JSON */
  function format(text, indent) {
    var parsed = parse(text);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      value: JSON.stringify(parsed.value, null, indent === undefined ? INDENT : indent)
    };
  }

  /** 压缩：去掉所有多余空白，压成一行 */
  function minify(text) {
    var parsed = parse(text);
    if (!parsed.ok) return parsed;
    return { ok: true, value: JSON.stringify(parsed.value) };
  }

  /** 压缩转义：压成一行后，再转成可直接写进代码的字符串字面量（带外层引号） */
  function minifyEscape(text) {
    var parsed = parse(text);
    if (!parsed.ok) return parsed;
    return { ok: true, value: JSON.stringify(JSON.stringify(parsed.value)) };
  }

  /**
   * 宽松反转义：单遍扫描，避免链式 replace 把 \\n 误伤成「反斜杠 + 换行」。
   * 支持 \" \' \\ \/ \n \r \t \b \f \v \0 \uXXXX \xXX
   */
  function unescapeLoose(text) {
    var out = '';
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      if (ch !== '\\') {
        out += ch;
        continue;
      }
      var next = text.charAt(i + 1);
      if (next === '') {
        out += ch;
        break;
      }
      switch (next) {
        case 'n': out += '\n'; i += 1; break;
        case 'r': out += '\r'; i += 1; break;
        case 't': out += '\t'; i += 1; break;
        case 'b': out += '\b'; i += 1; break;
        case 'f': out += '\f'; i += 1; break;
        case 'v': out += '\v'; i += 1; break;
        case '0': out += '\0'; i += 1; break;
        case '"': out += '"'; i += 1; break;
        case "'": out += "'"; i += 1; break;
        case '\\': out += '\\'; i += 1; break;
        case '/': out += '/'; i += 1; break;
        case 'u': {
          var uHex = text.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(uHex)) {
            out += String.fromCharCode(parseInt(uHex, 16));
            i += 5;
          } else {
            out += ch;
          }
          break;
        }
        case 'x': {
          var xHex = text.slice(i + 2, i + 4);
          if (/^[0-9a-fA-F]{2}$/.test(xHex)) {
            out += String.fromCharCode(parseInt(xHex, 16));
            i += 3;
          } else {
            out += ch;
          }
          break;
        }
        default:
          // 未知转义（如 \z）：原样保留反斜杠，交给下一轮处理该字符
          out += ch;
      }
    }
    return out;
  }

  /**
   * 去除转义：依次尝试三种解读方式，取第一个能还原成合法 JSON 的结果。
   *   1. 外层双引号包裹的字符串字面量  "{\"a\":1}"
   *   2. 本身就是合法 JSON            {"a":1}
   *   3. 宽松反转义                    {\"a\":1}
   */
  function unescape(text) {
    if (isEmpty(text)) {
      return { ok: false, error: emptyError() };
    }

    var input = text.trim();
    var candidates = [];

    if (input.length > 1 && input.charAt(0) === '"' && input.charAt(input.length - 1) === '"') {
      try {
        var literal = JSON.parse(input);
        if (typeof literal === 'string') {
          candidates.push({ label: '字符串字面量', text: literal });
        }
      } catch (err) {
        // 交给后面的候选方式
      }
    }

    try {
      JSON.parse(input);
      candidates.push({ label: '原始 JSON', text: input });
    } catch (err) {
      // 交给后面的候选方式
    }

    var loose = unescapeLoose(input);
    if (loose !== input) {
      candidates.push({ label: '宽松反转义', text: loose });
    }

    var lastError = null;
    for (var i = 0; i < candidates.length; i += 1) {
      try {
        var value = JSON.parse(candidates[i].text);
        return {
          ok: true,
          value: JSON.stringify(value, null, INDENT),
          detail: candidates[i].label
        };
      } catch (err) {
        lastError = describeError(err && err.message, candidates[i].text);
      }
    }

    return {
      ok: false,
      error: lastError || { message: '无法识别为已转义的 JSON 文本', position: -1, line: -1, column: -1 }
    };
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * 语法着色：词法级扫描，非法 JSON 也能着色，不影响用户继续编辑。
   * 返回可直接塞进 <code> 的 HTML 字符串。
   */
  function highlight(text) {
    if (!text) return '';

    var pattern = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])/g;
    var html = '';
    var last = 0;
    var match;

    while ((match = pattern.exec(text)) !== null) {
      html += escapeHtml(text.slice(last, match.index));

      if (match[1] !== undefined) {
        if (match[2] !== undefined) {
          html += '<span class="tok-key">' + escapeHtml(match[1]) + '</span>';
          html += '<span class="tok-punc">' + escapeHtml(match[2]) + '</span>';
        } else {
          html += '<span class="tok-str">' + escapeHtml(match[1]) + '</span>';
        }
      } else if (match[3] !== undefined) {
        html += '<span class="tok-num">' + escapeHtml(match[3]) + '</span>';
      } else if (match[4] !== undefined) {
        html += '<span class="tok-lit">' + escapeHtml(match[4]) + '</span>';
      } else {
        html += '<span class="tok-punc">' + escapeHtml(match[5]) + '</span>';
      }

      last = match.index + match[0].length;
    }

    html += escapeHtml(text.slice(last));
    return html;
  }

  global.JsonTool = {
    format: format,
    minify: minify,
    minifyEscape: minifyEscape,
    unescape: unescape,
    unescapeLoose: unescapeLoose,
    highlight: highlight,
    describeError: describeError
  };
})(window);
