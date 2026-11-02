/**
 * @author Aidan Boissonneault
 * @file mesh-colors.ts
 * @purpose Provides mesh colors behavior for the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

export const AUTO_MESH_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#059669',
  '#DC2626',
  '#D97706',
  '#0891B2',
  '#BE185D',
  '#0D9488',
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
