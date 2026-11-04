/**
 * @author Aidan Boissonneault
 * @file parse-refs.ts
 * @purpose Parses refs for the references in parser package.
 * @last-edited October 6, 2026
 */

import type {
  FaceRef,
  FaceRefList,
  FaceRefSegment,
  PosRef,
  Expr,
  FnCallExpr,
  RepeatableSpatialRef,
} from '@bushscad/ir';
import type { Token } from '../core/token-types.js';
import type { Parser } from '../core/parser.js';
import { parseOrderedExprArgs } from '../expressions/parse-ordered-args.js';
import {
  parseSpatialArgs,
  spatialArgsToRef,
} from '../geometry/parse-spatial-args.js';
import {
  appendOptionalIndexSegment,
  parseFaceRefCallSeg,
  parseFaceRefGroupSeg,
  parseFaceRefSuffixSegments,
  rejectRemovedReferenceCall,
} from './parse-ref-segments.js';
import { referenceNameSegment } from './reference-source-ranges.js';
import { parseEdgeIntersectionSegment } from './parse-edge-intersection.js';

/**
 * Returns whether the input meets the `spatial offset call` condition.
 */
function isSpatialOffsetCall(p: Parser, segmentName: string): boolean {
  rejectRemovedReferenceCall(p, segmentName);
  return true;
}

/**
 * Parses face ref from ident from the supplied source into the references representation.
 */
export function parseFaceRefFromIdent(p: Parser, first: Token): FaceRef {
  let firstSeg: FaceRefSegment;
  if (p.eat('LPAREN')) {
    firstSeg = parseFaceRefCallSeg(p, first);
  } else {
    firstSeg = referenceNameSegment(first);
  }
  const segments: FaceRefSegment[] = [firstSeg];
  if (firstSeg.kind === 'name') appendOptionalIndexSegment(p, segments);
  segments.push(...parseFaceRefSuffixSegments(p, false));
  return { kind: 'faceRef', chain: segments, span: p.spanFrom(first.span) };
}

/**
 * Parses face ref list from the supplied source into the references representation.
 */
function parseFaceRefList(p: Parser): FaceRefList {
  const start = p.peek().span;
  p.expect('LBRACKET');
  const items: FaceRef[] = [];
  while (!p.check('RBRACKET', 'EOF')) {
    const item = parseSpatialRef(p);
    if (item.kind === 'faceRef') {
      items.push(item);
    } else {
      p.addError('Selector lists only accept @ face references', item.span);
    }
    p.eat('COMMA');
  }
  p.expect('RBRACKET');
  if (items.length === 0) {
    p.addError(
      'Selector lists must contain at least one @ reference',
      p.spanFrom(start),
    );
  }
  return {
    kind: 'faceRefList',
    items,
    suffix: parseFaceRefSuffixSegments(p),
    span: p.spanFrom(start),
  };
}

/**
 * Parses fn call from ident from the supplied source into the references representation.
 */
export function parseFnCallFromIdent(p: Parser, name: Token): FnCallExpr {
  p.expect('LPAREN');
  const args: Expr[] = [];
  const namedArgs: FnCallExpr['namedArgs'] = [];

  while (!p.check('RPAREN', 'EOF')) {
    if (p.isNamedArgToken(p.peek()) && p.peek(1).kind === 'COLON') {
      const argName = p.advance().value;
      p.advance(); // COLON
      namedArgs.push({ name: argName, value: p.parseExpr() });
    } else {
      args.push(p.parseExpr());
    }
    p.eat('COMMA');
  }
  p.expect('RPAREN');
  return {
    kind: 'call',
    name: name.value,
    args,
    namedArgs,
    span: p.spanFrom(name.span),
  };
}

/**
 * Parses pos ref from the supplied source into the references representation.
 */
export function parsePosRef(p: Parser): PosRef {
  const start = p.peek().span;
  p.expect('POS');
  p.expect('LPAREN');

  let anchor: PosRef['anchor'];
  if (p.check('NUMBER')) {
    const x = p.parseExpr();
    p.expect('COMMA');
    const y = p.parseExpr();
    p.expect('COMMA');
    const z = p.parseExpr();
    anchor = [x, y, z];
  } else {
    anchor = parseFaceRefFromIdent(p, p.expect('IDENT'));
  }

  let result: Partial<Omit<PosRef, 'kind' | 'anchor' | 'span'>> = {};
  if (p.eat('COMMA')) {
    result = parseOrderedExprArgs(p, 'pos', [
      { name: 'x' },
      { name: 'y' },
      { name: 'radius' },
      { name: 'angle' },
      { name: 'offset' },
    ]);
  }
  p.expect('RPAREN');
  return { kind: 'pos', anchor, ...result, span: p.spanFrom(start) };
}

/**
 * Parses placement from the supplied source into the references representation.
 */
export function parsePlacement(p: Parser): RepeatableSpatialRef {
  return parseRepeatableSpatialRef(p);
}

/**
 * Parses placement as face ref from the supplied source into the references representation.
 */
export function parsePlacementAsFaceRef(p: Parser): FaceRef | FaceRefList {
  const pl = parsePlacement(p);
  if (pl.kind === 'faceRef' || pl.kind === 'faceRefList') return pl;
  return { kind: 'faceRef', chain: [], span: pl.span };
}

/**
 * Parses repeatable spatial ref from the supplied source into the references representation.
 */
