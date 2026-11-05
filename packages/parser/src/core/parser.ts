/**
 * @author Aidan Boissonneault
 * @file parser.ts
 * @purpose Provides parser behavior for the core in parser package.
 * @last-edited October 6, 2026
 */

import { ParseRecovery } from './errors.js';
import type { ParseError } from './errors.js';
import { tokenize } from './lexer.js';
import type { TokenKind } from './token-types.js';
import type { Token } from './token-types.js';
import type {
  Program,
  TopLevelStatement,
  ComponentBody,
  Expr,
  Literal,
  FaceRef,
  FaceRefList,
  FnCallExpr,
  PosRef,
  RepeatableSpatialRef,
  ASTSourceSpan,
} from '@bushscad/ir';
import { parseTernary } from '../expressions/parse-expressions.js';
import {
  parseFaceRefFromIdent as _parseFaceRefFromIdent,
  parseFnCallFromIdent as _parseFnCallFromIdent,
  parsePosRef as _parsePosRef,
  parsePlacement as _parsePlacement,
  parsePlacementAsFaceRef as _parsePlacementAsFaceRef,
  parseSpatialRef as _parseSpatialRef,
} from '../references/parse-refs.js';
import {
  parseAngleExpr as _parseAngleExpr,
  parseNamedExprArg as _parseNamedExprArg,
  parseListLiteral as _parseListLiteral,
  isNamedArgToken,
  isFontImportStart as _isFontImportStart,
  isShapeImportStart as _isShapeImportStart,
} from '../statements/parse-declarations.js';
import {
  parseTopLevelStatement,
  parseComponentBody as _parseComponentBody,
  parseReturnBody as _parseReturnBody,
} from '../statements/parse-body.js';
import {
  parseBaseUnit,
  parseWorkplane,
} from '../statements/parse-top-level.js';

/**
 * Result of parse, including ast and errors.
 */
export type ParseResult = {
  ast: Program;
  errors: ParseError[];
};

/**
 * Maintains token position, diagnostics, and recovery while grammar modules
 * build the BushSCAD AST. Specialized syntax remains in the expression,
 * reference, object, sketch, and statement parsers called through this facade.
 */
export class Parser {
  private tokens: Token[];
  private pos = 0;
  readonly errors: ParseError[] = [];
  private file: string;
  allowStatementSemicolons = true;

  /**
   * Initializes the `Parser` instance with the values supplied by its caller.
   */
  constructor(tokens: Token[], file: string) {
    this.tokens = tokens;
    this.file = file;
  }

  /**
   * Handles peek in the core flow.
   */
  peek(offset = 0): Token {
    const i = this.pos + offset;
    return i < this.tokens.length
      ? this.tokens[i]
      : this.tokens[this.tokens.length - 1];
  }

  /**
   * Handles advance in the core flow.
   */
  advance(): Token {
    const t = this.peek();
    if (t.kind !== 'EOF') this.pos++;
    return t;
  }

  /**
   * Handles check in the core flow.
   * Fixed parameters avoid allocating a rest array for each token predicate;
   * the current grammar needs at most six alternatives.
   */
  check(
    kind1: TokenKind,
    kind2?: TokenKind,
    kind3?: TokenKind,
    kind4?: TokenKind,
    kind5?: TokenKind,
    kind6?: TokenKind,
  ): boolean {
    const actual = this.peek().kind;
    return (
      actual === kind1 ||
      actual === kind2 ||
      actual === kind3 ||
      actual === kind4 ||
      actual === kind5 ||
      actual === kind6
    );
  }

  /**
   * Handles eat in the core flow.
   */
  eat(
    kind1: TokenKind,
    kind2?: TokenKind,
    kind3?: TokenKind,
    kind4?: TokenKind,
    kind5?: TokenKind,
    kind6?: TokenKind,
  ): Token | null {
    if (this.check(kind1, kind2, kind3, kind4, kind5, kind6)) {
      return this.advance();
    }
    return null;
  }

