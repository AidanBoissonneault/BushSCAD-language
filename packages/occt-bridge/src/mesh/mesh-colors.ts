/**
 * @author Aidan Boissonneault
 * @file mesh-colors.ts
 * @purpose Provides mesh colors behavior for the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

export const AUTO_MESH_COLORS = [
  '#2D9CDB',
  '#F65D5D',
  '#27AE60',
  '#F2C94C',
  '#00B8D9',
  '#F2994A',
  '#00A896',
  '#9BC53D',
] as const;

/**
 * Part mesh color, including color and uses default color.
 */
export type PartMeshColor = {
  color: string;
  usesDefaultColor: boolean;
};

/** Preserves whether a bridge color came from source metadata or auto-coloring. */
export function resolvePartMeshColor(
  explicitColor: string | null | undefined,
  nextColor: () => string,
): PartMeshColor {
  return explicitColor
    ? { color: explicitColor, usesDefaultColor: false }
    : { color: nextColor(), usesDefaultColor: true };
}
