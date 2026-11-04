import type { SketchPlacement } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';

/**
 * Parses trailing sketch placement from the supplied source into the sketch representation.
 */
export function parseTrailingSketchPlacement(
  p: Parser,
): SketchPlacement | undefined {
  if (!p.eat('COMMA')) return undefined;
  if (!p.check('AT_SIGN')) {
    p.addError(
      `Sketch placement must use an @ spatial reference`,
      p.peek().span,
    );
    return undefined;
  }
  return { mode: 'on', face: p.parseSpatialRef() };
}