  /**
   * Asserts the expected behavior in this test.
   */
  expect(kind: TokenKind, msg?: string): Token {
    if (this.check(kind)) return this.advance();
    const t = this.peek();
    this.addError(
      msg ?? `Expected ${kind}, got ${t.kind}('${t.value}')`,
      t.span,
    );
    return { kind, value: '', span: t.span };
  }

  /**
   * Adds error to its owning collection.
   */
  addError(msg: string, span: ASTSourceSpan): void {
    this.errors.push({ message: msg, span });
  }

  /**
   * Handles fail in the core flow.
   */
  fail(msg: string, span?: ASTSourceSpan): never {
    this.addError(msg, span ?? this.peek().span);
    throw new ParseRecovery();
  }

  /**
   * Handles span from in the core flow.
   */
  spanFrom(start: ASTSourceSpan): ASTSourceSpan {
    const prev = this.pos > 0 ? this.tokens[this.pos - 1] : this.tokens[0];
    return {
      file: this.file,
      line: start.line,
      col: start.col,
      endLine: prev.span.endLine,
      endCol: prev.span.endCol,
    };
  }

  /**
   * Handles eat semi in the core flow.
   */
  eatSemi(): void {
    if (!this.allowStatementSemicolons && this.check('SEMICOLON')) return;
    this.eat('SEMICOLON');
  }

  /**
   * Synchronizes to statement with its current source.
   */
  private syncToStatement(): void {
    while (!this.check('EOF', 'RBRACE')) {
      if (this.eat('SEMICOLON')) return;
      const k = this.peek().kind;
      if (
        (
          [
            'VAR',
            'ENV',
            'SKETCH',
            'SURFACE',
            'OBJ',
            'REF',
            'PART',
            'FN',
            'FOR',
            'IF',
            'IMPORT',
            'EXPORT',
            'RETURN',
            'FILLET',
            'CHAMFER',
            'SHELL',
            'DRAFT',
            'THREAD',
            'ANCHOR',
            'PLANE',
            'ROTATE',
            'COLOR',
            'MATERIAL',
            'PLACE',
            'DRAWING',
            'ASSERT',
            'FIT',
            'PATH',
            'SWEEP',
            'PATTERN',
            'MIRROR',
            'TRANSFORM',
            'AT_SIGN',
          ] as string[]
        ).includes(k)
      )
        return;
      if (
        k === 'IDENT' &&
        (this.peek(1).kind === 'ASSIGN' ||
          this.peek(1).kind === 'DOT' ||
          this.isFontImportStart())
      )
        return;
      this.advance();
    }
  }

  /**
   * Handles recover to statement in the core flow.
   */
  recoverToStatement(): void {
    const before = this.pos;
    this.syncToStatement();
    if (this.pos === before && !this.check('EOF', 'RBRACE')) this.advance();
  }

  /**
   * Returns whether the input meets the `font import start` condition.
   */
  isFontImportStart(offset = 0): boolean {
    return _isFontImportStart(this, offset);
  }

  /**
   * Returns whether the input meets the `shape import start` condition.
   */
  isShapeImportStart(offset = 0): boolean {
    return _isShapeImportStart(this, offset);
  }

  // Delegate methods

  /**
   * Parses expr from the supplied source into the core representation.
   */
  parseExpr(): Expr {
    return parseTernary(this);
  }

  /**
   * Parses face ref from ident from the supplied source into the core representation.
   */
  parseFaceRefFromIdent(first: Token): FaceRef {
    return _parseFaceRefFromIdent(this, first);
  }

  /**
   * Parses fn call from ident from the supplied source into the core representation.
   */
  parseFnCallFromIdent(name: Token): FnCallExpr {
    return _parseFnCallFromIdent(this, name);
  }

  /**
   * Parses pos ref from the supplied source into the core representation.
   */
  parsePosRef(): PosRef {
    return _parsePosRef(this);
  }

