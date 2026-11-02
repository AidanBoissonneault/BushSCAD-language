/**
 * @author Aidan Boissonneault
 * @file parse-cut.ts
 * @purpose Parses cut for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type {
  CutOp,
  Expr,
  ThroughTarget,
  RepeatableSpatialRef,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { TokenKind } from '../core/token-types.js';
import { parseSketchInput } from '../objects/parse-inputs.js';
import { placementRequestsWrap } from './parse-wrap.js';

/**
 * Through depth from, including through, depth, and from.
 */
interface ThroughDepthFrom {
  through: ThroughTarget;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
}

/**
 * Parses the trailing `through` / `depth` / `from` arguments shared by cut-like
 * operations. `allowNamedDepth` enables the `depth:` keyword-argument form.
 */
export function parseThroughDepthFrom(
  p: Parser,
  allowNamedDepth: boolean,
): ThroughDepthFrom {
  let through: ThroughTarget = null;
  let depth: Expr | null = null;
  let from: RepeatableSpatialRef | null = null;

  if (p.check('THROUGH')) {
    const throughSpan = p.advance().span;
    through =
      p.peek().kind === 'IDENT' && p.peek(1).kind !== 'COLON'
        ? {
            kind: 'namedThrough',
            name: p.advance().value,
            span: p.spanFrom(throughSpan),
          }
        : { kind: 'inferredThrough', span: p.spanFrom(throughSpan) };
    if (p.eat('COMMA')) from = p.parsePlacement();
  } else {
    const namedDepth = allowNamedDepth ? tryParseNamedDepth(p) : null;
    depth = namedDepth ?? p.parseExpr();
    if (p.eat('COMMA')) from = p.parsePlacement();
  }

  return { through, depth, from };
}

/** Parses a `depth: <expr>` named argument if present, else returns null. */
export function tryParseNamedDepth(p: Parser): Expr | null {
  if (
    p.peek().kind === 'IDENT' &&
    p.peek().value === 'depth' &&
    p.peek(1).kind === 'COLON'
  ) {
    p.advance(); // depth
    p.expect('COLON');
    return p.parseExpr();
  }
  return null;
}

/**
 * Detects `cut(sweep(...), through|depth ...)`, which remains the historical
 * sweep-cut form. A placement argument immediately after the inline sweep
 * selects the solid-tool cut form instead.
 */
export function isHistoricalSweepCut(p: Parser): boolean {
  return (
    p.check('CUT') &&
    p.peek(1).kind === 'LPAREN' &&
    p.peek(2).kind === 'SWEEP' &&
    !isSolidCutStart(p)
  );
}

/** Parses the original sketch-profile `cut(...)` syntax. */
export function parseCutOp(p: Parser): CutOp {
  const start = p.peek().span;
  p.advance(); // CUT
  p.expect('LPAREN');
  const sketch = parseSketchInput(p);
  p.expect('COMMA');

  const { through, depth, from } = parseThroughDepthFrom(p, true);

  p.expect('RPAREN');
  return {
    kind: 'cut',
    sketch,
    through,
    depth,
    from,
    wrap: placementRequestsWrap(from),
    span: p.spanFrom(start),
  };
}

/**
 * Returns true when the current `cut(` call clearly starts a solid-tool cut.
 * Identifier tools are intentionally recognized only as `cut(name, @target)`
 * so `cut(name, depth...)` and `cut(name, through...)` remain sketch cuts.
 */
export function isSolidCutStart(p: Parser): boolean {
  if (!(p.check('CUT') && p.peek(1).kind === 'LPAREN')) return false;
  const first = p.peek(2);
  if (isInlineSolidToolKind(first.kind))
    return firstArgIsFollowedByPlacement(p, 2);
  return (
    first.kind === 'IDENT' &&
    p.peek(3).kind === 'COMMA' &&
    p.peek(4).kind === 'AT_SIGN'
  );
}

/**
 * Returns the first arg is followed by placement that matches the requested condition.
 */
function firstArgIsFollowedByPlacement(
  p: Parser,
  startOffset: number,
): boolean {
  let depth = 0;
  for (let i = startOffset; ; i++) {
    const tok = p.peek(i);
    if (tok.kind === 'EOF') return false;
    if (tok.kind === 'LPAREN') depth++;
    if (tok.kind !== 'RPAREN') continue;
    depth--;
    if (depth === 0)
      return p.peek(i + 1).kind === 'COMMA' && p.peek(i + 2).kind === 'AT_SIGN';
  }
}

/**
 * Returns whether the input meets the `inline solid tool kind` condition.
 */
function isInlineSolidToolKind(kind: TokenKind): boolean {
  return (
    kind === 'EXTRUDE' ||
    kind === 'REVOLVE' ||
    kind === 'LOFT' ||
    kind === 'SWEEP' ||
    kind === 'THICKEN'
  );
}
