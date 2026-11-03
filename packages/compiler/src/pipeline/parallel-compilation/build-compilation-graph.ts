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
import { GraphAssembly } from './graph-assembly.js';
import { buildPartGraph } from './build-part-graph.js';
import { CompileLocalRecipeRegistry } from './compile-local-recipes.js';
import { validateCompilationGraph } from './validate-compilation-graph.js';
import { partitionProgram, type Producer } from './graph-lowering-support.js';
import {
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
    const part = buildPartGraph({
      assembly,
      sourceId,
      group,
      program,
      options,
      producers,
      revisions,
      recipes,
      recipeRegistry,
      pending,
      sourceOrder,
    });
    sourceOrder = part.sourceOrder;
    partDeps.set(group.name, part.dependencies);
    finalParts.set(group.name, part.finalNodeId);
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
