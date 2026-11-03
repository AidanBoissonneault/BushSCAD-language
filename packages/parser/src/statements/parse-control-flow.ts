/**
 * @author Aidan Boissonneault
 * @file parse-control-flow.ts
 * @purpose Parses control flow for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type {
  FnDecl,
  FnParam,
  ForStatement,
  IfStatement,
  CallStatement,
  ReturnStatement,
  ComponentBody,
  GridIter,
  Expr,
  WithinClause,
  WithinDim,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseOrderedExprArgs } from '../expressions/parse-ordered-args.js';
import { parseFaceRefFromIdent } from '../references/parse-refs.js';

/**
 * Parses a geometry function declaration and rejects ambiguous parameter names.
 *
 * Why:
 * Function arguments bind by parameter name, so duplicate declarations cannot
 * be assigned distinct values reliably by the evaluator.
 */
export function parseFn(p: Parser, exported: boolean): FnDecl {
  const start = p.peek().span;
  p.advance(); // FN
  const name = p.expect('IDENT').value;
  const params = parseFunctionParameters(p);
  const body = p.parseComponentBody();
  return { kind: 'fn', name, params, body, exported, span: p.spanFrom(start) };
}

/**
 * Parses optional function parameters and reports duplicate names.
 *
 * Why: keeping parameter-list recovery together lets `parseFn` focus on the
 * declaration lifecycle while preserving parser diagnostics and token flow.
 */
function parseFunctionParameters(p: Parser): FnParam[] {
  if (!p.eat('LPAREN')) {
    p.addError(`Expected '(' after function name`, p.peek().span);
    return [];
  }
  return parseFunctionParameterList(p);
}

/**
 * Parses parameters until the closing parenthesis or a recoverable syntax error.
 */
function parseFunctionParameterList(p: Parser): FnParam[] {
  const params: FnParam[] = [];
  const names = new Set<string>();
  while (!p.check('RPAREN', 'EOF')) {
    const parameter = parseFunctionParameter(p, names);
    if (!parameter) break;
    params.push(parameter);
    if (!p.eat('COMMA')) break;
  }
  p.expect('RPAREN');
  return params;
}

/**
 * Parses one parameter and reports duplicate names at their source token.
 */
function parseFunctionParameter(p: Parser, names: Set<string>): FnParam | null {
  if (!p.check('IDENT')) {
    p.addError(
      `Expected parameter name, got '${p.peek().value || p.peek().kind}'`,
      p.peek().span,
    );
    return null;
  }
  const parameter = p.expect('IDENT');
  const name = parameter.value;
  if (names.has(name)) {
    p.addError(`Duplicate function parameter '${name}'`, parameter.span);
  } else {
    names.add(name);
  }
  return {
    name,
    default: p.eat('COLON') ? p.parseExpr() : null,
  };
}

/**
 * Parses for from the supplied source into the statements representation.
 */
export function parseFor(p: Parser): ForStatement {
  const start = p.peek().span;
  p.advance(); // FOR

  let binding: string | [string, string];
  if (p.eat('LPAREN')) {
    const a = p.expect('IDENT');
    p.expect('COMMA');
    const b = p.expect('IDENT');
    p.expect('RPAREN');
    if (a.value === b.value) {
      p.addError(`Duplicate loop binding '${b.value}'`, b.span);
    }
    binding = [a.value, b.value];
  } else {
    binding = p.expect('IDENT').value;
  }

  p.expect('IN');
  const iterator = parseIterator(p);
  if (
    Array.isArray(binding) &&
    (iterator.kind === 'range' || iterator.kind === 'radial')
  ) {
    p.addError(`${iterator.kind} loops accept only one binding name`, start);
  }
  const where: Expr | null = p.eat('WHERE') ? p.parseExpr() : null;
  const within: WithinClause | null = p.check('WITHIN')
    ? parseWithinClause(p)
    : null;
  const body = p.parseComponentBody();
  return {
    kind: 'for',
    binding,
    iterator,
    where,
    within,
    body,
    span: p.spanFrom(start),
  };
}

/**
 * Parses a `within` clause: `within <dim>` for range loops, or
 * `within(<dim>, <dim>)` for grid loops.
 */
function parseWithinClause(p: Parser): WithinClause {
  const start = p.peek().span;
  p.advance(); // WITHIN
  const dims: WithinDim[] = [];
  if (p.eat('LPAREN')) {
    while (!p.check('RPAREN', 'EOF')) {
      dims.push(parseWithinDim(p));
      if (!p.eat('COMMA')) break;
    }
    p.expect('RPAREN');
  } else {
    dims.push(parseWithinDim(p));
  }
  return { dims, span: p.spanFrom(start) };
}

/**
 * Parses one `within` target — a face-dimension reference such as
 * `base.top.width`, or a plain numeric expression.
 */
