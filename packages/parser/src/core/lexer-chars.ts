/**
 * @author Aidan Boissonneault
 * @file lexer-chars.ts
 * @purpose Provides lexer chars behavior for the core in parser package.
 * @last-edited October 6, 2026
 */

/**
 * Checks whether a character is an ASCII digit.
 * The lexer intentionally uses byte-sized language predicates so token rules
 * remain independent of JavaScript locale and Unicode classification behavior.
 */
export function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Returns whether the input meets the `lower alpha` condition.
 */
export function isLowerAlpha(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

/**
 * Returns whether the input meets the `hex digit` condition.
 */
export function isHexDigit(ch: string): boolean {
  return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

/**
 * Returns whether the input meets the `number start` condition.
 */
export function isNumberStart(ch: string, next: string): boolean {
  return isDigit(ch) || (ch === '.' && isDigit(next));
}

/**
 * Returns whether the input meets the `identifier start` condition.
 */
export function isIdentifierStart(ch: string): boolean {
  return isLowerAlpha(ch) || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

/**
 * Returns whether the input meets the `identifier char` condition.
 */
export function isIdentifierChar(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch);
}
