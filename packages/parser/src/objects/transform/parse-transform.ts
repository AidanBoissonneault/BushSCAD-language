/**
 * @author Aidan Boissonneault
 * @file parse-transform.ts
 * @purpose Parses the outer transform call and dispatches nested operations.
 * @last-edited November 4, 2026
 */

import type { ASTSourceSpan, TransformOp, TransformStmt } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
import {
  claimCallArgument,
  tryParseNamedCallArg,
} from '../../expressions/parse-call-arguments.js';
import {
  expectName,
  parseObjectTargetName,
} from '../../expressions/parse-names.js';
import { parseRotateOp } from './rotate/parse-rotate.js';
import { parseScaleOp } from './scale/parse-scale.js';
import { parseTranslateOp } from './translate/parse-translate.js';

/** State for the outer transform call's target and nested operation. */
type TransformArgs = {
  target: string | null;
  operation: TransformOp | null;
  supplied: Set<'target' | 'operation'>;
};

/**
 * Parses a transform statement, then validates and returns its compact IR form.
 *
 * Why:
 * The outer call owns target binding while each nested transform call owns its
 * own argument grammar.
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

/** Parses positional and named target/operation arguments for transform(). */
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

/** Handles the target/object and operation/op aliases for transform(). */
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

/** Assigns either outer transform slot once and reports duplicate values. */
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

/** Parses a nested translate(), rotate(), or scale() operation. */
function parseTransformOperation(p: Parser): TransformOp {
  const operationName = expectName(p, 'Expected transform operation').value;
  p.expect('LPAREN');
  const operation = parseTransformOp(p, operationName);
  p.expect('RPAREN');
  return operation;
}

/** Dispatches supported transform operations to their feature parsers. */
function parseTransformOp(p: Parser, operationName: string): TransformOp {
  if (operationName === 'translate') return parseTranslateOp(p);
  if (operationName === 'rotate') return parseRotateOp(p);
  if (operationName === 'scale') return parseScaleOp(p);
  p.fail(`Unknown transform operation '${operationName}'`, p.peek().span);
  throw new Error('Unreachable');
}

/** Builds the transform statement and reports missing outer arguments. */
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
