/**
 * @author Aidan Boissonneault
 * @file parse-radial-args.ts
 * @purpose Parses radial args for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  RepeatableSpatialRef,
  RadialCurve,
  RadialCurveKind,
  RadialDirection,
  RadialSections,
  RevolveAxisRef,
} from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
import type { Token } from '../../core/token-types.js';
import { parseAxisRef } from '../../references/parse-axis-ref.js';
import { expectName } from '../../expressions/parse-names.js';
import { parseFaceRefFromIdent } from '../../references/parse-refs.js';

/**
 * Radial args, including axis, angle, length, between, and to.
 */
export type RadialArgs = {
  axis: RevolveAxisRef | null;
  angle: Expr | null;
  length: Expr | null;
  between: { a: RepeatableSpatialRef; b: RepeatableSpatialRef } | null;
  to: RepeatableSpatialRef | null;
  along: string | null;
  curve: RadialCurve;
  direction: RadialDirection;
  start: Expr | null;
  twist: Expr | null;
  taper: Expr | null;
  radius: Expr | null;
  sections: RadialSections;
  from: RepeatableSpatialRef | null;
};

/**
 * Defines the `RadialArgParser` callback contract used by the geometry layer.
 */
type RadialArgParser = (p: Parser, args: RadialArgs) => void;

/**
 * Parses radial extent ref from the supplied source into the geometry representation.
 */
function parseRadialExtentRef(p: Parser): RepeatableSpatialRef {
  if (p.check('AT_SIGN')) return p.parsePlacement();
  return parseFaceRefFromIdent(p, p.expect('IDENT'));
}

/**
 * Reads an IDENT followed by `-IDENT` continuations as one curve name.
 * Radial curves include CSS-style names such as `ease-in-out`, but the lexer
 * keeps `-` as an operator token.
 */
function readHyphenatedName(
  p: Parser,
  first: { value: string; span: ASTSourceSpan },
): { name: string; span: ASTSourceSpan } {
  let name = first.value;
  while (
    p.peek().kind === 'MINUS' &&
    (p.peek(1).kind === 'IDENT' || p.peek(1).kind === 'IN')
  ) {
    p.advance(); // MINUS
    const next = p.advance(); // IDENT
    name += `-${next.value}`;
  }
  return { name, span: p.spanFrom(first.span) };
}

const VALID_CURVE_KINDS = new Set<RadialCurveKind>([
  'natural',
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
]);

/**
 * Parses radial curve from the supplied source into the geometry representation.
 */
function parseRadialCurve(p: Parser): RadialCurve {
  const startTok = p.peek();
  if (startTok.kind !== 'IDENT' && startTok.kind !== 'LINEAR') {
    p.addError(`Expected curve name, got ${startTok.kind}`, startTok.span);
    p.advance();
    return { kind: 'natural', span: startTok.span };
  }
  const first = p.advance();
  const { name, span } = readHyphenatedName(p, first);
  if (name === 'cubic-bezier') {
    p.expect('LPAREN');
    const x1 = p.parseExpr();
    p.expect('COMMA');
    const y1 = p.parseExpr();
    p.expect('COMMA');
    const x2 = p.parseExpr();
    p.expect('COMMA');
    const y2 = p.parseExpr();
    p.expect('RPAREN');
    return {
      kind: 'cubic-bezier',
      x1,
      y1,
      x2,
      y2,
      span: p.spanFrom(first.span),
    };
  }
  if (VALID_CURVE_KINDS.has(name as RadialCurveKind)) {
    return { kind: name as RadialCurveKind, span };
  }
  p.addError(
    `Unknown curve '${name}' - expected natural, linear, ease, ease-in, ease-out, ease-in-out, step-start, step-end, or cubic-bezier(...)`,
    span,
  );
  return { kind: 'natural', span };
}

/**
 * Parses radial direction from the supplied source into the geometry representation.
 */
function parseRadialDirection(p: Parser): RadialDirection {
  const tok = p.peek();
  if (tok.kind === 'IDENT' && (tok.value === 'ccw' || tok.value === 'cw')) {
    p.advance();
    return tok.value;
  }
  p.addError(`Expected direction 'ccw' or 'cw', got '${tok.value}'`, tok.span);
  p.advance();
  return 'ccw';
}

/**
 * Parses radial sections from the supplied source into the geometry representation.
 */
function parseRadialSections(p: Parser): RadialSections {
  if (p.check('AUTO')) {
    p.advance();
    return { kind: 'auto' };
  }
  if (p.peek().kind === 'IDENT' && p.peek().value === 'auto') {
    p.advance();
    return { kind: 'auto' };
  }
  return { kind: 'expr', value: p.parseExpr() };
}

