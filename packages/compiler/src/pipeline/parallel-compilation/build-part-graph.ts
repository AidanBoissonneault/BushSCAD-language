/**
 * @author Aidan Boissonneault
 * @file build-part-graph.ts
 * @purpose Adds one part's declarations, operations, and final output to the compilation graph.
 * @last-edited November 3, 2026
 */

import type { IRProgram } from '@bushscad/ir';
import { operationAccess } from '@bushscad/evaluator';
import { GraphAssembly, graphId } from './graph-assembly.js';
import { CompileLocalRecipeRegistry } from './compile-local-recipes.js';
import { operationNeedsContinuation } from './operation-continuations.js';
import {
  canonicalRecipe,
  type CanonicalRecipe,
} from './recipe-canonicalization.js';
import {
  dependencyRecipeMap,
  globalName,
  nextEntityResource,
  operationLabel,
  semanticKey,
  scoped,
  type PartGroup,
  type Producer,
} from './graph-lowering-support.js';
import { connectInputs, type PendingInput } from './graph-dependencies.js';
import type { CompilationGraphOptions } from './build-compilation-graph.js';

type PartGraphBuildInput = Readonly<{
  assembly: GraphAssembly;
  sourceId: string;
  group: PartGroup;
  program: IRProgram;
  options: CompilationGraphOptions;
  producers: Map<string, Producer>;
  revisions: Map<string, number>;
  recipes: Map<string, string>;
  recipeRegistry: CompileLocalRecipeRegistry;
  pending: PendingInput[];
  sourceOrder: number;
}>;

type PartGraphResult = Readonly<{
  finalNodeId: string;
  dependencies: Set<string>;
  sourceOrder: number;
}>;

type PartGraphContext = {
  assembly: GraphAssembly;
  group: PartGroup;
  program: IRProgram;
  options: CompilationGraphOptions;
  producers: Map<string, Producer>;
  revisions: Map<string, number>;
  recipes: Map<string, string>;
  recipeRegistry: CompileLocalRecipeRegistry;
  pending: PendingInput[];
  dependencies: Set<string>;
  currentPartNode: string;
  partVersion: number;
  sourceOrder: number;
};

/** Adds a single source-ordered part graph and returns its shared state. */
export function buildPartGraph(input: PartGraphBuildInput): PartGraphResult {
  const { assembly, group, options } = input;
  const dependencies = new Set<string>();
  const partResource = `part:${group.name}@0`;
  const partId = assembly.addNode({
    key: `${options.entrypoint}|${group.name}|declaration`,
    kind: 'part',
    label: group.name,
    sourceOrder: input.sourceOrder,
    ...(group.boundary ? { span: group.boundary.span } : {}),
    partName: group.name,
    operationKind: 'part',
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: true,
    continuation: false,
    cacheSafe: false,
    estimatedCost: 'metadata',
    writes: [partResource],
  });
  assembly.addEdge(
    input.sourceId,
    partId,
    'scope',
    `source:${options.entrypoint}`,
  );

  const context: PartGraphContext = {
    assembly,
    group,
    program: input.program,
    options,
    producers: input.producers,
    revisions: input.revisions,
    recipes: input.recipes,
    recipeRegistry: input.recipeRegistry,
    pending: input.pending,
    dependencies,
    currentPartNode: partId,
    partVersion: 0,
    sourceOrder: input.sourceOrder + 1,
  };
  for (const indexedOp of group.ops) addPartOperation(context, indexedOp);

  const finalNodeId = assembly.addNode({
    key: `${options.entrypoint}|${group.name}|final`,
    kind: 'output',
    label: `final:${group.name}`,
    sourceOrder: context.sourceOrder++,
    ...(group.boundary ? { span: group.boundary.span } : {}),
    partName: group.name,
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: true,
    continuation: false,
    cacheSafe: false,
    estimatedCost: 'light',
    writes: [`part:${group.name}:final`],
  });
  assembly.addEdge(
    context.currentPartNode,
    finalNodeId,
    'output',
    `part:${group.name}@${context.partVersion}`,
  );
  return {
    finalNodeId,
    dependencies,
    sourceOrder: context.sourceOrder,
  };
}

/** Adds one IR operation with its recipe, input, output, and effect edges. */
function addPartOperation(
  context: PartGraphContext,
  indexedOp: PartGroup['ops'][number],
): void {
  const { op, index } = indexedOp;
  const { group } = context;
  const access = operationAccess(op);
  const outputs = [...access.schedulingOutputs];
  const key = semanticKey(context.options.entrypoint, group.name, op, index);
  const semanticId = graphId(access.role, key);
  const { recipe, recipeId } = createOperationRecipe(context, op, access);
  const outputResources = outputs.map((name) =>
    nextEntityResource(group.name, name, context.revisions),
  );
  const nodeId = addOperationNode(
    context,
    op,
    index,
    access,
    outputs,
    outputResources,
    semanticId,
    key,
    recipe,
  );
  connectOperationEdges(context, access, nodeId, outputs, recipe, recipeId);
  recordOperationOutputs(context, outputs, outputResources, nodeId, recipe);
  if (access.partEffect) addPartVersion(context, nodeId, op, access);
}

