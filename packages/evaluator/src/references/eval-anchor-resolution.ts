/**
 * @author Aidan Boissonneault
 * @file eval-anchor-resolution.ts
 * @purpose Evaluates anchor resolution for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  EvalCtx,
  SolidMetrics,
  AnchorFaceDir,
  AnchorMetadata,
  ParsedAnchorLabel,
} from '../core/eval-types.js';
import { normalizeReferenceLabel } from '@bushscad/ir';

// Anchor resolution

/**
 * Handles side arg to face dir in the references flow.
 */
function sideArgToFaceDir(arg: string): AnchorFaceDir {
  switch (arg) {
    case 'top':
    case 'bottom':
    case 'front':
    case 'back':
    case 'left':
    case 'right':
      return arg;
    default:
      return 'front';
  }
}

/** Parse a dot-separated anchor label string into its component parts. */
function parseAnchorLabel(label: string): ParsedAnchorLabel {
  const parts = normalizeReferenceLabel(label).split('.');
  const parsed: ParsedAnchorLabel = { objName: parts[0] ?? label };
  const next = parseAnchorPrimary(parts, 1, parsed);
  parseAnchorSubRef(parts, next, parsed);
  return parsed;
}

/**
 * Parses anchor primary from the supplied source into the references representation.
 */
function parseAnchorPrimary(
  parts: string[],
  start: number,
  parsed: ParsedAnchorLabel,
): number {
  let i = start;
  if (parts[i] === 'inner' || parts[i] === 'outer') i++;
  if (parts[i] === 'face') return parseAnchorNamedFace(parts, i + 1, parsed);
  if (parts[i] === 'side' || parts[i] === 'sides') {
    parsed.face = sideArgToFaceDir(parts[i + 1] ?? 'front');
    return i + 2;
  }
  if (parts[i]) {
    parsed.face = sideArgToFaceDir(parts[i]);
    return i + 1;
  }
  return i;
}

/**
 * Parses anchor named face from the supplied source into the references representation.
 */
function parseAnchorNamedFace(
  parts: string[],
  start: number,
  parsed: ParsedAnchorLabel,
): number {
  parsed.namedFace = parts[start];
  return start + 1;
}

/**
 * Parses anchor sub ref from the supplied source into the references representation.
 */
function parseAnchorSubRef(
  parts: string[],
  start: number,
  parsed: ParsedAnchorLabel,
): void {
  const subRef = parts[start];
  if (subRef === 'center') {
    parsed.subRef = 'center';
  } else if (subRef === 'corner') {
    parsed.subRef = 'corner';
    parsed.cornerArg = parts[start + 1];
  } else if (subRef === 'edge') {
    parsed.subRef = 'edge';
    parsed.edgeArg = parts[start + 1];
  }
}

/**
 * Resolves the face data required by the current selector.
 */
function faceNormal(dir: AnchorFaceDir): [number, number, number] {
  switch (dir) {
    case 'top':
      return [0, 0, 1];
    case 'bottom':
      return [0, 0, -1];
    case 'front':
      return [0, -1, 0];
    case 'back':
      return [0, 1, 0];
    case 'left':
      return [-1, 0, 0];
    case 'right':
      return [1, 0, 0];
  }
}

/**
 * Returns the default corner for anchor face used by this module.
 */
function defaultCornerForAnchorFace(dir: AnchorFaceDir): string {
  return dir === 'top' || dir === 'bottom' ? 'back_left' : 'top_left';
}

/**
 * Handles solid bounds in the references flow.
 */
function solidBounds(solid: SolidMetrics): {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
} {
  return {
    xMin: -solid.width / 2,
    xMax: solid.width / 2,
    yMin: -solid.height / 2,
    yMax: solid.height / 2,
    zMin: 0,
    zMax: solid.depth,
  };
}

/**
 * Resolves the face data required by the current selector.
 */
function faceCenterPoint(
  bounds: ReturnType<typeof solidBounds>,
  dir: AnchorFaceDir,
): [number, number, number] {
  const point: [number, number, number] = [
    (bounds.xMin + bounds.xMax) / 2,
    (bounds.yMin + bounds.yMax) / 2,
    (bounds.zMin + bounds.zMax) / 2,
  ];
  applyFaceBoundary(point, bounds, dir);
  return point;
}

