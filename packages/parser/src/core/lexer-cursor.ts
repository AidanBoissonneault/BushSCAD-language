/**
 * @author Aidan Boissonneault
 * @file lexer-cursor.ts
 * @purpose Provides lexer cursor behavior for the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from '@bushscad/ir';
import type { Token, TokenKind } from './token-types.js';
import {
  KEYWORDS,
  SINGLE_CHAR_TOKENS,
  TWO_CHAR_TOKENS,
  UNIT_TOKENS,
} from './lexer-tables.js';
import {
  isDigit,
  isHexDigit,
  isIdentifierChar,
  isIdentifierStart,
  isLowerAlpha,
  isNumberStart,
} from './lexer-chars.js';
import type { LexerMark } from './lexer-position.js';
import { decodeTemplateEscape } from './template-string-escapes.js';

/**
 * Stateful cursor that advances through source text and emits tokens.
 * Tokenization depends on mutable source position, line, and column state. The
 * cursor keeps that state private while `lexer.ts` remains the public API.
 */
export class LexerCursor {
  private readonly tokens: Token[] = [];
  private pos = 0;
  private line = 1;
  private col = 1;

  /**
   * Initializes the `LexerCursor` instance with the values supplied by its caller.
   */
  constructor(
    private readonly source: string,
    private readonly file: string,
  ) {}

  /**
   * Handles tokenize in the core flow.
   */
  tokenize(): Token[] {
    while (this.emitNext()) {
      // Token emission advances the cursor.
    }
    this.emitEof();
    return this.tokens;
  }

  /**
   * Emits next into the current output.
   */
  private emitNext(): boolean {
    if (this.done()) return false;
    this.emitCurrent();
    return true;
  }

  /**
   * Emits current into the current output.
   */
  private emitCurrent(): void {
    if (this.consumeTrivia()) return;

    const start = this.mark();
    if (this.emitTemplateString(start)) return;
    if (this.emitNumber(start)) return;
    if (this.emitColor(start)) return;
    if (this.emitString(start)) return;
    if (this.emitIdentifier(start)) return;
    this.emitOperatorOrUnknown(start);
  }

  /**
   * Emits eof into the current output.
   */
  private emitEof(): void {
    this.tokens.push({
      kind: 'EOF',
      value: '',
      span: this.span(this.line, this.col),
    });
  }

  /**
   * Handles consume trivia in the core flow.
   */
  private consumeTrivia(): boolean {
    return (
      this.consumeWhitespace() ||
      this.consumeLineComment() ||
      this.consumeBlockComment()
    );
  }