function parseWithinDim(p: Parser): WithinDim {
  const start = p.peek().span;
  if (p.check('IDENT') && p.peek(1).kind === 'DOT') {
    const ref = parseFaceRefFromIdent(p, p.advance());
    const last = ref.chain[ref.chain.length - 1];
    if (
      ref.chain.length >= 2 &&
      last.kind === 'name' &&
      (last.value === 'width' ||
        last.value === 'height' ||
        last.value === 'length')
    ) {
      return {
        kind: 'faceDim',
        ref: { ...ref, chain: ref.chain.slice(0, -1) },
        dim: last.value === 'length' ? 'height' : last.value,
        span: p.spanFrom(start),
      };
    }
    return { kind: 'expr', expr: ref, span: p.spanFrom(start) };
  }
  return { kind: 'expr', expr: p.parseExpr(), span: p.spanFrom(start) };
}

/**
 * Parses iterator from the supplied source into the statements representation.
 */
function parseIterator(p: Parser): ForStatement['iterator'] {
  const t = p.peek();
  if (t.kind === 'RANGE') return parseRangeIterator(p);
  if (t.kind === 'GRID') return parseGridIterator(p);
  if (t.kind === 'RADIAL') return parseRadialIterator(p);
  if (t.kind === 'ENUMERATE') return parseEnumerateIterator(p);
  return { kind: 'list', expr: p.parseExpr() };
}

/**
 * Parses range iterator from the supplied source into the statements representation.
 */
function parseRangeIterator(p: Parser): ForStatement['iterator'] {
  p.advance();
  p.expect('LPAREN');
  if (currentArgListHasNamedArg(p)) {
    const args = parseOrderedExprArgs(p, 'range', [
      { name: 'start' },
      { name: 'end', aliases: ['count'], required: true },
      { name: 'step' },
    ]);
    p.expect('RPAREN');
    return {
      kind: 'range',
      start: args.start,
      end: args.end!,
      step: args.step,
    };
  }
  const first = p.parseExpr();
  if (p.eat('COMMA')) {
    const second = p.parseExpr();
    if (p.eat('COMMA')) {
      const step = p.parseExpr();
      p.expect('RPAREN');
      return { kind: 'range', start: first, end: second, step };
    }
    p.expect('RPAREN');
    return { kind: 'range', start: first, end: second };
  }
  p.expect('RPAREN');
  return { kind: 'range', end: first };
}

/**
 * Parses grid iterator from the supplied source into the statements representation.
 */
function parseGridIterator(p: Parser): GridIter {
  p.advance();
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'grid', [
    { name: 'cols', required: true },
    { name: 'rows', required: true },
    { name: 'spacing' },
    { name: 'spacingX', aliases: ['spacing_x'], positional: false },
    { name: 'spacingY', aliases: ['spacing_y'], positional: false },
  ]);
  p.expect('RPAREN');
  return {
    kind: 'grid',
    cols: args.cols!,
    rows: args.rows!,
    spacing: args.spacing,
    spacingX: args.spacingX,
    spacingY: args.spacingY,
  };
}

/**
 * Parses radial iterator from the supplied source into the statements representation.
 */
function parseRadialIterator(p: Parser): ForStatement['iterator'] {
  p.advance();
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'radial', [
    { name: 'count', required: true },
    { name: 'start' },
    { name: 'sweep' },
  ]);
  p.expect('RPAREN');
  return {
    kind: 'radial',
    count: args.count!,
    start: args.start,
    sweep: args.sweep,
  };
}

/**
 * Returns the current arg list has named arg from the owning state.
 */
function currentArgListHasNamedArg(p: Parser): boolean {
  let depth = 0;
  for (let offset = 0; ; offset++) {
    const current = p.peek(offset);
    if (current.kind === 'EOF') return false;
    if (current.kind === 'LPAREN') depth++;
    if (current.kind === 'RPAREN') {
      if (depth === 0) return false;
      depth--;
    }
    if (
      depth === 0 &&
      p.isNamedArgToken(current) &&
      p.peek(offset + 1).kind === 'COLON'
    ) {
      return true;
    }
  }
}

/**
 * Parses enumerate iterator from the supplied source into the statements representation.
 */
function parseEnumerateIterator(p: Parser): ForStatement['iterator'] {
  p.advance();
  p.expect('LPAREN');
  const expr = p.parseExpr();
  p.expect('RPAREN');
  return { kind: 'enumerate', expr };
}

/**
 * Parses if from the supplied source into the statements representation.
 */
export function parseIf(p: Parser): IfStatement {
  const start = p.peek().span;
  p.advance(); // IF
  const condition = p.parseExpr();
  const then = p.parseComponentBody();
  const else_: ComponentBody | null = p.eat('ELSE')
    ? p.parseComponentBody()
    : null;
  return { kind: 'if', condition, then, else: else_, span: p.spanFrom(start) };
}

/**
 * Parses call statement from the supplied source into the statements representation.
 */
export function parseCallStatement(p: Parser): CallStatement {
  const start = p.peek().span;
  const name = p.expect('IDENT');
  const call = p.parseFnCallFromIdent(name);
  p.eatSemi();
  return { kind: 'callStmt', call, span: p.spanFrom(start) };
}

/**
 * Parses return from the supplied source into the statements representation.
 */
export function parseReturn(p: Parser): ReturnStatement {
  const start = p.peek().span;
  p.advance(); // RETURN
  const body = p.parseReturnBody();
  p.eatSemi();
  return { kind: 'return', body, span: p.spanFrom(start) };
}