/** Canonicalizes a cacheable operation and creates its shared recipe node. */
function createOperationRecipe(
  context: PartGraphContext,
  op: PartGroup['ops'][number]['op'],
  access: ReturnType<typeof operationAccess>,
): { recipe: CanonicalRecipe | null; recipeId: string | undefined } {
  const dependencyDigests = dependencyRecipeMap(
    context.group.name,
    context.recipes,
  );
  const canonical = access.recipeEligible
    ? canonicalRecipe(op, {
        program: context.program,
        dependencyDigests,
        assetDigests: context.options.assetDigests,
      })
    : null;
  const recipe = canonical
    ? {
        ...canonical,
        digest: context.recipeRegistry.intern(canonical).key,
      }
    : null;
  return {
    recipe,
    recipeId: recipe
      ? addRecipeNode(context, op, recipe, access.estimatedCost)
      : undefined,
  };
}

/** Creates the semantic node for one operation in authored order. */
function addOperationNode(
  context: PartGraphContext,
  op: PartGroup['ops'][number]['op'],
  index: number,
  access: ReturnType<typeof operationAccess>,
  outputs: readonly string[],
  outputResources: readonly string[],
  semanticId: string,
  key: string,
  recipe: CanonicalRecipe | null,
): string {
  return context.assembly.addNode({
    key,
    kind: access.role,
    label: operationLabel(op, outputs, index),
    sourceOrder: context.sourceOrder++,
    span: op.span,
    partName: context.group.name,
    operationKind: op.kind,
    polarity: access.polarity,
    topologySensitive: access.topologySensitive,
    orderSensitive: access.orderSensitive,
    continuation: operationNeedsContinuation(op),
    cacheSafe: Boolean(recipe?.cacheSafe && access.cacheSafe),
    estimatedCost: access.estimatedCost,
    ...(recipe ? { recipeDigest: recipe.digest } : {}),
    writes:
      outputResources.length > 0 ? outputResources : [`intent:${semanticId}`],
  });
}

/** Connects an operation's recipe, part scope, input, and topology edges. */
function connectOperationEdges(
  context: PartGraphContext,
  access: ReturnType<typeof operationAccess>,
  nodeId: string,
  outputs: readonly string[],
  recipe: CanonicalRecipe | null,
  recipeId: string | undefined,
): void {
  const { group, assembly } = context;
  if (recipeId) {
    assembly.addConsumer(recipeId, nodeId);
    assembly.addEdge(recipeId, nodeId, 'shape', `recipe:${recipe?.digest}`);
  }
  assembly.addEdge(context.currentPartNode, nodeId, 'scope');
  connectInputs(
    assembly,
    access.schedulingInputs,
    outputs,
    access.topologySensitive,
    group.name,
    nodeId,
    context.producers,
    context.pending,
  );
  if (access.topologySensitive)
    assembly.addEdge(
      context.currentPartNode,
      nodeId,
      'topology',
      `part:${group.name}@${context.partVersion}`,
    );
}

/** Creates a canonical recipe node before the semantic operation node. */
function addRecipeNode(
  context: PartGraphContext,
  op: PartGroup['ops'][number]['op'],
  recipe: CanonicalRecipe,
  estimatedCost: ReturnType<typeof operationAccess>['estimatedCost'],
): string {
  return context.assembly.addNode({
    key: recipe.digest,
    kind: 'recipe',
    label: `${op.kind}:${recipe.digest}`,
    sourceOrder: context.sourceOrder++,
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: false,
    continuation: false,
    cacheSafe: recipe.cacheSafe,
    estimatedCost,
    recipeDigest: recipe.digest,
    recipeCanonical: recipe.canonical,
    writes: [`recipe:${recipe.digest}`],
  });
}

/** Tracks the latest producer and recipe for each named operation output. */
function recordOperationOutputs(
  context: PartGraphContext,
  outputs: readonly string[],
  resources: readonly string[],
  nodeId: string,
  recipe: CanonicalRecipe | null,
): void {
  outputs.forEach((name, index) => {
    const resource = resources[index];
    if (!resource) return;
    const producer = {
      nodeId,
      resource,
      partName: context.group.name,
      ...(recipe ? { recipeDigest: recipe.digest } : {}),
    };
    context.producers.set(scoped(context.group.name, name), producer);
    if (context.group.name === '__default__')
      context.producers.set(globalName(name), producer);
    if (recipe)
      context.recipes.set(scoped(context.group.name, name), recipe.digest);
  });
}

/** Adds the next ordered part version after an operation mutates its contents. */
function addPartVersion(
  context: PartGraphContext,
  nodeId: string,
  op: PartGroup['ops'][number]['op'],
  access: ReturnType<typeof operationAccess>,
): void {
  const previous = `part:${context.group.name}@${context.partVersion}`;
  context.partVersion++;
  const next = `part:${context.group.name}@${context.partVersion}`;
  const versionId = context.assembly.addNode({
    key: `${context.options.entrypoint}|${context.group.name}|version|${context.partVersion}`,
    kind: 'part-version',
    label: `${context.group.name}@${context.partVersion}`,
    sourceOrder: context.sourceOrder++,
    span: op.span,
    partName: context.group.name,
    operationKind: op.kind,
    polarity: access.polarity,
    topologySensitive: access.topologySensitive,
    orderSensitive: true,
    continuation: false,
    cacheSafe: false,
    estimatedCost: access.estimatedCost,
    writes: [next],
  });
  context.assembly.addEdge(
    context.currentPartNode,
    versionId,
    'effect-order',
    previous,
  );
  context.assembly.addEdge(
    nodeId,
    versionId,
    access.orderSensitive ? 'barrier' : 'shape',
  );
  context.currentPartNode = versionId;
}