  /**
   * Parses placement from the supplied source into the core representation.
   */
  parsePlacement(): RepeatableSpatialRef {
    return _parsePlacement(this);
  }

  /**
   * Parses placement as face ref from the supplied source into the core representation.
   */
  parsePlacementAsFaceRef(): FaceRef | FaceRefList {
    return _parsePlacementAsFaceRef(this);
  }

  /**
   * Parses spatial ref from the supplied source into the core representation.
   */
  parseSpatialRef(): FaceRef | PosRef {
    return _parseSpatialRef(this);
  }

  /**
   * Parses angle expr from the supplied source into the core representation.
   */
  parseAngleExpr(): Expr {
    return _parseAngleExpr(this);
  }

  /**
   * Parses named expr arg from the supplied source into the core representation.
   */
  parseNamedExprArg(): [string, Expr] | null {
    return _parseNamedExprArg(this);
  }

  /**
   * Returns whether the input meets the `named arg token` condition.
   */
  isNamedArgToken(token: Token): boolean {
    return isNamedArgToken(token);
  }

  /**
   * Parses list literal from the supplied source into the core representation.
   */
  parseListLiteral(): Literal {
    return _parseListLiteral(this);
  }

  /**
   * Parses component body from the supplied source into the core representation.
   */
  parseComponentBody(): ComponentBody {
    return _parseComponentBody(this);
  }

  /**
   * Parses return body from the supplied source into the core representation.
   */
  parseReturnBody(): ComponentBody {
    return _parseReturnBody(this);
  }

  // Program entry point

  /**
   * Parses program from the supplied source into the core representation.
   */
  parseProgram(): Program {
    const start = this.peek().span;
    let baseUnit: Program['baseUnit'] = null;
    let workplane: Program['workplane'] = null;
    const statements: TopLevelStatement[] = [];

    while (!this.check('EOF')) {
      const item = this.parseProgramItem();
      if (item.kind === 'baseUnit') baseUnit = item.baseUnit;
      else if (item.kind === 'workplane') workplane = item.workplane;
      else if (item.statement) statements.push(item.statement);
    }

    return {
      kind: 'program',
      baseUnit,
      workplane,
      statements,
      span: this.spanFrom(start),
    };
  }

  /**
   * Parses program item from the supplied source into the core representation.
   */
  private parseProgramItem():
    | { kind: 'baseUnit'; baseUnit: Program['baseUnit'] }
    | { kind: 'workplane'; workplane: Program['workplane'] }
    | { kind: 'statement'; statement: TopLevelStatement | null } {
    if (this.check('BASE_UNIT'))
      return { kind: 'baseUnit', baseUnit: parseBaseUnit(this) };
    if (this.check('WORKPLANE'))
      return { kind: 'workplane', workplane: parseWorkplane(this) };
    return { kind: 'statement', statement: this.parseRecoveredTopLevel() };
  }

  /**
   * Parses recovered top level from the supplied source into the core representation.
   */
  private parseRecoveredTopLevel(): TopLevelStatement | null {
    try {
      return parseTopLevelStatement(this);
    } catch (e) {
      if (!(e instanceof ParseRecovery)) throw e;
      const before = this.pos;
      this.recoverToStatement();
      if (this.pos === before && !this.check('EOF')) this.advance();
      return null;
    }
  }
}

/** Tokenizes one source file and parses it into a recoverable program AST. */
export function parse(source: string, filePath: string): ParseResult {
  const tokens = tokenize(source, filePath);
  const parser = new Parser(tokens, filePath);
  try {
    const ast = parser.parseProgram();
    return { ast, errors: parser.errors };
  } catch (e) {
    if (e instanceof ParseRecovery) {
      return {
        ast: {
          kind: 'program',
          baseUnit: null,
          workplane: null,
          statements: [],
          span: { file: filePath, line: 1, col: 1, endLine: 1, endCol: 1 },
        },
        errors: parser.errors,
      };
    }
    throw e;
  }
}
