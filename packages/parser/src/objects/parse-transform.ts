/**
 * @author Aidan Boissonneault
 * @file parse-transform.ts
 * @purpose Parses transform for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  TransformOp,
  TransformStmt,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { tryParseNamedCallArg } from '../expressions/parse-call-arguments.js';
import {
  expectName,
  parseObjectTargetName,
} from '../expressions/parse-names.js';
import { parseAxisRef } from '../references/parse-axis-ref.js';

/**
 * Transform args, including target and operation.
 */
type TransformArgs = {
  target: string | null;
  operation: TransformOp | null;
};
/**
 * Derives `RotateAround` from `Extract<TransformOp, { kind: 'rotate' }>['around']` to preserve its
 * type relationship in the objects layer.
 */
type RotateAround = Extract<TransformOp, { kind: 'rotate' }>['around'];
/**
 * State for translate, including x, y, and z.
 */
type TranslateState = { x: Expr | null; y: Expr | null; z: Expr | null };
/**
 * State for rotate, including angle and around.
 */
type RotateState = { angle: Expr | null; around: RotateAround | null };

/**
 * Parses transform statements in call-style form.
 * Transform now follows the command-call grammar used by newer built-ins, but
 * downstream code still benefits from the compact existing TransformStmt AST.
 */
export function parseTransform(p: Parser): TransformStmt {
  const start = p.peek().span;
  p.advance(); // TRANSFORM

  p.expect('LPAREN', 'transform syntax is transform(target, operation)');
  const args = parseTransformCallArgs(p);
  p.expect('RPAREN');
  p.eatSemi();
  return finalizeTransform(p, args, start);
}

/**
 * Parses transform call args from the supplied source into the objects representation.
 */
function parseTransformCallArgs(p: Parser): TransformArgs {
  const args: TransformArgs = { target: null, operation: null };
  let positional = 0;
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseTransformNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    if (positional === 0) args.target = parseObjectTargetName(p);
    else if (positional === 1) args.operation = parseTransformOperation(p);
    else {
      p.addError(
        'transform() accepts at most 2 positional arguments',
        p.peek().span,
      );
      p.advance();
    }
    positional++;
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Attempts to parse transform named arg and reports whether it succeeds.
 */
function tryParseTransformNamedArg(p: Parser, args: TransformArgs): boolean {
  return tryParseNamedCallArg(p, 'transform', {
    target: () => (args.target = parseObjectTargetName(p)),
    object: () => (args.target = parseObjectTargetName(p)),
    operation: () => (args.operation = parseTransformOperation(p)),
    op: () => (args.operation = parseTransformOperation(p)),
  });
}

/**
 * Parses transform operation from the supplied source into the objects representation.
 */
function parseTransformOperation(p: Parser): TransformOp {
  const opName = expectName(p, 'Expected transform operation').value;
  p.expect('LPAREN');
  const operation = parseTransformOp(p, opName);
  p.expect('RPAREN');
  return operation;
}

/**
 * Parses transform op from the supplied source into the objects representation.
 */
function parseTransformOp(p: Parser, opName: string): TransformOp {
  if (opName === 'translate') return parseTranslateOp(p);
  if (opName === 'rotate') return parseRotateOp(p);
  if (opName === 'scale') return parseScaleOp(p);
  p.fail(`Unknown transform operation '${opName}'`, p.peek().span);
  throw new Error('Unreachable');
}

/**
 * Parses translate op from the supplied source into the objects representation.
 */
function parseTranslateOp(p: Parser): TransformOp {
  const state: TranslateState = { x: null, y: null, z: null };
  let positional = 0;
  while (!p.check('RPAREN', 'EOF')) {
    const named = parseTranslateNamedArg(p);
    if (named) {
      assignTranslateNamedArg(state, named);
    } else {
      parseTranslatePositionalArg(p, state, positional);
      positional++;
    }
    if (!p.eat('COMMA')) break;
  }
  return { kind: 'translate', ...state };
}

/**
 * Handles assign translate named arg in the objects flow.
 */
function assignTranslateNamedArg(
  state: TranslateState,
  named: { axis: 'x' | 'y' | 'z'; value: Expr },
): void {
  state[named.axis] = named.value;
}

/**
 * Parses translate positional arg from the supplied source into the objects representation.
 */
function parseTranslatePositionalArg(
  p: Parser,
  state: TranslateState,
  index: number,
): void {
  if (index === 0) state.x = p.parseExpr();
  else if (index === 1) state.y = p.parseExpr();
  else if (index === 2) state.z = p.parseExpr();
  else {
    const extra = p.parseExpr();
    p.addError(
      'translate() accepts at most 3 positional arguments',
      extra.span,
    );
  }
}

/**
 * Parses translate named arg from the supplied source into the objects representation.
 */
function parseTranslateNamedArg(
  p: Parser,
): { axis: 'x' | 'y' | 'z'; value: Expr } | null {
  if (!p.isNamedArgToken(p.peek()) || p.peek(1).kind !== 'COLON') return null;
  const axisTok = p.advance();
  p.advance(); // COLON
  const axis = axisTok.value;
  const value = p.parseExpr();
  if (axis === 'x' || axis === 'y' || axis === 'z') return { axis, value };
  p.addError(`Unknown translate axis '${axis}'`, axisTok.span);
  return null;
}

/**
 * Parses rotate op from the supplied source into the objects representation.
 */
function parseRotateOp(p: Parser): TransformOp {
  const state: RotateState = { angle: null, around: null };
  let positional = 0;
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseRotateNamedArg(p, state)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parseRotatePositionalArg(p, state, positional);
    positional++;
    if (!p.eat('COMMA')) break;
  }
  return finalizeRotateOp(p, state);
}