/**
 * Applies face boundary to the supplied state or geometry.
 */
function applyFaceBoundary(
  point: [number, number, number],
  bounds: ReturnType<typeof solidBounds>,
  dir: AnchorFaceDir,
): void {
  switch (dir) {
    case 'top':
      point[2] = bounds.zMax;
      break;
    case 'bottom':
      point[2] = bounds.zMin;
      break;
    case 'front':
      point[1] = bounds.yMin;
      break;
    case 'back':
      point[1] = bounds.yMax;
      break;
    case 'left':
      point[0] = bounds.xMin;
      break;
    case 'right':
      point[0] = bounds.xMax;
      break;
  }
}

/**
 * Resolves the face data required by the current selector.
 */
function faceCornerPoint(
  bounds: ReturnType<typeof solidBounds>,
  dir: AnchorFaceDir,
  cornerArg = '',
): [number, number, number] {
  const point: [number, number, number] = [
    cornerArg.includes('right') ? bounds.xMax : bounds.xMin,
    cornerArg.includes('back') ? bounds.yMax : bounds.yMin,
    cornerArg.includes('bottom') ? bounds.zMin : bounds.zMax,
  ];
  applyFaceBoundary(point, bounds, dir);
  return point;
}

/**
 * Resolves the face data required by the current selector.
 */
function faceEdgePoint(
  bounds: ReturnType<typeof solidBounds>,
  dir: AnchorFaceDir,
  edgeArg = '',
): [number, number, number] {
  const point = faceCenterPoint(bounds, dir);
  if (edgeArg === 'front') point[1] = bounds.yMin;
  if (edgeArg === 'back') point[1] = bounds.yMax;
  if (edgeArg === 'left') point[0] = bounds.xMin;
  if (edgeArg === 'right') point[0] = bounds.xMax;
  if (edgeArg === 'top') point[2] = bounds.zMax;
  if (edgeArg === 'bottom') point[2] = bounds.zMin;
  return point;
}

/**
 * Returns the display label for anchor point for.
 */
function anchorPointForLabel(
  label: ParsedAnchorLabel,
  solid: SolidMetrics,
): [number, number, number] | null {
  if (!label.face) return null;
  const bounds = solidBounds(solid);
  if (label.subRef === 'center') return faceCenterPoint(bounds, label.face);
  if (label.subRef === 'edge')
    return faceEdgePoint(bounds, label.face, label.edgeArg);
  return faceCornerPoint(
    bounds,
    label.face,
    label.subRef === 'corner'
      ? label.cornerArg
      : defaultCornerForAnchorFace(label.face),
  );
}

/**
 * Returns the display label for planted anchor for.
 */
function plantedAnchorForLabel(
  parsed: ParsedAnchorLabel,
  label: string,
  ctx: EvalCtx,
): AnchorMetadata | null {
  const plant = ctx.plantAnchors.get(parsed.objName);
  if (!plant) return null;
  const matchesGeneratedRef = label === plant.ref;
  const matchesNamedFace =
    parsed.namedFace !== undefined && parsed.namedFace === plant.faceName;
  const matchesDefaultBottom =
    parsed.namedFace === undefined && parsed.face === 'bottom';
  if (!matchesGeneratedRef && !matchesNamedFace && !matchesDefaultBottom)
    return null;
  return {
    ref: label,
    localPoint: plant.localPoint,
    localNormal: plant.localNormal,
  };
}

/**
 * Resolves a dot-separated anchor label to its metadata.
 * Returns null if the object has no known solid metrics.
 */
export function placementAnchorFromLabel(
  label: string,
  ctx: EvalCtx,
): AnchorMetadata | null {
  const parsed = parseAnchorLabel(label);
  const plant = plantedAnchorForLabel(parsed, label, ctx);
  if (plant) return plant;
  if (!parsed.face) return null;
  const solid = ctx.solidMetrics.get(parsed.objName);
  if (!solid) return null;
  const localPoint = anchorPointForLabel(parsed, solid);
  if (!localPoint) return null;
  return {
    ref: label,
    localPoint,
    localNormal: faceNormal(parsed.face),
  };
}
