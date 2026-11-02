/**
 * @author Aidan Boissonneault
 * @file independent-part-plan.ts
 * @purpose Provides independent part plan behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRProgram } from '@bushscad/ir';
import { buildCompilationGraph } from './build-compilation-graph.js';
import { partitionProgram } from './graph-lowering-support.js';

/**
 * Type used for independent part batch.
 */
export type IndependentPartBatch = Readonly<{
  partName: string;
  sourceIndex: number;
  autoColorOffset: number;
  program: IRProgram;
}>;

/**
 * Type used for independent part plan.
 */
export type IndependentPartPlan = Readonly<
  | { eligible: true; batches: readonly IndependentPartBatch[] }
  | { eligible: false; reason: string }
>;

const COORDINATOR_ONLY_OPS = new Set<IROp['kind']>([
  'assert',
  'flat_pattern',
  'joint',
]);

/**
 * Selects the conservative P3 boundary: independent explicit whole parts.
 * Workers may own OCCT handles for a complete part, but P3 does not move
 * cross-part labels, validation shapes, drawings, or joint state between them.
 */
export function planIndependentPartCompilation(
  program: IRProgram,
  entrypoint: string,
): IndependentPartPlan {
  const groups = partitionProgram(program.ops);
  if (groups.length < 2) return ineligible('fewer than two part groups');
  if (groups.some((group) => !group.boundary)) {
    return ineligible('top-level geometry is present');
  }
  const unsafe = program.ops.find((op) => COORDINATOR_ONLY_OPS.has(op.kind));
  if (unsafe) return ineligible(`${unsafe.kind} requires classic assembly`);

  const graph = buildCompilationGraph(program, { entrypoint });
  if (!graph.ok) return ineligible('the compilation graph is invalid');
  const dependency = graph.graph.partDependencies.find(
    (part) => part.dependsOn.length > 0,
  );
  if (dependency) {
    return ineligible(
      `part '${dependency.partName}' has cross-part dependencies`,
    );
  }

  let autoColorOffset = 0;
  return {
    eligible: true,
    batches: groups.map((group, sourceIndex) => {
      const batch = {
        partName: group.name,
        sourceIndex,
        autoColorOffset,
        program: {
          ...program,
          ops: [group.boundary as IROp, ...group.ops.map(({ op }) => op)],
        },
      };
      if (!group.boundary?.color) autoColorOffset++;
      return batch;
    }),
  };
}

/**
 * Handles ineligible in the pipeline parallel compilation flow.
 */
function ineligible(reason: string): IndependentPartPlan {
  return { eligible: false, reason };
}
