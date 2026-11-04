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
import type { Parser } from '../../core/parser.js';
import {
  claimCallArgument,
  tryParseNamedCallArg,
} from '../../expressions/parse-call-arguments.js';
import {
  expectName,
  parseObjectTargetName,
} from '../../expressions/parse-names.js';
import { parseAxisRef } from '../../references/parse-axis-ref.js';

/**
 * Transform args, including target and operation.
 */
type TransformArgs = {
  target: string | null;
  operation: TransformOp | null;
  supplied: Set<'target' | 'operation'>;
};
/**
 * Derives `RotateAround` from `Extract<TransformOp, { kind: 'rotate' }>['around']` to preserve its
 * type relationship in the objects layer.
 */
type RotateAround = Extract<TransformOp, { kind: 'rotate' }>['around'];
/**
 * State for translate, including x, y, and z.
 */
type TranslateState = {
  x: Expr | null;
  y: Expr | null;
  z: Expr | null;
  supplied: Set<'x' | 'y' | 'z'>;
};
/**
 * State for rotate, including angle and around.
 */
type RotateState = {
  angle: Expr | null;
  around: RotateAround | null;
  supplied: Set<'angle' | 'around'>;
};

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
  const args: TransformArgs = {
    target: null,
    operation: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseTransformNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    if (!args.supplied.has('target')) {
      const span = p.peek().span;
      assignTransformArg(p, args, 'target', parseObjectTargetName(p), span);
    } else if (!args.supplied.has('operation')) {
      const span = p.peek().span;
      assignTransformArg(
        p,
        args,
        'operation',
        parseTransformOperation(p),
        span,
      );
    } else {
      p.addError(
        'transform() accepts at most 2 positional arguments',
        p.peek().span,
      );
      p.advance();
    }
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Attempts to parse transform named arg and reports whether it succeeds.
 */
function tryParseTransformNamedArg(p: Parser, args: TransformArgs): boolean {
  return tryParseNamedCallArg(p, 'transform', {
    target: (span) =>
      assignTransformArg(p, args, 'target', parseObjectTargetName(p), span),
    object: (span) =>
      assignTransformArg(p, args, 'target', parseObjectTargetName(p), span),
    operation: (span) =>
      assignTransformArg(
        p,
        args,
        'operation',
        parseTransformOperation(p),
        span,
      ),
    op: (span) =>
      assignTransformArg(
        p,
        args,
        'operation',
        parseTransformOperation(p),
        span,
      ),
  });
}

/** Stores a transform target or operation once and reports duplicate inputs. */
function assignTransformArg(
  p: Parser,
  args: TransformArgs,
  slot: 'target' | 'operation',
  value: string | TransformOp,
  span: ASTSourceSpan,
): void {
  if (!claimCallArgument(p, 'transform', slot, args.supplied, span)) return;
  if (slot === 'target') args.target = value as string;
  else args.operation = value as TransformOp;
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
  const state: TranslateState = {
    x: null,
    y: null,
    z: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    const named = parseTranslateNamedArg(p);
    if (named?.axis) {
      assignTranslateNamedArg(p, state, named);
    } else if (named) {
      // The named parser consumed and reported the invalid axis.
    } else {
      parseTranslatePositionalArg(p, state);
    }
    if (!p.eat('COMMA')) break;
  }
  return { kind: 'translate', x: state.x, y: state.y, z: state.z };
}

/**
 * Handles assign translate named arg in the objects flow.
 */
function assignTranslateNamedArg(
  p: Parser,
  state: TranslateState,
  named: { axis: 'x' | 'y' | 'z'; value: Expr; span: ASTSourceSpan },
): void {
  if (state.supplied.has(named.axis)) {
    p.addError(
      `translate() got duplicate argument '${named.axis}'`,
      named.span,
    );
    return;
  }
  state[named.axis] = named.value;
  state.supplied.add(named.axis);
}

/**
 * Parses translate positional arg from the supplied source into the objects representation.
 */
function parseTranslatePositionalArg(p: Parser, state: TranslateState): void {
  const axis = (['x', 'y', 'z'] as const).find(
    (candidate) => !state.supplied.has(candidate),
  );
  if (!axis) {
    const extra = p.parseExpr();
    p.addError(
      'translate() accepts at most 3 positional arguments',
      extra.span,
    );
    return;
  }
  state[axis] = p.parseExpr();
  state.supplied.add(axis);
}

/**
 * Parses translate named arg from the supplied source into the objects representation.
 */
function parseTranslateNamedArg(
  p: Parser,
):
  | { axis: 'x' | 'y' | 'z'; value: Expr; span: ASTSourceSpan }
  | { axis: null }
  | null {
  if (!p.isNamedArgToken(p.peek()) || p.peek(1).kind !== 'COLON') return null;
  const axisTok = p.advance();
  p.advance(); // COLON
  const axis = axisTok.value;
  const value = p.parseExpr();
  if (axis === 'x' || axis === 'y' || axis === 'z') {
    return { axis, value, span: axisTok.span };
  }
  p.addError(`Unknown translate axis '${axis}'`, axisTok.span);
  return { axis: null };
}

/**
 * Parses rotate op from the supplied source into the objects representation.
 */
function parseRotateOp(p: Parser): TransformOp {
  const state: RotateState = {
    angle: null,
    around: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseRotateNamedArg(p, state)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parseRotatePositionalArg(p, state);
    if (!p.eat('COMMA')) break;
  }
  return finalizeRotateOp(p, state);
}

/**
 * Attempts to parse rotate named arg and reports whether it succeeds.
 */
function tryParseRotateNamedArg(p: Parser, state: RotateState): boolean {
  return tryParseNamedCallArg(p, 'rotate', {
    angle: (span) => assignRotateArg(p, state, 'angle', p.parseExpr(), span),
    around: (span) =>
      assignRotateArg(p, state, 'around', parseAxisRef(p), span),
    axis: (span) => assignRotateArg(p, state, 'around', parseAxisRef(p), span),
  });
}

/** Stores one rotate slot once so positional values fill only open slots. */
function assignRotateArg(
  p: Parser,
  state: RotateState,
  slot: 'angle' | 'around',
  value: Expr | RotateAround,
  span: ASTSourceSpan,
): void {
  if (state.supplied.has(slot)) {
    p.addError(`rotate() got duplicate argument '${slot}'`, span);
    return;
  }
  state.supplied.add(slot);
  if (slot === 'angle') state.angle = value as Expr;
  else state.around = value as RotateAround;
}

/**
 * Parses rotate positional arg from the supplied source into the objects representation.
 */
function parseRotatePositionalArg(p: Parser, state: RotateState): void {
  if (!state.supplied.has('angle')) {
    const span = p.peek().span;
    const angle = p.parseExpr();
    assignRotateArg(p, state, 'angle', angle, span);
    if (p.eat('AROUND')) {
      const aroundSpan = p.peek().span;
      assignRotateArg(p, state, 'around', parseAxisRef(p), aroundSpan);
    }
  } else if (!state.supplied.has('around')) {
    const aroundSpan = p.peek().span;
    assignRotateArg(p, state, 'around', parseAxisRef(p), aroundSpan);
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
  let supplied = false;
  while (!p.check('RPAREN', 'EOF')) {
    if (
      tryParseNamedCallArg(p, 'scale', {
        factor: (span) => {
          const value = p.parseExpr();
          if (supplied)
            p.addError("scale() got duplicate argument 'factor'", span);
          else factor = value;
          supplied = true;
        },
      })
    ) {
      // Named handler consumed the value.
    } else {
      const value = p.parseExpr();
      if (supplied)
        p.addError("scale() got duplicate argument 'factor'", value.span);
      else factor = value;
      supplied = true;
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
