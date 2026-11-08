global.Buffer = require('buffer').Buffer

// Hermes 引擎缺少 TextEncoder/TextDecoder 全局对象（react-native-qrcode-svg 的
// qrcode 依赖在生成二维码时调用 new TextEncoder()，缺失会抛
// "Property 'TextEncoder' doesn't exist"）。这里提供最小 UTF-8 实现。
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    get encoding() { return 'utf-8' }
    encode(str) {
      const utf8 = []
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i)
        // 代理对合并（增补平面字符）
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
          const next = str.charCodeAt(i + 1)
          if (next >= 0xdc00 && next <= 0xdfff) {
            code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000
            i++
          }
        }
        if (code < 0x80) {
          utf8.push(code)
        } else if (code < 0x800) {
          utf8.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
        } else if (code < 0x10000) {
          utf8.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
        } else {
          utf8.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
        }
      }
      return new Uint8Array(utf8)
    }
  }
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    get encoding() { return 'utf-8' }
    decode(bytes) {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
      let out = ''
      let i = 0
      while (i < u8.length) {
        const b = u8[i]
        let code
        if (b < 0x80) {
          code = b
          i += 1
        } else if (b < 0xe0) {
          code = ((b & 0x1f) << 6) | (u8[i + 1] & 0x3f)
          i += 2
        } else if (b < 0xf0) {
          code = ((b & 0x0f) << 12) | ((u8[i + 1] & 0x3f) << 6) | (u8[i + 2] & 0x3f)
          i += 3
        } else {
          code = ((b & 0x07) << 18) | ((u8[i + 1] & 0x3f) << 12) | ((u8[i + 2] & 0x3f) << 6) | (u8[i + 3] & 0x3f)
          i += 4
        }
        out += String.fromCodePoint(code)
      }
      return out
    }
  }
}
