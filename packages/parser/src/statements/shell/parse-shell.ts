/** Parses shell targets, thickness, and optional open faces. */

import type { Expr, ShellDetail } from '@bushscad/ir';

import type { Parser } from '../../core/parser.js';

import { parseObjectTargetName } from '../../expressions/parse-names.js';

import {
  parseAndClaimCallArgument,
  tryParseNamedCallArg,
} from '../../expressions/parse-call-arguments.js';

/**
 * Parses shell from the supplied source into the statements representation.
 */
export function parseShell(p: Parser): ShellDetail {
  const start = p.peek().span;
  p.advance(); // SHELL
  p.expect('LPAREN', 'Use shell(target, thickness, open: face)');
  const args = parseShellCallArgs(p);
  if (args.target === null) {
    p.addError('shell() requires a target', p.peek().span);
    args.target = '';
  }
  if (args.thickness === null) {
    p.addError('shell() requires thickness', p.peek().span);
    args.thickness = { kind: 'number', value: 0, span: p.peek().span };
  }
  p.expect('RPAREN');
  p.eatSemi();
  return {
    kind: 'shell',
    target: args.target,
    thickness: args.thickness,
    openFaces: args.openFaces,
    span: p.spanFrom(start),
  };
}

/** Mutable argument state for shell's target, thickness, and optional openings. */
type ShellCallArgs = {
  target: string | null;
  thickness: Expr | null;
  openFaces: string[];
  supplied: Set<string>;
};

/** Parses shell's mixed positional and labeled argument list. */
function parseShellCallArgs(p: Parser): ShellCallArgs {
  const args: ShellCallArgs = {
    target: null,
    thickness: null,
    openFaces: [],
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (!parseShellNamedArg(p, args)) parseShellPositionalArg(p, args);
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/** Parses one named shell slot through the shared optional-label dispatcher. */
function parseShellNamedArg(p: Parser, args: ShellCallArgs): boolean {
  return tryParseNamedCallArg(p, 'shell', {
    target: (span) => parseShellTargetArg(p, args, span),
    object: (span) => parseShellTargetArg(p, args, span),
    thickness: (span) => {
      const value = parseAndClaimCallArgument(
        p,
        'shell',
        'thickness',
        args.supplied,
        span,
        () => p.parseExpr(),
      );
      if (value !== undefined) args.thickness = value;
    },
    open: (span) => parseShellOpenArg(p, args, span),
    faces: (span) => parseShellOpenArg(p, args, span),
  });
}

/** Parses and stores the shell target once. */
function parseShellTargetArg(
  p: Parser,
  args: ShellCallArgs,
  span: Expr['span'],
): void {
  const target = parseAndClaimCallArgument(
    p,
    'shell',
    'target',
    args.supplied,
    span,
    () => parseObjectTargetName(p),
  );
  if (target !== undefined) args.target = target;
}

/** Parses and appends the optional shell opening faces. */
function parseShellOpenArg(
  p: Parser,
  args: ShellCallArgs,
  span: Expr['span'],
): void {
  const value = parseAndClaimCallArgument(
    p,
    'shell',
    'open',
    args.supplied,
    span,
    () => p.parseExpr(),
  );
  if (value !== undefined) args.openFaces.push(...parseOpenFaceNames(p, value));
}

/** Fills the next unassigned positional shell slot. */
function parseShellPositionalArg(p: Parser, args: ShellCallArgs): void {
  if (!args.supplied.has('target')) {
    args.target = parseObjectTargetName(p);
    args.supplied.add('target');
  } else if (!args.supplied.has('thickness')) {
    args.thickness = p.parseExpr();
    args.supplied.add('thickness');
  } else if (!args.supplied.has('open')) {
    args.openFaces.push(...parseOpenFaceNames(p, p.parseExpr()));
    args.supplied.add('open');
  } else {
    const extra = p.parseExpr();
    p.addError(
      'shell() accepts a target, thickness, and optional open faces',
      extra.span,
    );
  }
}

/** Converts one open-face expression or list into face label strings. */
function parseOpenFaceNames(
  p: Parser,
  value: import('@bushscad/ir').Expr,
): string[] {
  const values = value.kind === 'list' ? value.items : [value];
  const faces: string[] = [];
  for (const item of values) {
    if (item.kind === 'identifier') faces.push(item.name);
    else if (item.kind === 'string') faces.push(item.value);
    else p.addError('shell() open faces must be face labels', item.span);
  }
  return faces;
}
