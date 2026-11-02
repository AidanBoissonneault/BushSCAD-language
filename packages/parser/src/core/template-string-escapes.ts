/**
 * @author Aidan Boissonneault
 * @file template-string-escapes.ts
 * @purpose Decodes escaped characters and code points in template string literals.
 * @last-edited October 6, 2026
 */

/**
 * Decoded template escape, including display value, length, and valid.
 */

export type DecodedTemplateEscape = {
  value: string;
  length: number;
  valid: boolean;
};

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  '0': '\0',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

/**
 * Decodes one JavaScript/TypeScript template-literal escape.
 *
 * The lexer owns cursor movement, so this pure helper returns both the cooked
 * value and the number of source characters that belong to the escape.
 */
export function decodeTemplateEscape(
  source: string,
  start: number,
): DecodedTemplateEscape {
  const escaped = source[start + 1] ?? '';
  if (escaped === '\n') return { value: '', length: 2, valid: true };
  if (escaped === '\r') {
    return {
      value: '',
      length: source[start + 2] === '\n' ? 3 : 2,
      valid: true,
    };
  }
  const simple = SIMPLE_ESCAPES[escaped];
  if (simple !== undefined) {
    const decimalAfterZero =
      escaped === '0' && /[0-9]/.test(source[start + 2] ?? '');
    return { value: simple, length: 2, valid: !decimalAfterZero };
  }
  if (escaped === 'x') return decodeFixedHex(source, start, 2, 4);
  if (escaped === 'u') {
    if (source[start + 2] === '{') return decodeCodePoint(source, start);
    return decodeFixedHex(source, start, 4, 6);
  }
  return {
    value: escaped,
    length: escaped ? 2 : 1,
    valid: !/[1-9]/.test(escaped),
  };
}

/**
 * Handles decode fixed hex in the core flow.
 */
function decodeFixedHex(
  source: string,
  start: number,
  digits: number,
  length: number,
): DecodedTemplateEscape {
  const raw = source.slice(start + 2, start + 2 + digits);
  if (!new RegExp(`^[0-9a-fA-F]{${digits}}$`).test(raw)) {
    return { value: source[start + 1] ?? '', length: 2, valid: false };
  }
  return {
    value: String.fromCodePoint(Number.parseInt(raw, 16)),
    length,
    valid: true,
  };
}

/**
 * Handles decode code point in the core flow.
 */
function decodeCodePoint(source: string, start: number): DecodedTemplateEscape {
  const close = source.indexOf('}', start + 3);
  const raw = close < 0 ? '' : source.slice(start + 3, close);
  const value = Number.parseInt(raw, 16);
  if (!/^[0-9a-fA-F]+$/.test(raw) || value > 0x10ffff) {
    return { value: 'u', length: 2, valid: false };
  }
  return {
    value: String.fromCodePoint(value),
    length: close - start + 1,
    valid: true,
  };
}
