/**
 * @author Aidan Boissonneault
 * @file svg-writer.ts
 * @purpose Provides svg writer behavior for the export in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  Edge2DSegment,
  Dim2D,
  ViewBounds,
  Face2DPolygon,
} from '../drawing/drawing-projection.js';

/**
 * Handles f in the export flow.
 */
function f(n: number): string {
  return n.toFixed(3);
}

/**
 * Handles points to path in the export flow.
 */
function pointsToPath(
  pts: [number, number][],
  tx: (u: number) => number,
  ty: (v: number) => number,
): string {
  if (pts.length === 0) return '';
  const parts: string[] = [`M ${f(tx(pts[0][0]))} ${f(ty(pts[0][1]))}`];
  for (let i = 1; i < pts.length; i++) {
    parts.push(`L ${f(tx(pts[i][0]))} ${f(ty(pts[i][1]))}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Writes an SVG document with six layers:
 *   1. Face fills (colored polygons with evenodd holes)
 *   2. Hidden edges (dashed)
 *   3. Visible edges (solid)
 *   4. Witness lines (thin solid)
 *   5. Dimension lines (dashed gray)
 *   6. Dimension text labels
 */
export function writeSvg(
  visible: Edge2DSegment[],
  hidden: Edge2DSegment[],
  faces: Face2DPolygon[],
  dimensions: Dim2D[],
  bounds: ViewBounds,
  scale: number,
): string {
  const s = scale;
  const PADDING = 20;
  const textHeight = 3.5 * s;

  const w = bounds.width * s + PADDING * 2;
  const h = bounds.height * s + PADDING * 2;

  /**
   * Handles tx in the export flow.
   */
  const tx = (u: number): number => (u - bounds.xMin) * s + PADDING;
  /**
   * Handles ty in the export flow.
   */
  const ty = (v: number): number => h - ((v - bounds.yMin) * s + PADDING);

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}mm" height="${f(h)}mm" viewBox="0 0 ${f(w)} ${f(h)}">`,
    '<style>',
    '.vis { stroke: #111; stroke-width: 0.5; fill: none; }',
    '.hid { stroke: #555; stroke-width: 0.35; fill: none; stroke-dasharray: 2,1.5; }',
    '.wit { stroke: #222; stroke-width: 0.25; fill: none; }',
    '.dim { stroke: #666; stroke-width: 0.35; fill: none; stroke-dasharray: 3,1.5; }',
    'text { font-family: sans-serif; font-size: ' +
      f(textHeight) +
      'px; fill: #444; text-anchor: middle; }',
    '</style>',
  );

  // Layer 1: face fills
  for (const face of faces) {
    const outer = pointsToPath(face.outerPoints, tx, ty);
    const inner = face.innerRings.map((r) => pointsToPath(r, tx, ty)).join(' ');
    const d = inner ? `${outer} ${inner}` : outer;
    lines.push(
      `<path d="${d}" fill="${face.color}" fill-rule="evenodd" stroke="none"/>`,
    );
  }

  // Layer 2: hidden edges
  for (const e of hidden) {
    lines.push(
      `<line class="hid" x1="${f(tx(e.x1))}" y1="${f(ty(e.y1))}" x2="${f(tx(e.x2))}" y2="${f(ty(e.y2))}"/>`,
    );
  }

  // Layer 3: visible edges
  for (const e of visible) {
    lines.push(
      `<line class="vis" x1="${f(tx(e.x1))}" y1="${f(ty(e.y1))}" x2="${f(tx(e.x2))}" y2="${f(ty(e.y2))}"/>`,
    );
  }

  // Layer 4 + 5 + 6: witness lines, dimension lines, labels
  for (const d of dimensions) {
    // witness line 1
    lines.push(
      `<line class="wit" x1="${f(tx(d.w1x1))}" y1="${f(ty(d.w1y1))}" x2="${f(tx(d.w1x2))}" y2="${f(ty(d.w1y2))}"/>`,
    );
    // witness line 2
    lines.push(
      `<line class="wit" x1="${f(tx(d.w2x1))}" y1="${f(ty(d.w2y1))}" x2="${f(tx(d.w2x2))}" y2="${f(ty(d.w2y2))}"/>`,
    );
    // dimension line
    lines.push(
      `<line class="dim" x1="${f(tx(d.x1))}" y1="${f(ty(d.y1))}" x2="${f(tx(d.x2))}" y2="${f(ty(d.y2))}"/>`,
    );
    // label centered on dim line, offset above
    const lx = f((tx(d.x1) + tx(d.x2)) / 2);
    const ly = f((ty(d.y1) + ty(d.y2)) / 2 - textHeight * 0.4);
    lines.push(`<text x="${lx}" y="${ly}">${d.label}</text>`);
  }

  lines.push('</svg>');
  return lines.join('\n');
}
