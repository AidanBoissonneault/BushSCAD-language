/**
 * @author Aidan Boissonneault
 * @file topology.ts
 * @purpose Provides topology behavior for the analysis in model analysis package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from '@bushscad/ir';

/**
 * Summary of topology, including boundary edges, non manifold edges, and disconnected
 * components.
 */
type TopologySummary = {
  boundaryEdges: number;
  nonManifoldEdges: number;
  disconnectedComponents: number;
};

/**
 * Checks mesh connectivity and edge usage.
 * Loft and boolean failures often still produce triangles, but boundary,
 * non-manifold, or disconnected topology exposes the bad output directly.
 */
export function analyzeTopology(mesh: MeshData): TopologySummary {
  const edgeUse = new Map<string, number>();
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
    const tri = [
      mesh.indices[i] ?? 0,
      mesh.indices[i + 1] ?? 0,
      mesh.indices[i + 2] ?? 0,
    ];
    addEdge(edgeUse, adjacency, tri[0], tri[1]);
    addEdge(edgeUse, adjacency, tri[1], tri[2]);
    addEdge(edgeUse, adjacency, tri[2], tri[0]);
  }
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeUse.values()) {
    if (count === 1) boundaryEdges++;
    if (count > 2) nonManifoldEdges++;
  }
  return {
    boundaryEdges,
    nonManifoldEdges,
    disconnectedComponents: countComponents(adjacency),
  };
}

/**
 * Adds edge to its owning collection.
 */
function addEdge(
  edgeUse: Map<string, number>,
  adjacency: Map<number, Set<number>>,
  a: number,
  b: number,
): void {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
  addAdjacent(adjacency, a, b);
  addAdjacent(adjacency, b, a);
}

/**
 * Adds adjacent to its owning collection.
 */
function addAdjacent(
  adjacency: Map<number, Set<number>>,
  a: number,
  b: number,
): void {
  let set = adjacency.get(a);
  if (!set) {
    set = new Set();
    adjacency.set(a, set);
  }
  set.add(b);
}

/**
 * Handles count components in the analysis flow.
 */
function countComponents(adjacency: Map<number, Set<number>>): number {
  const seen = new Set<number>();
  let count = 0;
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    count++;
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const next = stack.pop()!;
      for (const candidate of adjacency.get(next) ?? []) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        stack.push(candidate);
      }
    }
  }
  return count;
}
