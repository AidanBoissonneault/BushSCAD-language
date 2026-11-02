/**
 * @author Aidan Boissonneault
 * @file eval-sheet-geometry.ts
 * @purpose Evaluates sheet geometry for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  FlangeDirection,
  FlangeStmt,
  IRFlatPatternSegment,
  IRProfileSegment,
} from '@bushscad/ir';

/**
 * Accepted values for edge name are 'front', 'back', 'left', and 'right'.
 */
export type EdgeName = 'front' | 'back' | 'left' | 'right';

/**
 * Rect dims, including width and height.
 */
export type RectDims = { width: number; height: number };

/** A resolved flange ready to lower into geometry once panel reduction is known. */
export type ResolvedFlange = {
  stmt: FlangeStmt;
  edge: EdgeName;
  length: number; // flat strip consumed from the base rect
  wallLength: number; // straight wall length after the bend (length - bendAllowance)
  angleDeg: number;
  radius: number;
  bendAllowance: number;
};

/**
 * Edge frame, including origin, edge dir, outward dir, and edge length.
 */
type EdgeFrame = {
  origin: [number, number, number];
  edgeDir: [number, number, number];
  outwardDir: [number, number, number];
  edgeLength: number;
};

/** Resolves a named rect edge (of the reduced panel, centered at cx/cy) to its prism frame. */
export function edgeFrame(
  edge: EdgeName,
  dims: RectDims,
  cx: number,
  cy: number,
): EdgeFrame {
  const hw = dims.width / 2;
  const hh = dims.height / 2;
  switch (edge) {
    case 'front':
      return {
        origin: [cx + hw, cy - hh, 0],
        edgeDir: [-1, 0, 0],
        outwardDir: [0, -1, 0],
        edgeLength: dims.width,
      };
    case 'back':
      return {
        origin: [cx - hw, cy + hh, 0],
        edgeDir: [1, 0, 0],
        outwardDir: [0, 1, 0],
        edgeLength: dims.width,
      };
    case 'left':
      return {
        origin: [cx - hw, cy - hh, 0],
        edgeDir: [0, 1, 0],
        outwardDir: [-1, 0, 0],
        edgeLength: dims.height,
      };
    case 'right':
      return {
        origin: [cx + hw, cy + hh, 0],
        edgeDir: [0, -1, 0],
        outwardDir: [1, 0, 0],
        edgeLength: dims.height,
      };
  }
}

/**
 * Builds the flange cross-section (bend arc + straight wall) as a closed,
 * counter-clockwise profile in the local (u, v) plane: u = base-outward,
 * v = up. Base bottom at v=0, base top at v=t. A down-fold mirrors across
 * v = t/2. `wallLen` is the straight wall length after the bend.
 */
export function buildFlangeProfile(
  t: number,
  r: number,
  angleDeg: number,
  wallLen: number,
  direction: FlangeDirection,
): IRProfileSegment[] {
  const theta = (angleDeg * Math.PI) / 180;
  const s = Math.sin(theta);
  const c = Math.cos(theta);

  const A: [number, number] = [0, t];
  const D: [number, number] = [0, 0];
  const B: [number, number] = [r * s, t + r - r * c];
  const Po: [number, number] = [(r + t) * s, t + r - (r + t) * c];
  const E: [number, number] = [B[0] + wallLen * c, B[1] + wallLen * s];
  const F: [number, number] = [Po[0] + wallLen * c, Po[1] + wallLen * s];

  let segs: IRProfileSegment[] = [
    {
      kind: 'arc',
      name: 'bend_in',
      from: A,
      to: B,
      radius: r,
      clockwise: false,
    },
    { kind: 'line', name: 'flange_in', from: B, to: E },
    { kind: 'line', name: 'flange_end', from: E, to: F },
    { kind: 'line', name: 'flange_out', from: F, to: Po },
    {
      kind: 'arc',
      name: 'bend_out',
      from: Po,
      to: D,
      radius: r + t,
      clockwise: true,
    },
    { kind: 'line', name: 'base_cap', from: D, to: A },
  ];

  if (direction === 'down') {
    /**
     * Handles flip in the geometry flow.
     */
    const flip = (p: [number, number]): [number, number] => [p[0], t - p[1]];
    segs = segs.map((seg) =>
      seg.kind === 'line'
        ? { ...seg, from: flip(seg.from), to: flip(seg.to) }
        : {
            ...seg,
            from: flip(seg.from),
            to: flip(seg.to),
            clockwise: !seg.clockwise,
          },
    );
  }

  // OCCT prisms a face whose normal follows the wire winding; force CCW so the
  // flange solid is positively oriented for the fuse into the base panel.
  return signedArea(segs) < 0 ? reverseProfile(segs) : segs;
}

