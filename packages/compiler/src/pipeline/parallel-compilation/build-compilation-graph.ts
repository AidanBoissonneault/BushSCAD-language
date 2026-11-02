/**
 * @author Aidan Boissonneault
 * @file build-compilation-graph.ts
 * @purpose Builds compilation graph for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationGraphBuildResult,
  CompilationPartDependency,
  IRProgram,
} from '@bushscad/ir';
import { operationAccess } from '@bushscad/evaluator';
import { GraphAssembly, graphId } from './graph-assembly.js';
import { CompileLocalRecipeRegistry } from './compile-local-recipes.js';
import { operationNeedsContinuation } from './operation-continuations.js';
import { canonicalRecipe } from './recipe-canonicalization.js';
import { validateCompilationGraph } from './validate-compilation-graph.js';
import {
  dependencyRecipeMap,
  globalName,
  nextEntityResource,
  operationLabel,
  partitionProgram,
  scoped,
  semanticKey,
  type Producer,
} from './graph-lowering-support.js';
import {
  connectInputs,
  resolvePendingInputs,
  type PendingInput,
} from './graph-dependencies.js';

/**
 * Type used for options for compilation graph.
 */
export type CompilationGraphOptions = Readonly<{
  entrypoint: string;
  assetDigests?: Readonly<Record<string, string>>;
}>;

