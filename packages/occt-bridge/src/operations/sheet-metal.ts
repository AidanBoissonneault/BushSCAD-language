/**
 * @author Aidan Boissonneault
 * @file sheet-metal.ts
 * @purpose Provides sheet metal behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  IRProgram,
  IRFlatPattern,
  IRFlatPatternSegment,
  DrawingResult,
} from '@bushscad/ir';
import {
  createDxfR12Document,
  finishDxfR12Document,
} from '../export/dxf-r12.js';

/**
 * Handles f in the operations flow.
 */
function f(n: number): string {
  return n.toFixed(6);
}

/** Writes a minimal DXF R12 document for a sheet-metal flat pattern. */
function writeFlatPatternDxf(segments: IRFlatPatternSegment[]): string {
  const lines = createDxfR12Document();
  for (const s of segments) {
    const layer = s.layer === 'BEND' ? 'BEND' : '0';
    lines.push(
      '0',
      'LINE',
      '8',
      layer,
      '10',
      f(s.x1),
      '20',
      f(s.y1),
      '30',
      '0.000000',
      '11',
      f(s.x2),
      '21',
      f(s.y2),
      '31',
      '0.000000',
    );
  }
  return finishDxfR12Document(lines);
}

/** Collects every `flat_pattern` op in the program as a written DrawingResult. */
export function collectFlatPatterns(program: IRProgram): DrawingResult[] {
  const results: DrawingResult[] = [];
  for (const op of program.ops) {
    if (op.kind !== 'flat_pattern') continue;
    const fp = op as IRFlatPattern;
    results.push({
      name: fp.name,
      dxfContent: writeFlatPatternDxf(fp.segments),
      svgContent: null,
      exportDxfPath: fp.path,
      exportSvgPath: null,
      errors: [],
    });
  }
  return results;
}