/**
 * Handles signed area in the geometry flow.
 */
function signedArea(segs: IRProfileSegment[]): number {
  let a = 0;
  for (const seg of segs)
    a += seg.from[0] * seg.to[1] - seg.to[0] * seg.from[1];
  return a / 2;
}

/**
 * Handles reverse profile in the geometry flow.
 */
function reverseProfile(segs: IRProfileSegment[]): IRProfileSegment[] {
  return [...segs]
    .reverse()
    .map((seg) =>
      seg.kind === 'line'
        ? { ...seg, from: seg.to, to: seg.from }
        : { ...seg, from: seg.to, to: seg.from, clockwise: !seg.clockwise },
    );
}

/**
 * Builds the flat-pattern outline (the original rectangle) plus bend lines for
 * every rect base panel. Exact for rectangular bases.
 */
export function buildFlatPattern(
  panelSketch: Map<string, string>,
  rectDims: Map<string, RectDims>,
  flangesByPanel: Map<string, ResolvedFlange[]>,
): IRFlatPatternSegment[] {
  const out: IRFlatPatternSegment[] = [];
  let offsetX = 0;

  for (const [panel, sketch] of panelSketch) {
    const dims = rectDims.get(sketch);
    if (!dims) continue;
    const flanges = flangesByPanel.get(panel) ?? [];
    const hw = dims.width / 2;
    const hh = dims.height / 2;
    const cx = offsetX;
    /**
     * Creates line geometry from the supplied endpoints.
     */
    const line = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      layer: IRFlatPatternSegment['layer'],
    ): void => {
      out.push({ x1: cx + x1, y1, x2: cx + x2, y2, layer });
    };

    // Outline: the full original rectangle.
    line(-hw, -hh, hw, -hh, 'OUTLINE');
    line(-hw, hh, hw, hh, 'OUTLINE');
    line(-hw, -hh, -hw, hh, 'OUTLINE');
    line(hw, -hh, hw, hh, 'OUTLINE');

    // Bend lines bracket the bend zone consumed inside the rectangle.
    for (const f of flanges) {
      if (f.edge === 'front') {
        const y = -hh + f.length; // reduced edge
        line(-hw, y, hw, y, 'BEND');
        line(-hw, y - f.bendAllowance, hw, y - f.bendAllowance, 'BEND');
      } else if (f.edge === 'back') {
        const y = hh - f.length;
        line(-hw, y, hw, y, 'BEND');
        line(-hw, y + f.bendAllowance, hw, y + f.bendAllowance, 'BEND');
      } else if (f.edge === 'left') {
        const x = -hw + f.length;
        line(x, -hh, x, hh, 'BEND');
        line(x - f.bendAllowance, -hh, x - f.bendAllowance, hh, 'BEND');
      } else {
        const x = hw - f.length;
        line(x, -hh, x, hh, 'BEND');
        line(x + f.bendAllowance, -hh, x + f.bendAllowance, hh, 'BEND');
      }
    }
    offsetX += dims.width * 2 + 40;
  }

  return out;
}
