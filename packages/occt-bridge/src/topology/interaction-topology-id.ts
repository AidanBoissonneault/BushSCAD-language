/**
 * @author Aidan Boissonneault
 * @file interaction-topology-id.ts
 * @purpose Provides interaction topology ID behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

const POSITION_PRECISION = 1e5;

/**
 * Handles rounded in the topology flow.
 */
function rounded(value: number): number {
  const result = Math.round(value * POSITION_PRECISION);
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Handles hash in the topology flow.
 */
function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(36);
}

/**
 * Derives a stable topology ID from semantic ownership and geometric position.
 * Mesh traversal and tessellation density can change between display styles;
 * the identity must therefore avoid triangle or edge-array indices.
 */
export function interactionTopologyId(
  ownerId: string,
  kind: 'face' | 'edge' | 'corner' | 'point',
  points: readonly number[],
): string {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (let index = 0; index + 2 < points.length; index += 3) {
    xs.push(points[index] ?? 0);
    ys.push(points[index + 1] ?? 0);
    zs.push(points[index + 2] ?? 0);
  }
  const signature = [
    Math.min(...xs),
    Math.min(...ys),
    Math.min(...zs),
    Math.max(...xs),
    Math.max(...ys),
    Math.max(...zs),
  ]
    .map(rounded)
    .join(',');
  return `${ownerId}|${kind}|${hash(signature)}`;
}
