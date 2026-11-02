/**
 * @author Aidan Boissonneault
 * @file parse-sketch-annotations.ts
 * @purpose Parses shared constraint and dimension annotations for sketch paths.
 * @last-edited October 31, 2026
 */

import type { ConstraintDecl, SketchDimensionDecl } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  consumeLegacyConstrain,
  parseConstraintCall,
} from './parse-sketch-constraints.js';
import { parseDimensionDecl } from './parse-sketch-dimensions.js';

/** Parses one constraint or dimension annotation from a sketch path. */
export function parseSketchConstraintOrDimension(
  p: Parser,
  constraints: ConstraintDecl[],
  dimensions: SketchDimensionDecl[],
): boolean {
  const constraint = parseConstraintCall(p);
  if (constraint) {
    constraints.push(constraint);
    return true;
  }
  if (consumeLegacyConstrain(p)) return true;
  if (p.check('DIMENSION')) {
    dimensions.push(parseDimensionDecl(p));
    return true;
  }
  return false;
}
