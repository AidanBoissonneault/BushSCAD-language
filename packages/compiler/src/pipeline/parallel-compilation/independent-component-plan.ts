/**
 * @author Aidan Boissonneault
 * @file independent-component-plan.ts
 * @purpose Provides independent component plan behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRPartBoundary, IRProgram } from '@bushscad/ir';
import type { CacheBreakpoint } from '../../types/types.js';
import { operationAccess } from '@bushscad/evaluator';
import { buildCompilationGraph } from './build-compilation-graph.js';
import {
  groupComponentRecipeTasks,
  type ComponentOp,
  type ComponentTaskCandidate,
  type IndependentComponentTask,
} from './component-recipe-tasks.js';
import { graphId } from './graph-assembly.js';
import {
  partitionProgram,
  semanticKey,
  type IndexedOp,
} from './graph-lowering-support.js';
import { matchesCacheCondition } from './cache-breakpoint-condition.js';
import { normalizePath } from '../../core/paths.js';

/**
 * Type used for options for independent component plan.
 */
export type IndependentComponentPlanOptions = Readonly<{
  reuseRecipes?: boolean;
  allowSingleComponent?: boolean;
  automaticallyAssignCacheBreakpoints?: boolean;
  cacheBreakpoints?: readonly CacheBreakpoint[];
}>;

/**
 * Type used for independent component plan.
 */
export type IndependentComponentPlan = Readonly<
  | {
      eligible: true;
      partName: string;
      tasks: readonly IndependentComponentTask[];
      reductionProgram: IRProgram;
      componentCount: number;
      avoidedBuildCount: number;
      recipeReuseEnabled: boolean;
    }
  | { eligible: false; reason: string }
>;

const DECLARATION_KINDS = new Set<IROp['kind']>(['sketch', 'path']);

/**
 * Plans P4 preparation for self-contained positive components in one part.
 * Native BRep transfer is safe only when the reduction worker can replay
 * the original declarations and reconstruct every label from the authored op.
 */
export function planIndependentComponentCompilation(
  program: IRProgram,
  entrypoint: string,
  options: IndependentComponentPlanOptions = {},
): IndependentComponentPlan {
  const groups = partitionProgram(program.ops);
  if (groups.length !== 1 || !groups[0]?.boundary)
    return ineligible('component preparation requires one explicit part');
  const graph = buildCompilationGraph(program, { entrypoint });
  if (!graph.ok) return ineligible('the compilation graph is invalid');

  const group = groups[0];
  const producersByName = outputProducers(group.ops);
  const candidates = group.ops.flatMap((indexed) => {
    const candidate = componentCandidate(indexed, {
      entrypoint,
      groupName: group.name,
      boundary: group.boundary as IRPartBoundary,
      producersByName,
      graph,
      options,
      program,
    });
    return candidate ? [candidate] : [];
  });
  if (candidates.length < (options.allowSingleComponent ? 1 : 2))
    return ineligible('fewer than two transferable positive components');
  if (new Set(candidates.map((task) => task.name)).size !== candidates.length)
    return ineligible('component output names are not unique');
  const recipeReuseEnabled = options.reuseRecipes !== false;
  const tasks = groupComponentRecipeTasks(candidates, recipeReuseEnabled);
  return {
    eligible: true,
    partName: group.name,
    tasks,
    reductionProgram: program,
    componentCount: candidates.length,
    avoidedBuildCount: candidates.length - tasks.length,
    recipeReuseEnabled,
  };
}

type ComponentCandidateContext = {
  entrypoint: string;
  groupName: string;
  boundary: IRPartBoundary;
  producersByName: ProducerMap;
  graph: ReturnType<typeof buildCompilationGraph>;
  options: IndependentComponentPlanOptions;
  program: IRProgram;
};

