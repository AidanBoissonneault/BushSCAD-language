/**
 * @author Aidan Boissonneault
 * @file parse-mirror.ts
 * @purpose Parses mirror for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type { FaceRef, MirrorPlane, MirrorStmt } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  claimCallArgument,
  tryParseNamedCallArg,
} from '../expressions/parse-call-arguments.js';
import { parseObjectTargetName } from '../expressions/parse-names.js';

/**
 * Mirror args, including target and across.
 */
type MirrorArgs = {
  target: string | null;
  across: MirrorPlane | null;
  supplied: Set<'target' | 'across'>;
};

/**
 * Parses mirror statements in call-style form.
 * Mirror now follows the same `command(target, value)` convention as other
 * built-ins, while the evaluator still consumes the established MirrorStmt AST.
 */
export function parseMirror(p: Parser): MirrorStmt {
  const start = p.peek().span;
  p.advance(); // MIRROR

  p.expect('LPAREN', 'mirror syntax is mirror(target, across)');
  const args = parseMirrorCallArgs(p);
  p.expect('RPAREN');
  p.requireSemi();
  return finalizeMirror(p, args, start);
}

/**
 * Parses mirror call args from the supplied source into the objects representation.
 */
function parseMirrorCallArgs(p: Parser): MirrorArgs {
  const args: MirrorArgs = {
    target: null,
    across: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseMirrorNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    if (!args.supplied.has('target')) {
      const span = p.peek().span;
      assignMirrorArg(p, args, 'target', parseObjectTargetName(p), span);
    } else if (!args.supplied.has('across')) {
      const span = p.peek().span;
      assignMirrorArg(p, args, 'across', parseMirrorPlane(p), span);
    } else {
      p.addError(
        'mirror() accepts at most 2 positional arguments',
        p.peek().span,
      );
      p.advance();
    }
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Attempts to parse mirror named arg and reports whether it succeeds.
 */
function tryParseMirrorNamedArg(p: Parser, args: MirrorArgs): boolean {
  return tryParseNamedCallArg(p, 'mirror', {
    target: (span) =>
      assignMirrorArg(p, args, 'target', parseObjectTargetName(p), span),
    object: (span) =>
      assignMirrorArg(p, args, 'target', parseObjectTargetName(p), span),
    across: (span) =>
      assignMirrorArg(p, args, 'across', parseMirrorPlane(p), span),
    plane: (span) =>
      assignMirrorArg(p, args, 'across', parseMirrorPlane(p), span),
  });
}

/** Stores one mirror slot once and reports duplicate positional or named values. */
function assignMirrorArg(
  p: Parser,
  args: MirrorArgs,
  slot: 'target' | 'across',
  value: string | MirrorPlane,
  span: MirrorStmt['span'],
): void {
  if (!claimCallArgument(p, 'mirror', slot, args.supplied, span)) return;
  if (slot === 'target') args.target = value as string;
  else args.across = value as MirrorPlane;
}

/**
 * Parses mirror plane from the supplied source into the objects representation.
 */
function parseMirrorPlane(p: Parser): MirrorPlane {
  if (p.eat('PLANE')) {
    p.expect('LPAREN');
    const name = p.expect('IDENT').value;
    p.expect('RPAREN');
    return { kind: 'named', name };
  }

  if (p.check('IDENT')) {
    const v = p.peek().value;
    if (v === 'X' || v === 'Y' || v === 'Z') {
      p.advance();
      return { kind: 'world', axis: v };
    }
    const firstTok = p.advance();
    const ref = p.parseFaceRefFromIdent(firstTok) as FaceRef;
    return { kind: 'faceRef', ref };
  }

  p.fail(`Expected mirror plane reference`, p.peek().span);
  throw new Error('Unreachable');
}

/**
 * Handles finalize mirror in the objects flow.
 */
function finalizeMirror(
  p: Parser,
  args: MirrorArgs,
  start: MirrorStmt['span'],
): MirrorStmt {
  if (!args.target) p.addError('mirror() requires target', p.spanFrom(start));
  if (!args.across)
    p.addError('mirror() requires across plane', p.spanFrom(start));
  return {
    kind: 'mirror',
    target: args.target ?? '',
    across: args.across ?? { kind: 'world', axis: 'X' },
    span: p.spanFrom(start),
  };
}