  /**
   * Handles consume whitespace in the core flow.
   */
  private consumeWhitespace(): boolean {
    const ch = this.current();
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Handles consume line comment in the core flow.
   */
  private consumeLineComment(): boolean {
    if (this.current() !== '/' || this.peek(1) !== '/') return false;
    while (!this.done() && this.current() !== '\n') this.advance();
    return true;
  }

  /**
   * Handles consume block comment in the core flow.
   */
  private consumeBlockComment(): boolean {
    if (this.current() !== '/' || this.peek(1) !== '*') return false;
    const start = this.mark();
    this.advance();
    this.advance();
    let terminated = false;
    while (!this.done()) {
      if (this.current() === '*' && this.peek(1) === '/') {
        this.advance();
        this.advance();
        terminated = true;
        break;
      }
      this.advance();
    }
    if (!terminated) this.push('UNKNOWN', 'unterminated block comment', start);
    return true;
  }

  /**
   * Emits number into the current output.
   */
  private emitNumber(start: LexerMark): boolean {
    if (!isNumberStart(this.current(), this.peek(1))) return false;
    // ".5" after a DOT means ".." range, not a leading-decimal float.
    if (this.current() === '.' && this.tokens.at(-1)?.kind === 'DOT')
      return false;

    // Read digits/dot, but stop at ".." so limit ranges (0..100) lex correctly.
    const value = this.readWhile(
      (ch) => isDigit(ch) || (ch === '.' && this.peek(1) !== '.'),
    );
    const unitStart = this.mark();
    const unit = this.readWhile(isLowerAlpha);

    if (unit) {
      if (this.emitKnownUnitNumber(value, unit, start)) return true;
      this.restore(unitStart);
    }

    this.push('NUMBER', value, start);
    return true;
  }

  /**
   * Emits color into the current output.
   */
  private emitColor(start: LexerMark): boolean {
    if (this.current() !== '#') return false;

    this.advance();
    const value = `#${this.readWhile(isHexDigit)}`;
    this.push('STRING', value, start);
    return true;
  }

  /**
   * Emits string into the current output.
   */
  private emitString(start: LexerMark): boolean {
    const quote = this.current();
    if (quote !== "'" && quote !== '"') return false;

    this.advance();
    const value = this.readStringContent(quote);
    const terminated = this.current() === quote;
    if (terminated) this.advance();
    this.push(terminated ? 'STRING' : 'UNKNOWN', value, start);
    return true;
  }

  /** Emits a complete backtick template while recursively lexing substitutions. */
  private emitTemplateString(start: LexerMark): boolean {
    if (this.current() !== '`') return false;

    this.advance();
    this.push('TEMPLATE_START', '`', start);
    let textStart = this.mark();
    let value = '';
    while (!this.done()) {
      if (this.current() === '`') {
        this.pushTemplateText(value, textStart);
        const end = this.mark();
        this.advance();
        this.push('TEMPLATE_END', '`', end);
        return true;
      }
      if (this.current() === '$' && this.peek(1) === '{') {
        this.pushTemplateText(value, textStart);
        const expressionStart = this.mark();
        this.advance();
        this.advance();
        this.push('TEMPLATE_EXPR_START', '${', expressionStart);
        this.emitTemplateExpression();
        textStart = this.mark();
        value = '';
        continue;
      }
      if (this.current() === '\\') {
        const escapeStart = this.mark();
        const escape = decodeTemplateEscape(this.source, this.pos);
        value += escape.value;
        for (let index = 0; index < escape.length; index++) this.advance();
        if (!escape.valid) {
          this.pushTemplateText(value, textStart);
          this.push('TEMPLATE_INVALID_ESCAPE', escape.value, escapeStart);
          textStart = this.mark();
          value = '';
        }
        continue;
      }
      value += this.advance();
    }
    this.pushTemplateText(value, textStart);
    return true;
  }

  /** Lexes normal expressions until the matching template substitution brace. */
  private emitTemplateExpression(): void {
    let braceDepth = 0;
    while (!this.done()) {
      if (this.current() === '}' && braceDepth === 0) {
        const end = this.mark();
        this.advance();
        this.push('TEMPLATE_EXPR_END', '}', end);
        return;
      }
      if (this.current() === '{') braceDepth++;
      else if (this.current() === '}') braceDepth--;
      this.emitCurrent();
    }
  }

  /**
   * Handles push template text in the core flow.
   */
  private pushTemplateText(value: string, start: LexerMark): void {
    if (value) this.push('TEMPLATE_TEXT', value, start);
  }

  /**
   * Emits identifier into the current output.
   */
  private emitIdentifier(start: LexerMark): boolean {
    if (!isIdentifierStart(this.current())) return false;

    const value = this.readWhile(isIdentifierChar);
    const kind = Object.prototype.hasOwnProperty.call(KEYWORDS, value)
      ? KEYWORDS[value]
      : 'IDENT';
    this.push(kind, value, start);
    return true;
  }

  /**
   * Emits known unit number into the current output.
   */
  private emitKnownUnitNumber(
    value: string,
    unit: string,
    start: LexerMark,
  ): boolean {
    const unitKind = Object.prototype.hasOwnProperty.call(UNIT_TOKENS, unit)
      ? UNIT_TOKENS[unit]
      : undefined;
    if (!unitKind) return false;

    this.push('NUMBER', value, start);
    this.tokens.push({
      kind: unitKind,
      value: unit,
      span: {
        file: this.file,
        line: start.line,
        col: start.col + value.length,
        endLine: this.line,
        endCol: this.col,
      },
    });
    return true;
  }

  /**
   * Reads string content from the supplied source.
   */
  private readStringContent(quote: string): string {
    let value = '';
    while (!this.done() && this.current() !== quote) {
      value += this.readStringChar();
    }
    return value;
  }

  /**
   * Reads string char from the supplied source.
   */
  private readStringChar(): string {
    if (this.current() !== '\\') return this.advance();
    this.advance();
    return this.advance();
  }

  /**
   * Reads while from the supplied source.
   */
  private readWhile(matches: (ch: string) => boolean): string {
    let value = '';
    while (!this.done() && matches(this.current())) value += this.advance();
    return value;
  }

  /**
   * Emits operator or unknown into the current output.
   */
  private emitOperatorOrUnknown(start: LexerMark): void {
    const ch = this.advance();
    const twoChar = `${ch}${this.current()}`;
    const twoCharKind = TWO_CHAR_TOKENS[twoChar];
    if (twoCharKind) {
      this.advance();
      this.push(twoCharKind, twoChar, start);
      return;
    }

    this.push(SINGLE_CHAR_TOKENS[ch] ?? 'UNKNOWN', ch, start);
  }

  /**
   * Handles push in the core flow.
   */
  private push(kind: TokenKind, value: string, start: LexerMark): void {
    this.tokens.push({ kind, value, span: this.span(start.line, start.col) });
  }

  /**
   * Handles span in the core flow.
   */
  private span(startLine: number, startCol: number): ASTSourceSpan {
    return {
      file: this.file,
      line: startLine,
      col: startCol,
      endLine: this.line,
      endCol: this.col,
    };
  }

  /**
   * Returns the current from the owning state.
   */
  private current(): string {
    return this.source[this.pos] ?? '';
  }

  /**
   * Handles peek in the core flow.
   */
  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? '';
  }

  /**
   * Handles advance in the core flow.
   */
  private advance(): string {
    const ch = this.source[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  /**
   * Handles done in the core flow.
   */
  private done(): boolean {
    return this.pos >= this.source.length;
  }

  /**
   * Updates state to record .
   */
  private mark(): LexerMark {
    return { pos: this.pos, line: this.line, col: this.col };
  }

  /**
   * Handles restore in the core flow.
   */
  private restore(mark: LexerMark): void {
    this.pos = mark.pos;
    this.line = mark.line;
    this.col = mark.col;
  }
}
