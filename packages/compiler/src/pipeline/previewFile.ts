/**
 * @author Aidan Boissonneault
 * @file previewFile.ts
 * @purpose Provides preview file behavior for the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { compileFileToIr } from './compileFileToIr.js';
import { getBridge } from '../platform/node/nodeOcct.js';
import { compileFailure, toCompileError } from '../platform/node/nodePaths.js';
import type {
  CompileFileOptions,
  PreviewResult,
} from '../platform/node/nodeTypes.js';
import type { IROp } from '@bushscad/ir';

/**
 * Selects the ops to hand to the geometry bridge: truncates at the timeline
 * cursor and drops suppressed ops. Compilation/IR is unaffected — only the
 * geometry build sees the filtered list.
 */
export function selectBuildOps(
  ops: IROp[],
  cursorOpIndex: number | undefined,
  suppressedOpIndices: number[] | undefined,
): IROp[] {
  const sliced =
    cursorOpIndex !== undefined && cursorOpIndex >= 0
      ? ops.slice(0, cursorOpIndex + 1)
      : ops;
  if (!suppressedOpIndices || suppressedOpIndices.length === 0) return sliced;
  const suppressed = new Set(suppressedOpIndices);
  return sliced.filter((_, i) => !suppressed.has(i));
}

/**
 * Compiles a file and converts the IR program into preview meshes.
 * Preview keeps compile errors and OpenCascade errors in the same result shape
 * for CLI and extension-service consumers.
 */
export async function previewFile(
  options: CompileFileOptions,
): Promise<PreviewResult> {
  const t0 = Date.now();
  const compiled = compileFileToIr(options);
  if (!compiled.ok) return compiled;

  try {
    const bridge = await getBridge();
    const buildOps = selectBuildOps(
      compiled.program.ops,
      options.cursorOpIndex,
      options.suppressedOpIndices,
    );
    const buildProgram =
      buildOps === compiled.program.ops
        ? compiled.program
        : { ...compiled.program, ops: buildOps };
    const result = bridge.build(
      buildProgram,
      compiled.assets,
      compiled.drawings,
      {
        trace: options.occtTrace === true,
        onTraceEvent: options.onOcctTraceEvent,
      },
    );
    if (!result.ok) {
      return {
        ...compileFailure([result.error], compiled.env, t0),
        ...(result.occtTraceEvents
          ? { occtTraceEvents: result.occtTraceEvents }
          : {}),
      };
    }
    const interaction = result.interaction ?? compiled.program.interaction;
    if (!interaction) {
      throw new Error('Preview build did not produce interaction provenance');
    }
    return {
      ok: true,
      program: compiled.program,
      drawings: result.drawings,
      meshes: result.meshes,
      interaction,
      validations: result.validations,
      joints: result.joints,
      env: compiled.env,
      dependents: compiled.workspace.dependents,
      ...(result.occtTraceEvents
        ? { occtTraceEvents: result.occtTraceEvents }
        : {}),
      elapsedMs: Date.now() - t0,
    };
  } catch (error) {
    return compileFailure([toCompileError(error)], compiled.env, t0);
  }
}
