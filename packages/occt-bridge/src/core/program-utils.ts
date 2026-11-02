/**
 * @author Aidan Boissonneault
 * @file program-utils.ts
 * @purpose Provides program utils behavior for the core in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRPartBoundary } from '@bushscad/ir';
import { normalizeReferenceLabel } from '@bushscad/ir';

// Part grouping

/**
 * Part group, including name, color, and ops.
 */
export interface PartGroup {
  name: string;
  color: string | null;
  ops: Exclude<IROp, IRPartBoundary>[];
}

/**
 * Handles partition by part in the core flow.
 */
export function partitionByPart(ops: IROp[]): PartGroup[] {
  const groups: PartGroup[] = [];
  let current: PartGroup | null = null;

  for (const op of ops) {
    if (op.kind === 'part') {
      if (current && current.ops.length > 0) groups.push(current);
      current = { name: op.name, color: op.color, ops: [] };
    } else {
      if (!current) current = { name: '__default__', color: null, ops: [] };
      current.ops.push(op as Exclude<IROp, IRPartBoundary>);
    }
  }

  if (current && current.ops.length > 0) groups.push(current);
  return groups;
}

/**
 * Exports name for part group to the requested format.
 */
export function exportNameForPartGroup(
  groupName: string,
  hasExplicitParts: boolean,
): string {
  if (groupName === '__default__')
    return hasExplicitParts ? 'output_main' : 'output';
  return groupName;
}

// Face reference parsing

/**
 * Accepted values for face dir are 'top', 'bottom', 'front', 'back', 'left', and 'right'.
 */
export type FaceDir = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/**
 * Parsed face ref, including obj name, qualifier, face, named face, and named face filters.
 */
export interface ParsedFaceRef {
  objName: string;
  qualifier?: 'inner' | 'outer';
  face?: FaceDir;
  namedFace?: string;
  namedFaceFilters?: { name: string; value: string }[];
  curved?: boolean;
  subRef?: 'edges' | 'center' | 'perimeter' | 'corner' | 'edge';
  cornerArg?: string; // e.g. 'front_left'
  edgeArg?: string; // e.g. 'front'
}

// Parses serialized face refs like:
//   "base.top"
//   "base.top.edges"
//   "base.top.corner.front_left"    (corner(front_left) → "corner.front_left")
//   "body.outer.side.front.center"  (side(front) → "side.front")
//   "body.inner.bottom"
/**
 * Parses face ref from the supplied source into the core representation.
 */
export function parseFaceRef(ref: string): ParsedFaceRef {
  const parts = normalizeReferenceLabel(ref).split('.');
  const result: ParsedFaceRef = { objName: parts[0] };
  let i = 1;

  if (i < parts.length && (parts[i] === 'inner' || parts[i] === 'outer')) {
    result.qualifier = parts[i] as 'inner' | 'outer';
    i++;
  }

  i = parsePrimaryFaceSegment(parts, i, result);
  parseTrailingSubRef(parts, i, result);

  return result;
}

/**
 * Parses the primary face segment (subRef, named face, curved, side, or
 * direction) starting at `start`, returning the next unconsumed index.
 */
function parsePrimaryFaceSegment(
  parts: string[],
  start: number,
  result: ParsedFaceRef,
): number {
  let i = start;
  if (i >= parts.length) return i;

  const part = parts[i];
  if (isDirectSubRef(part)) {
    result.subRef = part;
    return i + 1;
  }
  if (parts[i] === 'face') {
    return parseNamedFaceSegment(parts, i + 1, result);
  }
  if (parts[i] === 'curved') {
    result.curved = true;
    return i + 1;
  }
  if (parts[i] === 'side' || parts[i] === 'sides') {
    i++;
    if (i < parts.length) {
      result.face = sideArgToDir(parts[i]);
      i++;
    }
    return i;
  }
  result.face = parts[i] as FaceDir;
  return i + 1;
}

/**
 * Returns whether the input meets the `direct sub ref` condition.
 */
function isDirectSubRef(
  part: string,
): part is 'edges' | 'center' | 'perimeter' {
  return part === 'edges' || part === 'center' || part === 'perimeter';
}

/**
 * Parses named face segment from the supplied source into the core representation.
 */
function parseNamedFaceSegment(
  parts: string[],
  start: number,
  result: ParsedFaceRef,
): number {
  let i = start;
  if (i >= parts.length) return i;
  result.namedFace = parts[i];
  i++;
  const filters = parseNamedFaceFilters(parts, i);
  if (filters.length > 0) result.namedFaceFilters = filters;
  return i + filters.length * 2;
}

/**
 * Parses named face filters from the supplied source into the core representation.
 */
function parseNamedFaceFilters(
  parts: string[],
  start: number,
): { name: string; value: string }[] {
  const filters: { name: string; value: string }[] = [];
  for (let i = start; i + 1 < parts.length; i += 2) {
    filters.push({ name: parts[i], value: parts[i + 1] });
  }
  return filters;
}

/** Parses the trailing sub-reference (edges/center/perimeter/corner/edge). */
function parseTrailingSubRef(
  parts: string[],
  start: number,
  result: ParsedFaceRef,
): void {
  if (start >= parts.length) return;
  const sub = parts[start];
  if (sub === 'edges' || sub === 'center' || sub === 'perimeter') {
    result.subRef = sub;
  } else if (sub === 'corner') {
    result.subRef = 'corner';
    if (start + 1 < parts.length) result.cornerArg = parts[start + 1];
  } else if (sub === 'edge') {
    result.subRef = 'edge';
    if (start + 1 < parts.length) result.edgeArg = parts[start + 1];
  }
}

/**
 * Handles side arg to dir in the core flow.
 */
function sideArgToDir(arg: string): FaceDir {
  const map: Record<string, FaceDir> = {
    front: 'front',
    back: 'back',
    left: 'left',
    right: 'right',
    top: 'top',
    bottom: 'bottom',
  };
  return map[arg] ?? 'front';
}