/** Builds a task only when its source operation and recipe graph are reusable. */
function componentCandidate(
  indexed: IndexedOp,
  context: ComponentCandidateContext,
): ComponentTaskCandidate | undefined {
  if (!isSafeComponent(indexed, context.producersByName)) return undefined;
  const dependencies = dependencyClosure(indexed, context.producersByName);
  if (!dependencies) return undefined;
  const operation = indexed.op as ComponentOp;
  const graphNode = context.graph.graph.nodes.find(
    (node) =>
      node.id ===
      componentGraphNodeId(context.entrypoint, context.groupName, indexed),
  );
  const recipeNode = context.graph.graph.nodes.find(
    (node) =>
      node.kind === 'recipe' && node.recipeDigest === graphNode?.recipeDigest,
  );
  if (!graphNode?.recipeDigest || !recipeNode?.recipeCanonical) {
    return undefined;
  }
  const cacheBreakpoint = selectedCacheBreakpoint(indexed.op, context.options);
  return {
    recipeDigest: graphNode.recipeDigest,
    recipeCanonical: recipeNode.recipeCanonical,
    cacheSafe: graphNode.cacheSafe,
    partName: context.groupName,
    sourceIndex: indexed.index,
    name: operation.objName,
    operation,
    semanticConsumerIds: [graphNode.id ?? componentIdentity(operation)],
    ...(cacheBreakpoint ? { cacheBreakpoint } : {}),
    program: componentProgram(
      context.program,
      context.boundary,
      dependencies,
      operation,
    ),
  };
}

/** Selects automatic or explicitly marked source operations for BRep reuse. */
function selectedCacheBreakpoint(
  operation: IROp,
  options: IndependentComponentPlanOptions,
): 'automatic' | 'manual' | undefined {
  const manual = options.cacheBreakpoints?.find(
    (breakpoint) =>
      normalizePath(breakpoint.filePath) === operation.span.file &&
      breakpoint.line === operation.span.line,
  );
  if (manual)
    return !manual.condition ||
      matchesCacheCondition(manual.condition, operation.cacheContext)
      ? 'manual'
      : undefined;
  return options.automaticallyAssignCacheBreakpoints === true
    ? 'automatic'
    : undefined;
}

/** Encodes the first proven-safe P4 operation rule table. */
function isSafeComponent(indexed: IndexedOp, producers: ProducerMap): boolean {
  const { op } = indexed;
  switch (op.kind) {
    case 'solidPrimitive':
      return op.placement === null;
    case 'extrude':
      return safeExtrude(op, indexed, producers);
    case 'revolve':
      return safeRevolve(op, indexed, producers);
    case 'radial_extrude':
      return safeRadialExtrude(op, indexed, producers);
    case 'loft':
    case 'sweep':
      return dependenciesAreLocal(indexed, producers);
    default:
      return false;
  }
}

/**
 * Handles safe extrude in the pipeline parallel compilation flow.
 */
function safeExtrude(
  op: Extract<IROp, { kind: 'extrude' }>,
  indexed: IndexedOp,
  producers: ProducerMap,
): boolean {
  return (
    op.from === null &&
    !op.wrap &&
    !op.closedBodyNames?.length &&
    dependenciesAreLocal(indexed, producers)
  );
}

/**
 * Handles safe revolve in the pipeline parallel compilation flow.
 */
function safeRevolve(
  op: Extract<IROp, { kind: 'revolve' }>,
  indexed: IndexedOp,
  producers: ProducerMap,
): boolean {
  return (
    typeof op.around === 'string' && dependenciesAreLocal(indexed, producers)
  );
}

/**
 * Handles safe radial extrude in the pipeline parallel compilation flow.
 */
function safeRadialExtrude(
  op: Extract<IROp, { kind: 'radial_extrude' }>,
  indexed: IndexedOp,
  producers: ProducerMap,
): boolean {
  return (
    op.from === null &&
    typeof op.axis === 'string' &&
    op.extent.kind === 'angle-length' &&
    dependenciesAreLocal(indexed, producers)
  );
}

/**
 * Handles dependencies are local in the pipeline parallel compilation flow.
 */
