/**
 * @author Aidan Boissonneault
 * @file parse-solid-cut-tools.ts
 * @purpose Parses solid cut tools for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type { SolidCutOp, SolidCutTool } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  parseExtrudeOp,
  parseThickenOp,
} from '../objects/parse-object-basics.js';
import {
  parseLoftOp,
  parseRevolveOp,
  parseSweepOp,
} from './parse-revolve-loft-sweep.js';
import { parseNamedObjectInput } from '../objects/parse-inputs.js';

/**
 * Parses a solid-cut operation with either an object or inline solid tool.
 * Solid-cut syntax overlaps with sketch cuts, so the dispatcher identifies the
 * form and delegates the solid-tool grammar here.
 */
export function parseSolidCutOp(p: Parser): SolidCutOp {
  const start = p.peek().span;
  p.advance(); // CUT
  p.expect('LPAREN');
  const tool = parseSolidCutTool(p);
  p.expect('COMMA');
  const from = p.parsePlacement();
  p.expect('RPAREN');
  return {
    kind: 'solid_cut',
    tool,
    from,
    span: p.spanFrom(start),
  };
}

/**
 * Parses solid cut tool from the supplied source into the geometry representation.
 */
function parseSolidCutTool(p: Parser): SolidCutTool {
  const start = p.peek().span;
  if (p.peek().kind === 'IDENT') {
    return {
      kind: 'object',
      object: parseNamedObjectInput(p),
      span: p.spanFrom(start),
    };
  }
  if (p.check('EXTRUDE')) {
    return {
      kind: 'operation',
      operation: parseExtrudeOp(p),
      span: p.spanFrom(start),
    };
  }
  if (p.check('REVOLVE')) {
    return {
      kind: 'operation',
      operation: parseRevolveOp(p),
      span: p.spanFrom(start),
    };
  }
  if (p.check('LOFT')) {
    return {
      kind: 'operation',
      operation: parseLoftOp(p),
      span: p.spanFrom(start),
    };
  }
  if (p.check('SWEEP')) {
    return {
      kind: 'operation',
      operation: parseSweepOp(p),
      span: p.spanFrom(start),
    };
  }
  if (p.check('THICKEN')) {
    return {
      kind: 'operation',
      operation: parseThickenOp(p),
      span: p.spanFrom(start),
    };
  }
  p.fail(`Expected solid cut tool, got ${p.peek().kind}`, p.peek().span);
}