/** Lowers evaluated classic IR into an observational, non-executing DAG. */
export function buildCompilationGraph(
  program: IRProgram,
  options: CompilationGraphOptions,
): CompilationGraphBuildResult {
  const assembly = new GraphAssembly();
  const groups = partitionProgram(program.ops);
  const producers = new Map<string, Producer>();
  const revisions = new Map<string, number>();
  const recipes = new Map<string, string>();
  const recipeRegistry = new CompileLocalRecipeRegistry();
  const pending: PendingInput[] = [];
  const finalParts = new Map<string, string>();
  const partDeps = new Map<string, Set<string>>();
  let sourceOrder = 0;

  const sourceId = assembly.addNode({
    key: options.entrypoint,
    kind: 'source',
    label: options.entrypoint,
    sourceOrder: sourceOrder++,
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: false,
    continuation: false,
    cacheSafe: true,
    estimatedCost: 'metadata',
    writes: [`source:${options.entrypoint}`],
  });

  for (const group of groups) {
    partDeps.set(group.name, new Set());
    const partResource = `part:${group.name}@0`;
    const partId = assembly.addNode({
      key: `${options.entrypoint}|${group.name}|declaration`,
      kind: 'part',
      label: group.name,
      sourceOrder: sourceOrder++,
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
    assembly.addEdge(sourceId, partId, 'scope', `source:${options.entrypoint}`);
    let currentPartNode = partId;
    let partVersion = 0;

    for (const { op, index } of group.ops) {
      const access = operationAccess(op);
      const outputs = [...access.schedulingOutputs];
      const key = semanticKey(options.entrypoint, group.name, op, index);
      const semanticId = graphId(access.role, key);
      const dependencyDigests = dependencyRecipeMap(group.name, recipes);
      const canonical = access.recipeEligible
        ? canonicalRecipe(op, {
            program,
            dependencyDigests,
            assetDigests: options.assetDigests,
          })
        : null;
      const recipe = canonical
        ? {
            ...canonical,
            digest: recipeRegistry.intern(canonical).key,
          }
        : null;
      let recipeId: string | undefined;
      if (recipe) {
        recipeId = assembly.addNode({
          key: recipe.digest,
          kind: 'recipe',
          label: `${op.kind}:${recipe.digest}`,
          sourceOrder: sourceOrder++,
          polarity: 'neutral',
          topologySensitive: false,
          orderSensitive: false,
          continuation: false,
          cacheSafe: recipe.cacheSafe,
          estimatedCost: access.estimatedCost,
          recipeDigest: recipe.digest,
          writes: [`recipe:${recipe.digest}`],
        });
      }

      const outputResources = outputs.map((name) =>
        nextEntityResource(group.name, name, revisions),
      );
      const nodeId = assembly.addNode({
        key,
        kind: access.role,
        label: operationLabel(op, outputs, index),
        sourceOrder: sourceOrder++,
        span: op.span,
        partName: group.name,
        operationKind: op.kind,
        polarity: access.polarity,
        topologySensitive: access.topologySensitive,
        orderSensitive: access.orderSensitive,
        continuation: operationNeedsContinuation(op),
        cacheSafe: Boolean(recipe?.cacheSafe && access.cacheSafe),
        estimatedCost: access.estimatedCost,
        ...(recipe ? { recipeDigest: recipe.digest } : {}),
        writes:
          outputResources.length > 0
            ? outputResources
            : [`intent:${semanticId}`],
      });
      if (recipeId) {
        assembly.addConsumer(recipeId, nodeId);
        assembly.addEdge(recipeId, nodeId, 'shape', `recipe:${recipe?.digest}`);
      }
      assembly.addEdge(partId, nodeId, 'scope');
      connectInputs(
        assembly,
        access.schedulingInputs,
        outputs,
        access.topologySensitive,
        group.name,
        nodeId,
        producers,
        pending,
      );
      if (access.topologySensitive)
        assembly.addEdge(
          currentPartNode,
          nodeId,
          'topology',
          `part:${group.name}@${partVersion}`,
        );

      outputs.forEach((name, outputIndex) => {
        const resource = outputResources[outputIndex];
        if (!resource) return;
        const producer = {
          nodeId,
          resource,
          partName: group.name,
          ...(recipe ? { recipeDigest: recipe.digest } : {}),
        };
        producers.set(scoped(group.name, name), producer);
        if (group.name === '__default__')
          producers.set(globalName(name), producer);
        if (recipe) recipes.set(scoped(group.name, name), recipe.digest);
      });

      if (access.partEffect) {
        const previous = `part:${group.name}@${partVersion}`;
        partVersion++;
        const next = `part:${group.name}@${partVersion}`;
        const versionId = assembly.addNode({
          key: `${options.entrypoint}|${group.name}|version|${partVersion}`,
          kind: 'part-version',
          label: `${group.name}@${partVersion}`,
          sourceOrder: sourceOrder++,
          span: op.span,
          partName: group.name,
          operationKind: op.kind,
          polarity: access.polarity,
          topologySensitive: access.topologySensitive,
          orderSensitive: true,
          continuation: false,
          cacheSafe: false,
          estimatedCost: access.estimatedCost,
          writes: [next],
        });
        assembly.addEdge(currentPartNode, versionId, 'effect-order', previous);
        assembly.addEdge(
          nodeId,
          versionId,
          access.orderSensitive ? 'barrier' : 'shape',
        );
        currentPartNode = versionId;
      }
    }

    const finalId = assembly.addNode({
      key: `${options.entrypoint}|${group.name}|final`,
      kind: 'output',
      label: `final:${group.name}`,
      sourceOrder: sourceOrder++,
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
      currentPartNode,
      finalId,
      'output',
      `part:${group.name}@${partVersion}`,
    );
    finalParts.set(group.name, finalId);
  }

  resolvePendingInputs(assembly, pending, producers, finalParts, partDeps);
  const outputId = assembly.addNode({
    key: `${options.entrypoint}|compilation-output`,
    kind: 'output',
    label: 'compilation-output',
    sourceOrder,
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: true,
    continuation: false,
    cacheSafe: false,
    estimatedCost: 'light',
    writes: ['compilation:output'],
  });
  for (const [partName, finalId] of finalParts)
    assembly.addEdge(finalId, outputId, 'output', `part:${partName}:final`);

  const dependencies: CompilationPartDependency[] = [...partDeps].map(
    ([partName, dependsOn]) => ({ partName, dependsOn: [...dependsOn] }),
  );
  const graph = assembly.freeze(options.entrypoint, dependencies, outputId);
  const diagnostics = validateCompilationGraph(graph);
  return Object.freeze({ graph, diagnostics, ok: diagnostics.length === 0 });
}
