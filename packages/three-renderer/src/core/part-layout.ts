/**
 * @author Aidan Boissonneault
 * @file part-layout.ts
 * @purpose Computes part placement offsets from the bounds used by the renderer.
 * @last-edited October 6, 2026
 */

/**
 * Input for part layout, including name, span x, min x, span y, and span z.
 */

type PartLayoutInput = {
  name: string;
  spanX: number;
  minX: number;
  /**
   * Optional Y/Z extents. When present, the bin-packer uses
   * `max(spanX, spanY, spanZ)` as the slot width so parts whose primary
   * extent is along Y or Z (radial sweeps, vertical features) cannot
   * overlap the previous part's bbox. Backwards-compatible when omitted.
   */
  spanY?: number;
  spanZ?: number;
};

/**
 * 1D bin-pack along +X. Parts sorted by descending effective span
 * (name asc as deterministic tiebreak), placed center-to-center with
 * `gapMm` between bounding boxes, then recentered around the origin.
 * Returns each part's X offset (to move part's bbox center to slot center).
 *
 * For 0 or 1 input parts every offset is 0 — no separation is applied.
 */
export function computePartLayout(
  parts: PartLayoutInput[],
  gapMm: number,
): Map<string, number> {
  const offsets = new Map<string, number>();
  if (parts.length <= 1) {
    for (const p of parts) offsets.set(p.name, 0);
    return offsets;
  }

  /**
   * Handles slot width in the core flow.
   */
  const slotWidth = (p: PartLayoutInput): number =>
    Math.max(p.spanX, p.spanY ?? 0, p.spanZ ?? 0);

  const sorted = [...parts].sort((a, b) => {
    const sa = slotWidth(a);
    const sb = slotWidth(b);
    if (sb !== sa) return sb - sa;
    return a.name.localeCompare(b.name);
  });

  let cursor = 0;
  for (const p of sorted) {
    const slot = slotWidth(p);
    const partCenterX = p.minX + p.spanX / 2;
    const slotCenter = cursor + slot / 2;
    offsets.set(p.name, slotCenter - partCenterX);
    cursor += slot + gapMm;
  }
  const totalSpan = cursor - gapMm;
  const shift = -totalSpan / 2;
  for (const [name, off] of offsets) offsets.set(name, off + shift);
  return offsets;
}