/**
 * Attempts to parse rotate named arg and reports whether it succeeds.
 */
function tryParseRotateNamedArg(p: Parser, state: RotateState): boolean {
  return tryParseNamedCallArg(p, 'rotate', {
    angle: () => (state.angle = p.parseExpr()),
    around: () => (state.around = parseAxisRef(p)),
    axis: () => (state.around = parseAxisRef(p)),
  });
}

/**
 * Parses rotate positional arg from the supplied source into the objects representation.
 */
function parseRotatePositionalArg(
  p: Parser,
  state: RotateState,
  index: number,
): void {
  if (index === 0) {
    state.angle = p.parseExpr();
    if (p.eat('AROUND')) state.around = parseAxisRef(p);
  } else if (index === 1) {
    state.around = parseAxisRef(p);
  } else {
    const extra = p.parseExpr();
    p.addError('rotate() accepts at most 2 positional arguments', extra.span);
  }
}

/**
 * Handles finalize rotate op in the objects flow.
 */
function finalizeRotateOp(p: Parser, state: RotateState): TransformOp {
  if (!state.angle) {
    p.addError('rotate() requires angle', p.peek().span);
    state.angle = { kind: 'number', value: 0, span: p.peek().span };
  }
  if (!state.around) {
    p.addError('rotate() requires around axis', p.peek().span);
    state.around = 'z';
  }
  return { kind: 'rotate', angle: state.angle, around: state.around };
}

/**
 * Parses scale op from the supplied source into the objects representation.
 */
function parseScaleOp(p: Parser): TransformOp {
  let factor: Expr | null = null;
  while (!p.check('RPAREN', 'EOF')) {
    if (
      tryParseNamedCallArg(p, 'scale', {
        factor: () => (factor = p.parseExpr()),
      })
    ) {
      // Named handler consumed the value.
    } else {
      factor = p.parseExpr();
    }
    if (!p.eat('COMMA')) break;
  }
  if (!factor) {
    p.addError('scale() requires factor', p.peek().span);
    factor = { kind: 'number', value: 1, span: p.peek().span };
  }
  return { kind: 'scale', factor };
}

/**
 * Handles finalize transform in the objects flow.
 */
function finalizeTransform(
  p: Parser,
  args: TransformArgs,
  start: ASTSourceSpan,
): TransformStmt {
  if (!args.target)
    p.addError('transform() requires target', p.spanFrom(start));
  if (!args.operation) {
    p.addError('transform() requires operation', p.spanFrom(start));
  }
  return {
    kind: 'transform',
    target: args.target ?? '',
    operation: args.operation ?? {
      kind: 'translate',
      x: null,
      y: null,
      z: null,
    },
    span: p.spanFrom(start),
  };
}
