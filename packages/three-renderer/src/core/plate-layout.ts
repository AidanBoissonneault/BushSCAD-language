/**
 * @author Aidan Boissonneault
 * @file plate-layout.ts
 * @purpose Computes part bounds and offsets for placing rendered parts on a build plate.
 * @last-edited October 6, 2026
 */

/**
 * Plate part bounds, including name, min x, max x, min y, and max y.
 */

export type PlatePartBounds = {
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
};

/**
 * Part layout offset, including x, y, and z.
 */
export type PartLayoutOffset = {
  x: number;
  y: number;
  z: number;
};

/** Expands part bounds from interleaved XYZ vertices at an optional view offset. */
export function includeVerticesInPartBounds<
  T extends PlatePartBounds & { maxZ?: number },
>(
  bounds: T,
  vertices: Float32Array,
  offset: PartLayoutOffset = { x: 0, y: 0, z: 0 },
): void {
  for (let index = 0; index < vertices.length; index += 3) {
    const x = (vertices[index] ?? 0) + offset.x;
    const y = (vertices[index + 1] ?? 0) + offset.y;
    const z = (vertices[index + 2] ?? 0) + offset.z;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    if (bounds.maxZ !== undefined) bounds.maxZ = Math.max(bounds.maxZ, z);
  }
}

/**
 * Derives `PackedPart` from `PlatePartBounds & { width: number; depth: number; packedX: number;
 * packedY: number; }` to preserve its type relationship in the core layer.
 */
type PackedPart = PlatePartBounds & {
  width: number;
  depth: number;
  packedX: number;
  packedY: number;
};

/**
 * Packs part footprints into deterministic rows centered on a printer bed.
 * This is a viewport-only print-layout aid. Oversized collections remain
 * centered and may overflow so the build-volume warning can identify them.
 */
export function computePlateLayout(
  parts: PlatePartBounds[],
  bedWidth: number,
  _bedDepth: number,
  gapMm: number,
): Map<string, PartLayoutOffset> {
  const sorted = [...parts].sort(comparePartFootprints);
  const packed: PackedPart[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowDepth = 0;

  for (const part of sorted) {
    const width = part.maxX - part.minX;
    const depth = part.maxY - part.minY;
    if (cursorX > 0 && cursorX + width > bedWidth) {
      cursorX = 0;
      cursorY += rowDepth + gapMm;
      rowDepth = 0;
    }
    packed.push({ ...part, width, depth, packedX: cursorX, packedY: cursorY });
    cursorX += width + gapMm;
    rowDepth = Math.max(rowDepth, depth);
  }

  const usedWidth = Math.max(
    0,
    ...packed.map((part) => part.packedX + part.width),
  );
  const usedDepth = Math.max(
    0,
    ...packed.map((part) => part.packedY + part.depth),
  );
  return offsetsFromPackedParts(packed, usedWidth, usedDepth);
}

/**
 * Compares part footprints using the requested criteria.
 */
function comparePartFootprints(
  left: PlatePartBounds,
  right: PlatePartBounds,
): number {
  const leftDepth = left.maxY - left.minY;
  const rightDepth = right.maxY - right.minY;
  if (rightDepth !== leftDepth) return rightDepth - leftDepth;
  const leftWidth = left.maxX - left.minX;
  const rightWidth = right.maxX - right.minX;
  if (rightWidth !== leftWidth) return rightWidth - leftWidth;
  return left.name.localeCompare(right.name);
}

/**
 * Handles offsets from packed parts in the core flow.
 */
function offsetsFromPackedParts(
  packed: PackedPart[],
  usedWidth: number,
  usedDepth: number,
): Map<string, PartLayoutOffset> {
  const offsets = new Map<string, PartLayoutOffset>();
  const shiftX = -usedWidth / 2;
  const shiftY = -usedDepth / 2;
  for (const part of packed) {
    offsets.set(part.name, {
      x: part.packedX + shiftX - part.minX,
      y: part.packedY + shiftY - part.minY,
      z: -part.minZ,
    });
  }
  return offsets;
}
