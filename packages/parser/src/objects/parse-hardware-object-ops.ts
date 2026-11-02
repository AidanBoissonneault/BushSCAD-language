/**
 * @author Aidan Boissonneault
 * @file parse-hardware-object-ops.ts
 * @purpose Parses hardware object ops for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  HardwareSpecKind,
  HardwareSpecRef,
  HeatsetInsertOp,
  HoleOp,
  RepeatableSpatialRef,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  parseThroughDepthFrom,
  tryParseNamedDepth,
} from '../geometry/parse-cut.js';

/**
 * Parses a hardware size identifier.
 * Metric names like `M2.5` lex as `IDENT DOT NUMBER`, but hardware operations
 * need a single string key for lookup.
 */
function parseSizeIdent(p: Parser): string {
  const sizeTok = p.expect('IDENT');
  let size = sizeTok.value;
  if (p.peek().kind === 'DOT' && p.peek(1).kind === 'NUMBER') {
    p.advance(); // DOT
    const fracTok = p.advance(); // NUMBER
    size = `${size}.${fracTok.value}`;
  }
  return size;
}

const VALID_SPEC_KINDS = new Set<string>([
  'clearance',
  'tap',
  'counterbore',
  'countersink',
  'heatset_insert',
  'pilot',
]);

/**
 * Parses a metric hardware hole operation.
 * `hole(...)` is a soft-keyword object operation that resolves hardware specs
 * before sharing cut depth and placement syntax.
 */
export function parseHoleOp(p: Parser): HoleOp {
  const start = p.peek().span;
  p.advance(); // hole IDENT
  p.expect('LPAREN');

  const size = parseSizeIdent(p);
  p.expect('DOT');
  const specKindTok = p.advance();
  const specKindVal = specKindTok.value;
  if (!VALID_SPEC_KINDS.has(specKindVal)) {
    p.addError(
      `Unknown hole spec kind '${specKindVal}' - expected clearance, tap, counterbore, countersink, heatset_insert, or pilot`,
      specKindTok.span,
    );
  }
  const spec: HardwareSpecRef = {
    size,
    specKind: specKindVal as HardwareSpecKind,
    span: p.spanFrom(start),
  };

  p.expect('COMMA');

  const { through, depth, from } = parseThroughDepthFrom(p, true);

  p.expect('RPAREN');
  return { kind: 'hole', spec, through, depth, from, span: p.spanFrom(start) };
}

/**
 * Parses a heat-set insert object operation.
 * Heat-set inserts share hardware size parsing with holes but use a compact
 * optional depth/from grammar.
 */
export function parseHeatsetInsertOp(p: Parser): HeatsetInsertOp {
  const start = p.peek().span;
  p.advance(); // heatset_insert IDENT
  p.expect('LPAREN');

  const size = parseSizeIdent(p);

  let depth: Expr | null = null;
  let from: RepeatableSpatialRef | null = null;

  while (p.eat('COMMA')) {
    const namedDepth = tryParseNamedDepth(p);
    if (namedDepth !== null) {
      depth = namedDepth;
    } else if (p.check('AT_SIGN')) {
      from = p.parsePlacement();
    } else {
      p.eat('COMMA');
      break;
    }
  }

  if (from === null && p.check('AT_SIGN')) {
    from = p.parsePlacement();
  }

  p.expect('RPAREN');
  return { kind: 'heatset_insert', size, depth, from, span: p.spanFrom(start) };
}
