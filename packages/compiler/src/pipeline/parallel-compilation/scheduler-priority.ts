/**
 * @author Aidan Boissonneault
 * @file scheduler-priority.ts
 * @purpose Provides scheduler priority behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph, CompilationGraphNode } from '@bushscad/ir';

/**
 * Type used for scheduler priority analysis.
 */
export type SchedulerPriorityAnalysis = Readonly<{
  criticalPathCosts: ReadonlyMap<string, number>;
  dependents: ReadonlyMap<string, readonly string[]>;
  activeRequirementIds: ReadonlySet<string>;
}>;

/** Computes deterministic critical-path and active-requirement priority data. */
export function analyzeSchedulerPriority(
  graph: CompilationGraph,
  activeNodeIds: ReadonlySet<string> = new Set(),
): SchedulerPriorityAnalysis {
  const dependencies = dependencyMap(graph);
  const dependents = dependentMap(graph);
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const criticalPathCosts = new Map<string, number>();
  const visiting = new Set<string>();
  /**
   * Handles critical cost in the pipeline parallel compilation flow.
   */
  const criticalCost = (nodeId: string): number => {
    const cached = criticalPathCosts.get(nodeId);
    if (cached !== undefined) return cached;
    if (visiting.has(nodeId)) return 0;
    visiting.add(nodeId);
    const node = nodes.get(nodeId);
    const downstream = (dependents.get(nodeId) ?? []).reduce(
      (maximum, childId) => Math.max(maximum, criticalCost(childId)),
      0,
    );
    visiting.delete(nodeId);
    const total = nodeCost(node) + downstream;
    criticalPathCosts.set(nodeId, total);
    return total;
  };
  graph.nodes.forEach((node) => criticalCost(node.id));
  return Object.freeze({
    criticalPathCosts,
    dependents,
    activeRequirementIds: activeRequirements(activeNodeIds, dependencies),
  });
}

/** Sorts ready nodes by the scheduler's stable highest-priority-first tuple. */
export function rankReadySchedulerNodes(
  nodes: readonly CompilationGraphNode[],
  analysis: SchedulerPriorityAnalysis,
  remainingDependencies: ReadonlyMap<string, number>,
): CompilationGraphNode[] {
  return [...nodes].sort((left, right) => {
    const activeDelta =
      Number(analysis.activeRequirementIds.has(right.id)) -
      Number(analysis.activeRequirementIds.has(left.id));
    if (activeDelta !== 0) return activeDelta;
    const criticalDelta =
      (analysis.criticalPathCosts.get(right.id) ?? 0) -
      (analysis.criticalPathCosts.get(left.id) ?? 0);
    if (criticalDelta !== 0) return criticalDelta;
    const unblockDelta =
      unblockCount(right.id, analysis, remainingDependencies) -
      unblockCount(left.id, analysis, remainingDependencies);
    if (unblockDelta !== 0) return unblockDelta;
    const memoryDelta = nodeCost(left) - nodeCost(right);
    if (memoryDelta !== 0) return memoryDelta;
    return (
      left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id)
    );
  });
}

/**
 * Handles dependency map in the pipeline parallel compilation flow.
 */
function dependencyMap(graph: CompilationGraph): Map<string, string[]> {
  const result = new Map(graph.nodes.map((node) => [node.id, <string[]>[]]));
  for (const edge of graph.edges) result.get(edge.to)?.push(edge.from);
  for (const values of result.values()) values.sort();
  return result;
}

/**
 * Handles dependent map in the pipeline parallel compilation flow.
 */
function dependentMap(graph: CompilationGraph): Map<string, string[]> {
  const result = new Map(graph.nodes.map((node) => [node.id, <string[]>[]]));
  for (const edge of graph.edges) result.get(edge.from)?.push(edge.to);
  for (const values of result.values()) values.sort();
  return result;
}

/**
 * Handles active requirements in the pipeline parallel compilation flow.
 */
function activeRequirements(
  activeNodeIds: ReadonlySet<string>,
  dependencies: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> {
  const result = new Set<string>();
  const pending = [...activeNodeIds].sort();
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId || result.has(nodeId)) continue;
    result.add(nodeId);
    pending.push(...(dependencies.get(nodeId) ?? []));
  }
  return result;
}

/**
 * Handles unblock count in the pipeline parallel compilation flow.
 */
function unblockCount(
  nodeId: string,
  analysis: SchedulerPriorityAnalysis,
  remainingDependencies: ReadonlyMap<string, number>,
): number {
  return (analysis.dependents.get(nodeId) ?? []).filter(
    (dependent) => remainingDependencies.get(dependent) === 1,
  ).length;
}

/**
 * Handles node cost in the pipeline parallel compilation flow.
 */
function nodeCost(node?: CompilationGraphNode): number {
  if (!node) return 0;
  return { metadata: 1, light: 2, medium: 4, heavy: 8 }[node.estimatedCost];
}
