/**
 * @author Aidan Boissonneault
 * @file parse-modifiers.ts
 * @purpose Parses modifiers for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  FilletDetail,
  ChamferDetail,
  ShellDetail,
  DraftDetail,
  PlaneDecl,
  AnchorDecl,
  RepeatableFaceRef,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseObjectTargetName } from '../expressions/parse-names.js';
import {
  parseAndClaimCallArgument,
  tryParseNamedCallArg,
} from '../expressions/parse-call-arguments.js';

/**
 * Parses fillet from the supplied source into the statements representation.
 */
export function parseFillet(p: Parser): FilletDetail {
  const start = p.peek().span;
  p.advance(); // FILLET
  p.expect('LPAREN', 'Use fillet(@target, radius)');
  const { target, value: radius } = parseDetailCallArgs(p, 'fillet', 'radius');
  p.expect('RPAREN');
  p.eatSemi();
  return { kind: 'fillet', target, radius, span: p.spanFrom(start) };
}

/**
 * Parses chamfer from the supplied source into the statements representation.
 */
export function parseChamfer(p: Parser): ChamferDetail {
  const start = p.peek().span;
  p.advance(); // CHAMFER
  p.expect('LPAREN', 'Use chamfer(@target, offset)');
  const { target, value: offset } = parseDetailCallArgs(p, 'chamfer', 'offset');
  p.expect('RPAREN');
  p.eatSemi();
  return { kind: 'chamfer', target, offset, span: p.spanFrom(start) };
}

type DetailCallName = 'fillet' | 'chamfer' | 'draft';

/** Mutable state for the target and required value of one detail modifier. */
type DetailCallArgs = {
  target: RepeatableFaceRef | null;
  value: Expr | null;
  supplied: Set<string>;
};

/** Parses a detail target and its required value from positional or labeled slots. */
function parseDetailCallArgs(
  p: Parser,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): { target: RepeatableFaceRef; value: import('@bushscad/ir').Expr } {
  const args: DetailCallArgs = {
    target: null,
    value: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (!parseDetailNamedArg(p, args, operation, valueName))
      parseDetailPositionalArg(p, args, operation, valueName);
    if (!p.eat('COMMA')) break;
  }

  return finalizeDetailCallArgs(p, args, operation, valueName);
}

/** Parses a labeled target/value pair for a body detail modifier. */
function parseDetailNamedArg(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): boolean {
  return tryParseNamedCallArg(p, operation, {
    target: (span) => parseDetailTargetNamedArg(p, args, operation, span),
    object: (span) => parseDetailTargetNamedArg(p, args, operation, span),
    [valueName]: (span) => {
      args.value =
        parseAndClaimCallArgument(
          p,
          operation,
          valueName,
          args.supplied,
          span,
          () => p.parseExpr(),
        ) ?? args.value;
    },
  });
}

/** Parses and stores a named face-selection target once. */
function parseDetailTargetNamedArg(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  span: Expr['span'],
): void {
  args.target =
    parseAndClaimCallArgument(p, operation, 'target', args.supplied, span, () =>
      parseModifierTarget(p, operation),
    ) ?? args.target;
}

/** Fills the next unassigned positional slot of a detail modifier. */
function parseDetailPositionalArg(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): void {
  if (!args.supplied.has('target')) {
    args.target = parseModifierTarget(p, operation);
    args.supplied.add('target');
  } else if (!args.supplied.has(valueName)) {
    args.value = p.parseExpr();
    args.supplied.add(valueName);
  } else {
    const extra = p.parseExpr();
    p.addError(
      `${operation}() accepts only a target and ${valueName}`,
      extra.span,
    );
  }
}

/** Supplies required placeholders after reporting missing detail call inputs. */
function finalizeDetailCallArgs(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): { target: RepeatableFaceRef; value: Expr } {
  const span = p.peek().span;
  if (!args.target) {
    p.addError(`${operation}() requires a target`, span);
    args.target = { kind: 'faceRef', chain: [], span };
  }
  if (!args.value) {
    p.addError(`${operation}() requires ${valueName}`, span);
    args.value = { kind: 'number', value: 0, span };
  }
  return { target: args.target, value: args.value };
}

/**
 * Parses a function-style modifier target.
 *
 * Modifiers now consume the same selectable `@` references as placement and
 * anchors, but their target must stay a feature reference rather than an
 * offset placement.
 */
function parseModifierTarget(
  p: Parser,
  modifierName: DetailCallName,
): RepeatableFaceRef {
  if (!p.check('AT_SIGN') && !p.check('LBRACKET')) {
    p.fail(`${modifierName}(...) expects an @ reference target`, p.peek().span);
  }
  const target = p.parsePlacement();
  if (target.kind === 'faceRef' || target.kind === 'faceRefList') return target;
  p.addError(
    `${modifierName}(...) target cannot include placement offsets`,
    target.span,
  );
  return Array.isArray(target.anchor)
    ? { kind: 'faceRef', chain: [], span: target.span }
    : target.anchor;
}

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

/**
 * Parses draft from the supplied source into the statements representation.
 */
export function parseDraft(p: Parser): DraftDetail {
  const start = p.peek().span;
  p.advance(); // DRAFT
  p.expect('LPAREN', 'Use draft(@target.face, angle)');
  const { target, value: angle } = parseDetailCallArgs(p, 'draft', 'angle');
  p.expect('RPAREN');
  p.eatSemi();
  return { kind: 'draft', target, angle, span: p.spanFrom(start) };
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

/**
 * Parses plane from the supplied source into the statements representation.
 */
export function parsePlane(p: Parser): PlaneDecl {
  const start = p.peek().span;
  p.advance(); // PLANE
  const name = p.expect('IDENT').value;
  p.expect('ASSIGN');
  p.expect('OFFSET');
  p.expect('LPAREN');
  const offset = p.parseExpr();
  p.expect('COMMA');
  const from = p.parseSpatialRef();
  p.expect('RPAREN');
  p.eatSemi();
  return { kind: 'plane', name, offset, from, span: p.spanFrom(start) };
}

/**
 * Parses anchor from the supplied source into the statements representation.
 */
export function parseAnchor(p: Parser): AnchorDecl {
  p.fail(
    `anchor declarations have been removed; use @name = @target`,
    p.peek().span,
  );
}

/**
 * Parses an `@name = @target` spatial alias or component anchor declaration.
 *
 * The `@` declaration syntax replaces both named anchors and exact spatial
 * alias overrides while keeping their evaluator representation compact.
 */
export function parseSpatialAnchor(p: Parser): AnchorDecl {
  const start = p.peek().span;
  p.expect('AT_SIGN');
  let name = p.expect('IDENT').value;
  while (p.eat('DOT')) {
    name += `.${p.expect('IDENT').value}`;
  }
  p.expect('ASSIGN');
  const point = p.parseSpatialRef();
  p.eatSemi();
  return { kind: 'anchor', name, point, span: p.spanFrom(start) };
}
