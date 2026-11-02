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
import type { Parser } from '../core/parser.js';
import type { Token } from '../core/token-types.js';
import { parseAxisRef } from '../references/parse-axis-ref.js';
import { expectName } from '../expressions/parse-names.js';
import { parseFaceRefFromIdent } from '../references/parse-refs.js';

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

  while (p.eat('COMMA')) {
    const tok = p.peek();
    if (!isRadialNamedArgStart(tok, p.peek(1))) {
      p.addError(
        `Expected named argument, got ${tok.kind}('${tok.value}')`,
        tok.span,
      );
      p.advance();
      continue;
    }
    const argName = p.advance().value;
    p.advance(); // COLON
    const parseArg = RADIAL_ARG_PARSERS[argName];
    if (parseArg) {
      parseArg(p, args);
    } else {
      p.addError(`Unknown radial argument '${argName}'`, p.peek().span);
      p.parseExpr();
    }
  }
  return args;
}
