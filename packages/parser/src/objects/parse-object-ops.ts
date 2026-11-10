/**
 * @author Aidan Boissonneault
 * @file parse-object-ops.ts
 * @purpose Parses object ops for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type {
  AnonymousObjDecl,
  ObjDecl,
  ObjFromCallDecl,
  AnchorDecl,
  ObjectOperation,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  isHistoricalSweepCut,
  isSolidCutStart,
  parseCutOp,
} from '../geometry/parse-cut.js';
import { parseSpatialAnchor } from '../statements/anchor/parse-anchor.js';
import {
  parseExtrudeOp,
  parseThickenOp,
  parseWrapSuffix,
} from './parse-object-basics.js';
import {
  parseHeatsetInsertOp,
  parseHoleOp,
} from './parse-hardware-object-ops.js';
import {
  parseRadialCutOp,
  parseRadialExtrudeOp,
} from '../geometry/parse-radial-object-ops.js';
import {
  parseLoftOp,
  parseRevolveOp,
  parseSweepCutOp,
  parseSweepOp,
} from '../geometry/parse-revolve-loft-sweep.js';
import { parseSolidCutOp } from '../geometry/parse-solid-cut-tools.js';
import {
  isSolidPrimitiveName,
  isSolidPrimitiveStart,
  parseSolidPrimitiveOp,
} from '../geometry/parse-solid-primitives.js';

export { parseWrapSuffix } from './parse-object-basics.js';

/**
 * Object operation parser, including matches and parse.
 */
type ObjectOperationParser = {
  matches: (p: Parser) => boolean;
  parse: (p: Parser) => ObjectOperation;
};

/**
 * Parses dispatched cut op from the supplied source into the objects representation.
 */
function parseDispatchedCutOp(p: Parser): ObjectOperation {
  if (isHistoricalSweepCut(p)) return parseSweepCutOp(p);
  if (isSolidCutStart(p)) return parseSolidCutOp(p);
  return parseCutOp(p);
}

const OPERATION_PARSERS: ObjectOperationParser[] = [
  { matches: (p) => p.check('EXTRUDE'), parse: parseExtrudeOp },
  { matches: (p) => p.check('CUT'), parse: parseDispatchedCutOp },
  { matches: (p) => p.check('SWEEP'), parse: parseSweepOp },
  { matches: (p) => p.check('REVOLVE'), parse: parseRevolveOp },
  { matches: (p) => p.check('RADIAL_EXTRUDE'), parse: parseRadialExtrudeOp },
  { matches: (p) => p.check('RADIAL_CUT'), parse: parseRadialCutOp },
  { matches: (p) => p.check('LOFT'), parse: parseLoftOp },
  { matches: (p) => p.check('THICKEN'), parse: parseThickenOp },
  {
    matches: (p) =>
      p.peek().kind === 'IDENT' &&
      p.peek().value === 'hole' &&
      p.peek(1).kind === 'LPAREN',
    parse: parseHoleOp,
  },
  {
    matches: (p) =>
      p.peek().kind === 'IDENT' &&
      p.peek().value === 'heatset_insert' &&
      p.peek(1).kind === 'LPAREN',
    parse: parseHeatsetInsertOp,
  },
  { matches: isSolidPrimitiveStart, parse: parseSolidPrimitiveOp },
];

/**
 * Parses an object declaration and its solid-producing operation.
 * Object declarations are the visible geometry binding point. This wrapper
 * keeps binding syntax separate from individual operation grammars.
 */
export function parseObj(p: Parser): ObjDecl | ObjFromCallDecl {
  const start = p.peek().span;
  p.advance(); // OBJ
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;
  p.expect('ASSIGN');

  if (
    p.check('IDENT') &&
    p.peek(1).kind === 'LPAREN' &&
    p.peek().value !== 'hole' &&
    p.peek().value !== 'heatset_insert' &&
    !isSolidPrimitiveName(p.peek().value)
  ) {
    const fnTok = p.advance();
    const call = p.parseFnCallFromIdent(fnTok);
    p.requireSemi();
    return {
      kind: 'objCall',
      name,
      nameSpan: nameToken.span,
      call,
      span: p.spanFrom(start),
    };
  }

  const operation = parseObjectOperationWithSuffix(p);

  const hasAnchorBlock = p.check('LBRACE');
  const anchors = hasAnchorBlock ? parseObjectAnchorBlock(p) : [];
  if (hasAnchorBlock) p.eatSemi();
  else p.requireSemi();
  return {
    kind: 'obj',
    name,
    nameSpan: nameToken.span,
    operation,
    anchors,
    span: p.spanFrom(start),
  };
}

/**
 * Checks whether the current token sequence begins a solid-producing object
 * operation, distinguishing those statements from ordinary function calls.
 */
export function isObjectOperationStart(p: Parser): boolean {
  return OPERATION_PARSERS.some((parser) => parser.matches(p));
}

/**
 * Parses an object operation used without an object name.
 * Its result is not bound to a reusable language object name.
 */
export function parseAnonymousObjectOperation(
  p: Parser,
): AnonymousObjDecl | null {
  if (!isObjectOperationStart(p)) return null;
  const start = p.peek().span;
  const operation = parseObjectOperationWithSuffix(p);
  p.requireSemi();
  return { kind: 'anonymousObj', operation, span: p.spanFrom(start) };
}

/**
 * Parses the operation body shared by visible `obj` and hidden one-line `ref`.
 * `ref name = <object-op>;` accepts the same solid-producing operation syntax
 * as `obj name = <object-op>;` while differing only in display policy.
 */
export function parseObjectOperation(p: Parser): ObjectOperation {
  for (const parser of OPERATION_PARSERS) {
    if (parser.matches(p)) return parser.parse(p);
  }
  p.fail(
    `Expected extrude, cut, sweep, revolve, radial_extrude, radial_cut, loft, hole, heatset_insert, or a solid primitive (or a function call), got ${p.peek().kind}`,
    p.peek().span,
  );
}

/** Parses a complete object operation, including an optional wrap suffix. */
export function parseObjectOperationWithSuffix(p: Parser): ObjectOperation {
  const operation = parseObjectOperation(p);
  if (operation.kind === 'extrude' || operation.kind === 'cut') {
    const suffixWrap = parseWrapSuffix(p);
    operation.wrap = operation.wrap || suffixWrap;
  }
  return operation;
}

/**
 * Parses object-local `@` anchor aliases following an operation.
 * Tag blocks were removed, but object-local alias blocks remain useful when
 * examples want to group face anchors next to the object they describe.
 */
function parseObjectAnchorBlock(p: Parser): AnchorDecl[] {
  p.expect('LBRACE');
  const anchors: AnchorDecl[] = [];
  while (!p.check('RBRACE', 'EOF')) {
    if (p.check('AT_SIGN')) {
      anchors.push(parseSpatialAnchor(p));
    } else {
      p.fail(`Expected @ anchor declaration, got ${p.peek().kind}`);
    }
  }
  p.expect('RBRACE');
  return anchors;
}