function dependenciesAreLocal(
  indexed: IndexedOp,
  producers: ProducerMap,
): boolean {
  const closure = dependencyClosure(indexed, producers);
  return Boolean(
    closure &&
    closure.every(
      ({ op: dependency }) =>
        DECLARATION_KINDS.has(dependency.kind) &&
        (dependency.kind !== 'sketch' ||
          (dependency.placement === null && !dependency.surfaceBound)),
    ),
  );
}

/**
 * Handles dependency closure in the pipeline parallel compilation flow.
 */
function dependencyClosure(
  indexed: IndexedOp,
  producers: ProducerMap,
): IndexedOp[] | null {
  const pending = dependencyInputs(indexed);
  const included = new Map<number, IndexedOp>();
  while (pending.length > 0) {
    const dependency = pending.pop();
    if (!dependency) break;
    const producer = previousProducer(
      producers.get(dependency.name),
      dependency.beforeIndex,
    );
    if (!producer) {
      if (dependency.mayBeSelfOutput) continue;
      return null;
    }
    if (!DECLARATION_KINDS.has(producer.op.kind)) return null;
    if (included.has(producer.index)) continue;
    included.set(producer.index, producer);
    pending.push(...dependencyInputs(producer));
  }
  return [...included.values()].sort((left, right) => left.index - right.index);
}

/**
 * Type used for input for dependency.
 */
type DependencyInput = Readonly<{
  name: string;
  beforeIndex: number;
  mayBeSelfOutput: boolean;
}>;

/**
 * Type used for producer map.
 */
type ProducerMap = ReadonlyMap<string, readonly IndexedOp[]>;

/** Resolves an operation's inputs against declarations visible before it. */
function dependencyInputs(indexed: IndexedOp): DependencyInput[] {
  const access = operationAccess(indexed.op);
  const outputs = new Set(access.schedulingOutputs);
  return access.schedulingInputs.map((name) => ({
    name,
    beforeIndex: indexed.index,
    mayBeSelfOutput: outputs.has(name),
  }));
}

/**
 * Handles previous producer in the pipeline parallel compilation flow.
 */
function previousProducer(
  producers: readonly IndexedOp[] | undefined,
  beforeIndex: number,
): IndexedOp | undefined {
  if (!producers) return undefined;
  for (let index = producers.length - 1; index >= 0; index--) {
    const producer = producers[index];
    if (producer && producer.index < beforeIndex) return producer;
  }
  return undefined;
}

/**
 * Handles output producers in the pipeline parallel compilation flow.
 */
function outputProducers(ops: readonly IndexedOp[]): Map<string, IndexedOp[]> {
  const result = new Map<string, IndexedOp[]>();
  for (const indexed of ops) {
    for (const output of operationAccess(indexed.op).schedulingOutputs) {
      const producers = result.get(output) ?? [];
      producers.push(indexed);
      result.set(output, producers);
    }
  }
  return result;
}

/**
 * Builds the component data required by the current operation.
 */
function componentProgram(
  program: IRProgram,
  boundary: IRPartBoundary,
  dependencies: readonly IndexedOp[],
  operation: ComponentOp,
): IRProgram {
  return {
    ...program,
    ops: [boundary, ...dependencies.map(({ op }) => op), operation],
    parts: [boundary.name],
  };
}

/**
 * Builds the component data required by the current operation.
 */
function componentIdentity(operation: ComponentOp): string {
  return `${operation.kind}:${operation.objName}:${operation.span.file}:${operation.span.line}:${operation.span.col}`;
}

/**
 * Builds the component data required by the current operation.
 */
function componentGraphNodeId(
  entrypoint: string,
  partName: string,
  indexed: IndexedOp,
): string {
  const access = operationAccess(indexed.op);
  return graphId(
    access.role,
    semanticKey(entrypoint, partName, indexed.op, indexed.index),
  );
}

/**
 * Handles ineligible in the pipeline parallel compilation flow.
 */
function ineligible(reason: string): IndependentComponentPlan {
  return { eligible: false, reason };
}