function parseRepeatableSpatialRef(p: Parser): RepeatableSpatialRef {
  if (p.check('LBRACKET')) return parseFaceRefList(p);
  return parseSpatialRef(p);
}

/**
 * Parses `@plane(face, offset: n)` into the existing offset placement shape.
 *
 * `plane` is a statement keyword, so the lexer cannot emit it as `IDENT`
 * after `@`. Keeping the special case here lets offset-plane placements share
 * the same PosRef representation used by ordinary spatial offsets.
 */
function parsePlaneSpatialRef(p: Parser, start: Token['span']): PosRef {
  p.advance(); // PLANE
  p.expect('LPAREN');
  const anchor = parseFaceRefFromIdent(p, p.expect('IDENT'));
  let offset: Expr | undefined;
  if (p.eat('COMMA')) {
    const named = p.parseNamedExprArg();
    if (named) {
      const [name, value] = named;
      if (name !== 'offset') {
        p.addError(`plane() does not accept argument '${name}'`, value.span);
      } else {
        offset = value;
      }
    } else {
      offset = p.parseExpr();
    }
  }
  p.expect('RPAREN');
  return { kind: 'pos', anchor, offset, span: p.spanFrom(start) };
}

/**
 * Spatial root is tagged by kind: 'segments' carries segments and 'pos' carries ref.
 */
type SpatialRoot =
  | { kind: 'segments'; segments: FaceRefSegment[] }
  | { kind: 'pos'; ref: PosRef };

/**
 * Parses spatial root from the supplied source into the references representation.
 */
function parseSpatialRoot(p: Parser, start: Token['span']): SpatialRoot {
  const segments: FaceRefSegment[] = [];
  if (p.check('LPAREN')) {
    segments.push(parseEdgeIntersectionSegment(p));
  } else if (p.check('LBRACKET')) {
    segments.push(parseFaceRefGroupSeg(p));
  } else if (p.check('STAR')) {
    segments.push({ kind: 'wildcard', span: p.advance().span });
  } else if (p.check('PLANE')) {
    return { kind: 'pos', ref: parsePlaneSpatialRef(p, start) };
  } else {
    const first = p.expect('IDENT');
    if (p.check('LPAREN')) rejectRemovedReferenceCall(p, first.value);
    segments.push(referenceNameSegment(first));
    appendOptionalIndexSegment(p, segments);
  }
  return { kind: 'segments', segments };
}

/**
 * Parses spatial suffix from the supplied source into the references representation.
 */
function parseSpatialSuffix(
  p: Parser,
  start: Token['span'],
  segments: FaceRefSegment[],
): FaceRef | PosRef | null {
  while (p.eat('DOT')) {
    const offsetRef = parseSpatialSuffixSegment(p, start, segments);
    if (offsetRef) return offsetRef;
  }
  return null;
}

/**
 * Parses spatial suffix segment from the supplied source into the references representation.
 */
function parseSpatialSuffixSegment(
  p: Parser,
  start: Token['span'],
  segments: FaceRefSegment[],
): FaceRef | PosRef | null {
  if (p.check('LPAREN')) {
    segments.push(parseEdgeIntersectionSegment(p));
    return null;
  }
  if (p.check('STAR')) {
    segments.push({ kind: 'wildcard', span: p.advance().span });
    return null;
  }
  if (p.check('LBRACKET')) {
    segments.push(parseFaceRefGroupSeg(p));
    return null;
  }
  const segment = p.expect('IDENT');
  const beforeSegment = segments.length;
  segments.push(referenceNameSegment(segment));
  appendOptionalIndexSegment(p, segments);
  if (!p.eat('LPAREN')) return null;

  segments.splice(beforeSegment);
  if (isSpatialOffsetCall(p, segment.value)) {
    const face = spatialFaceRef(p, start, [
      ...segments,
      referenceNameSegment(segment),
    ]);
    const args = parseSpatialArgs(p, segment.value, face);
    p.expect('RPAREN');
    return spatialArgsToRef(face, args, p.spanFrom(start));
  }
  segments.push(parseFaceRefCallSeg(p, segment));
  return null;
}

/**
 * Handles spatial face ref in the references flow.
 */
function spatialFaceRef(
  p: Parser,
  start: Token['span'],
  segments: FaceRefSegment[],
): FaceRef {
  return {
    kind: 'faceRef',
    chain: segments,
    span: p.spanFrom(start),
  };
}

/**
 * Parses an `@` spatial reference into the existing placement AST shapes.
 *
 * The simplified syntax is public-facing, but evaluator and IR placement logic
 * already understand FaceRef and PosRef. Lowering here keeps geometry behavior
 * stable while removing the old `@` and placement keywords.
 */
export function parseSpatialRef(p: Parser): FaceRef | PosRef {
  const start = p.expect('AT_SIGN').span;
  const root = parseSpatialRoot(p, start);
  if (root.kind === 'pos') return root.ref;

  const offsetRef = parseSpatialSuffix(p, start, root.segments);
  if (offsetRef) return offsetRef;

  const face = spatialFaceRef(p, start, root.segments);
  if (p.eat('LPAREN')) {
    const args = parseSpatialArgs(p, '', face);
    p.expect('RPAREN');
    return spatialArgsToRef(face, args, p.spanFrom(start));
  }
  return face;
}
