/**
 * @author Aidan Boissonneault
 * @file dxf-writer.ts
 * @purpose Provides dxf writer behavior for the export in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  Edge2DSegment,
  Dim2D,
  ViewBounds,
} from '../drawing/drawing-projection.js';
import { createDxfR12Document, finishDxfR12Document } from './dxf-r12.js';

/**
 * Handles f in the export flow.
 */
function f(n: number): string {
  return n.toFixed(6);
}

/** Write a minimal DXF R12 document from projected edges and dimension lines. */
export function writeDxf(
  edges: Edge2DSegment[],
  dimensions: Dim2D[],
  _bounds: ViewBounds,
  scale: number,
): string {
  const s = scale;
  const lines = createDxfR12Document();

  // Geometry edges → LINE entities on layer 0
  for (const e of edges) {
    lines.push(
      '0',
      'LINE',
      '8',
      '0',
      '10',
      f(e.x1 * s),
      '20',
      f(e.y1 * s),
      '30',
      '0.000000',
      '11',
      f(e.x2 * s),
      '21',
      f(e.y2 * s),
      '31',
      '0.000000',
    );
  }

  // Dimension lines on layer DIMENSIONS
  for (const d of dimensions) {
    // Witness line start → end (horizontal or vertical)
    lines.push(
      '0',
      'LINE',
      '8',
      'DIMENSIONS',
      '10',
      f(d.x1 * s),
      '20',
      f(d.y1 * s),
      '30',
      '0.000000',
      '11',
      f(d.x2 * s),
      '21',
      f(d.y2 * s),
      '31',
      '0.000000',
    );
    // Text at midpoint
    const tx = ((d.x1 + d.x2) / 2) * s;
    const ty = ((d.y1 + d.y2) / 2) * s;
    const textHeight = 2.5;
    lines.push(
      '0',
      'TEXT',
      '8',
      'DIMENSIONS',
      '10',
      f(tx),
      '20',
      f(ty),
      '30',
      '0.000000',
      '40',
      f(textHeight),
      '1',
      d.label,
      '72',
      '1', // horizontal center
      '11',
      f(tx),
      '21',
      f(ty),
      '31',
      '0.000000',
    );
  }

  return finishDxfR12Document(lines);
}