/**
 * Parses between arg from the supplied source into the geometry representation.
 */
function parseBetweenArg(p: Parser): {
  a: RepeatableSpatialRef;
  b: RepeatableSpatialRef;
} {
  p.expect('LPAREN');
  const a = parseRadialExtentRef(p);
  p.expect('COMMA');
  const b = parseRadialExtentRef(p);
  p.expect('RPAREN');
  return { a, b };
}

const RADIAL_ARG_PARSERS: Record<string, RadialArgParser> = {
  axis: (p, args) => {
    args.axis = parseAxisRef(p);
  },
  angle: (p, args) => {
    args.angle = p.parseExpr();
  },
  length: (p, args) => {
    args.length = p.parseExpr();
  },
  between: (p, args) => {
    args.between = parseBetweenArg(p);
  },
  curve: (p, args) => {
    args.curve = parseRadialCurve(p);
  },
  direction: (p, args) => {
    args.direction = parseRadialDirection(p);
  },
  start: (p, args) => {
    args.start = p.parseExpr();
  },
  twist: (p, args) => {
    args.twist = p.parseExpr();
  },
  taper: (p, args) => {
    args.taper = p.parseExpr();
  },
  radius: (p, args) => {
    args.radius = p.parseExpr();
  },
  sections: (p, args) => {
    args.sections = parseRadialSections(p);
  },
  from: (p, args) => {
    args.from = parseRadialExtentRef(p);
  },
  to: (p, args) => {
    args.to = parseRadialExtentRef(p);
  },
  along: (p, args) => {
    args.along = expectName(p).value;
  },
};

const RADIAL_NAMED_ARG_KINDS = new Set<string>([
  'IDENT',
  'BETWEEN',
  'RADIUS',
  'AROUND',
  'FROM',
  'ALONG',
]);

/**
 * Returns whether the input meets the `radial named arg start` condition.
 */
function isRadialNamedArgStart(token: Token, next: Token): boolean {
  return RADIAL_NAMED_ARG_KINDS.has(token.kind) && next.kind === 'COLON';
}

/**
 * Parses the named argument list shared by radial extrude and radial cut.
 * The two radial object operations must stay grammar-compatible while later
 * lowering preserves their distinct operation kinds.
 */
export function parseRadialArgs(
  p: Parser,
  startSpan: ASTSourceSpan,
): RadialArgs {
  const args: RadialArgs = {
    axis: null,
    angle: null,
    length: null,
    between: null,
    to: null,
    along: null,
    curve: { kind: 'natural', span: startSpan },
    direction: 'ccw',
    start: null,
    twist: null,
    taper: null,
    radius: null,
    sections: { kind: 'auto' },
    from: null,
  };

  let positionalMode:
    'axis' | 'extent' | 'from-extent' | 'between' | 'bridge' | null = null;
  const supplied = new Set<RadialPositionalSlot>();
  while (p.eat('COMMA')) {
    const tok = p.peek();
    if (p.check('RPAREN', 'EOF')) break;
    if (isRadialNamedArgStart(tok, p.peek(1))) {
      const argName = p.advance().value;
      p.advance(); // COLON
      const parseArg = RADIAL_ARG_PARSERS[argName];
      if (parseArg) {
        const slot = argName as RadialPositionalSlot;
        if (supplied.has(slot) || radialSlotIsSet(args, slot)) {
          p.addError(
            `radial operation got duplicate argument '${argName}'`,
            tok.span,
          );
          parseArg(p, { ...args });
        } else {
          parseArg(p, args);
          supplied.add(slot);
        }
      } else {
        p.addError(`Unknown radial argument '${argName}'`, p.peek().span);
        p.parseExpr();
      }
      continue;
    }
    positionalMode ??= radialPositionalMode(p, args);
    parseRadialPositionalArg(p, args, positionalMode, supplied);
  }
  return args;
}

/** Chooses the positional overload from the first input after the sketch. */
function radialPositionalMode(
  p: Parser,
  args: RadialArgs,
): 'axis' | 'extent' | 'from-extent' | 'between' | 'bridge' {
  if (args.axis !== null) return 'axis';
  if (args.between !== null) return 'between';
  if (args.to !== null || args.along !== null) return 'bridge';
  return inferRadialPositionalMode(p, args);
}

/** Infers the radial overload from its first unlabeled geometry input. */
function inferRadialPositionalMode(
  p: Parser,
  args: RadialArgs,
): 'axis' | 'extent' | 'from-extent' | 'between' | 'bridge' {
  if (p.check('LPAREN')) return 'between';
  if (isRadialPlacementStart(p)) {
    return args.from !== null || nextRadialArgumentIsPlacement(p)
      ? 'bridge'
      : 'from-extent';
  }
  if (args.from !== null) return 'extent';
  return isWorldAxisToken(p) ? 'axis' : 'extent';
}

