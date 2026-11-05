/**
 * @author Aidan Boissonneault
 * @file component-recipe-tasks.ts
 * @purpose Provides component recipe tasks behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRProgram, PreparedComponentArtifact } from '@bushscad/ir';

/**
 * Selected members of IROp used for component op.
 */
export type ComponentOp = Extract<
  IROp,
  {
    kind:
      | 'solidPrimitive'
      | 'extrude'
      | 'revolve'
      | 'radial_extrude'
      | 'loft'
      | 'sweep';
  }
>;

/**
 * Type used for independent component consumer.
 */
export type IndependentComponentConsumer = Readonly<{
  partName: string;
  sourceIndex: number;
  name: string;
  operation: ComponentOp;
  semanticConsumerIds: readonly string[];
  cacheBreakpoint?: 'automatic' | 'manual';
}>;

/**
 * Type used for independent component task.
 */
export type IndependentComponentTask = Readonly<{
  id: string;
  recipeDigest: string;
  recipeCanonical: string;
  cacheSafe: boolean;
  partName: string;
  sourceIndex: number;
  name: string;
  operation: ComponentOp;
  semanticConsumerIds: readonly string[];
  consumers: readonly IndependentComponentConsumer[];
  program: IRProgram;
}>;

/**
 * Derives `ComponentTaskCandidate` from `IndependentComponentConsumer & Readonly<{ recipeDigest:
 * string; recipeCanonical: string; cacheSafe: boolean; program: IRProgram; }>` to preserve its type relationship in the pipeline parallel
 * compilation layer.
 */
export type ComponentTaskCandidate = IndependentComponentConsumer &
  Readonly<{
    recipeDigest: string;
    recipeCanonical: string;
    cacheSafe: boolean;
    program: IRProgram;
  }>;

/** Groups safe source-ordered component instances by verified recipe identity. */
export function groupComponentRecipeTasks(
  candidates: readonly ComponentTaskCandidate[],
  reuseRecipes: boolean,
): IndependentComponentTask[] {
  const tasks: MutableComponentTask[] = [];
  const byRecipe = new Map<string, MutableComponentTask>();
  for (const candidate of candidates) {
    const existing = reuseRecipes
      ? byRecipe.get(candidate.recipeDigest)
      : undefined;
    if (existing) {
      existing.consumers.push(consumer(candidate));
      existing.semanticConsumerIds.push(...candidate.semanticConsumerIds);
      continue;
    }
    const task = taskFromCandidate(candidate, reuseRecipes);
    tasks.push(task);
    if (reuseRecipes) byRecipe.set(candidate.recipeDigest, task);
  }
  return tasks.map(freezeTask);
}

/** Expands one shared BRep byte artifact into distinct semantic sidecars. */
export function materializePreparedComponentArtifact(
  task: IndependentComponentTask,
  artifact: PreparedComponentArtifact,
): PreparedComponentArtifact[] {
  if (
    artifact.name !== task.name ||
    artifact.operationKind !== task.operation.kind
  ) {
    throw new Error(
      `Prepared recipe '${task.id}' returned the wrong artifact.`,
    );
  }
  return task.consumers.map((item) => ({
    ...artifact,
    partName: item.partName,
    name: item.name,
    operationKind: item.operation.kind,
    span: item.operation.span,
    semanticConsumerIds: [...item.semanticConsumerIds],
    brep: artifact.brep,
  }));
}

/** Rebuilds the current semantic sidecar around a cached lossless BRep. */
export function cachedPreparedComponentArtifact(
  task: IndependentComponentTask,
  brep: Uint8Array,
): PreparedComponentArtifact {
  return {
    format: 'occt-brep-v1',
    partName: task.partName,
    name: task.name,
    operationKind: task.operation.kind,
    span: task.operation.span,
    semanticConsumerIds: [...task.semanticConsumerIds],
    brep,
  };
}

/**
 * Derives `MutableComponentTask` from `Omit< IndependentComponentTask, 'semanticConsumerIds' |
 * 'consumers' > & { semanticConsumerIds: string[]; consumers: IndependentComponentConsumer[]; }` to
 * preserve its type relationship in the pipeline parallel compilation layer.
 */
type MutableComponentTask = Omit<
  IndependentComponentTask,
  'semanticConsumerIds' | 'consumers'
> & {
  semanticConsumerIds: string[];
  consumers: IndependentComponentConsumer[];
};

/**
 * Handles task from candidate in the pipeline parallel compilation flow.
 */
function taskFromCandidate(
  candidate: ComponentTaskCandidate,
  reuseRecipes: boolean,
): MutableComponentTask {
  const identity =
    candidate.semanticConsumerIds[0] ?? String(candidate.sourceIndex);
  return {
    id: reuseRecipes
      ? `component-recipe:${candidate.recipeDigest}`
      : `component-instance:${candidate.recipeDigest}:${identity}`,
    recipeDigest: candidate.recipeDigest,
    recipeCanonical: candidate.recipeCanonical,
    cacheSafe: candidate.cacheSafe,
    partName: candidate.partName,
    sourceIndex: candidate.sourceIndex,
    name: candidate.name,
    operation: candidate.operation,
    semanticConsumerIds: [...candidate.semanticConsumerIds],
    consumers: [consumer(candidate)],
    program: candidate.program,
  };
}

/**
 * Handles consumer in the pipeline parallel compilation flow.
 */
function consumer(
  candidate: IndependentComponentConsumer,
): IndependentComponentConsumer {
  return {
    partName: candidate.partName,
    sourceIndex: candidate.sourceIndex,
    name: candidate.name,
    operation: candidate.operation,
    semanticConsumerIds: [...candidate.semanticConsumerIds],
    ...(candidate.cacheBreakpoint
      ? { cacheBreakpoint: candidate.cacheBreakpoint }
      : {}),
  };
}

/**
 * Handles freeze task in the pipeline parallel compilation flow.
 */
function freezeTask(task: MutableComponentTask): IndependentComponentTask {
  return {
    ...task,
    semanticConsumerIds: [...new Set(task.semanticConsumerIds)].sort(),
    consumers: [...task.consumers],
  };
}