/** Recognizes a bare world-axis token before choosing an explicit-axis overload. */
function isWorldAxisToken(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    ['x', 'y', 'z'].includes(p.peek().value) &&
    p.peek(1).kind !== 'DOT'
  );
}

/** Parses the next unlabelled radial slot in its overload's documented order. */
function parseRadialPositionalArg(
  p: Parser,
  args: RadialArgs,
  mode: 'axis' | 'extent' | 'from-extent' | 'between' | 'bridge',
  supplied: Set<RadialPositionalSlot>,
): void {
  const slots = radialPositionalSlots(mode);
  const next = slots.find(
    (slot) => !supplied.has(slot) && !radialSlotIsSet(args, slot),
  );
  if (!next) {
    const value = p.parseExpr();
    p.addError(
      'radial operation received too many positional arguments',
      value.span,
    );
    return;
  }
  RADIAL_ARG_PARSERS[next](p, args);
  supplied.add(next);
}

type RadialPositionalSlot =
  | 'axis'
  | 'angle'
  | 'length'
  | 'between'
  | 'from'
  | 'to'
  | 'along'
  | 'curve'
  | 'direction'
  | 'start'
  | 'twist'
  | 'taper'
  | 'radius'
  | 'sections';

/** Returns the ordered slots supported by each radial call form. */
function radialPositionalSlots(
  mode: 'axis' | 'extent' | 'from-extent' | 'between' | 'bridge',
): RadialPositionalSlot[] {
  const options: RadialPositionalSlot[] = [
    'curve',
    'direction',
    'start',
    'twist',
    'taper',
    'radius',
    'sections',
  ];
  if (mode === 'axis') return ['axis', 'angle', 'length', ...options];
  if (mode === 'extent') return ['angle', 'length', ...options];
  if (mode === 'from-extent') return ['from', 'angle', 'length', ...options];
  if (mode === 'between') return ['between', ...options];
  return ['from', 'to', 'along', ...options];
}

/** Recognizes an authored placement that can select an inferred radial axis. */
function isRadialPlacementStart(p: Parser): boolean {
  return (
    p.check('AT_SIGN') ||
    (p.peek().kind === 'IDENT' && p.peek(1).kind === 'DOT')
  );
}

/** Distinguishes a positional placement bridge from a placement plus extent. */
function nextRadialArgumentIsPlacement(p: Parser): boolean {
  let depth = 0;
  for (let offset = 0; ; offset++) {
    const token = p.peek(offset);
    if (isEndOfRadialArgumentList(token, depth)) return false;
    if (token.kind === 'COMMA' && depth === 0)
      return isPlacementAtOffset(p, offset + 1);
    depth = nextRadialScanDepth(depth, token);
  }
}

/** Checks for an argument-list boundary while scanning nested radial values. */
function isEndOfRadialArgumentList(
  token: ReturnType<Parser['peek']>,
  depth: number,
): boolean {
  return token.kind === 'EOF' || (token.kind === 'RPAREN' && depth === 0);
}

/** Checks whether one scanned argument begins with a placement reference. */
function isPlacementAtOffset(p: Parser, offset: number): boolean {
  const token = p.peek(offset);
  return (
    token.kind === 'AT_SIGN' ||
    (token.kind === 'IDENT' && p.peek(offset + 1).kind === 'DOT')
  );
}

/** Updates nesting depth while scanning ahead to classify a radial overload. */
function nextRadialScanDepth(
  depth: number,
  token: ReturnType<Parser['peek']>,
): number {
  if (token.kind === 'LPAREN' || token.kind === 'LBRACKET') return depth + 1;
  if (token.kind === 'RPAREN' || token.kind === 'RBRACKET') return depth - 1;
  return depth;
}

/** Checks whether a radial slot has already been supplied positionally or by name. */
function radialSlotIsSet(
  args: RadialArgs,
  slot: RadialPositionalSlot,
): boolean {
  const state: Record<RadialPositionalSlot, boolean> = {
    axis: args.axis !== null,
    angle: args.angle !== null,
    length: args.length !== null,
    between: args.between !== null,
    from: args.from !== null,
    to: args.to !== null,
    along: args.along !== null,
    curve: args.curve.kind !== 'natural',
    direction: args.direction !== 'ccw',
    start: args.start !== null,
    twist: args.twist !== null,
    taper: args.taper !== null,
    radius: args.radius !== null,
    sections: args.sections.kind !== 'auto',
  };
  return state[slot];
}
