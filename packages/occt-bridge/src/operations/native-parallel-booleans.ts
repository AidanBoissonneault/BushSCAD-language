/**
 * @author Aidan Boissonneault
 * @file native-parallel-booleans.ts
 * @purpose Provides native parallel booleans behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { isNullShape, occtError } from '../core/occt-errors.js';
import { BOOLEAN_TOLERANCE, validOrHealedShape } from './boolean-operations.js';

/**
 * Accepted values for native parallel boolean kind are 'cut' and 'fuse'.
 */
export type NativeParallelBooleanKind = 'cut' | 'fuse';

/**
 * Type used for result of native parallel boolean.
 */
export type NativeParallelBooleanResult = Readonly<{
  shape: OC;
  nativeApi: 'BOPAlgo_BOP';
  runParallel: true;
  booleanBuildCount: 1;
  elapsedMs: number;
  cpuMs?: number;
}>;

/**
 * Type used for snapshot of cpu.
 */
type CpuSnapshot = Readonly<{ user: number; system: number }>;

/** Reports whether the loaded module exposes the complete P6 native API. */
export function nativeParallelBooleanCapability(oc: OC): boolean {
  if (
    typeof oc.BOPAlgo_BOP_1 !== 'function' ||
    typeof oc.TopTools_ListOfShape_1 !== 'function' ||
    operationValue(oc, 'cut') === undefined ||
    operationValue(oc, 'fuse') === undefined
  )
    return false;
  let builder: OC | undefined;
  let list: OC | undefined;
  try {
    builder = new oc.BOPAlgo_BOP_1();
    list = new oc.TopTools_ListOfShape_1();
    return (
      hasMethods(builder, [
        'SetArguments',
        'SetTools',
        'SetOperation',
        'SetRunParallel',
        'RunParallel',
        'Perform',
        'Shape',
      ]) && hasMethods(list, ['Append_1'])
    );
  } catch {
    return false;
  } finally {
    builder?.delete?.();
    list?.delete?.();
  }
}

/**
 * Executes one multi-shape OCCT boolean with per-builder native parallelism.
 * Pairwise helpers intentionally force serial OCCT execution. P6 needs one
 * target argument, all tools in one builder, and an observable `RunParallel()`
 * confirmation without changing OCCT's process-global parallel policy.
 */
export function applyNativeParallelBoolean(
  oc: OC,
  kind: NativeParallelBooleanKind,
  target: OC,
  tools: readonly OC[],
  span: SourceSpan,
): NativeParallelBooleanResult {
  if (!nativeParallelBooleanCapability(oc)) {
    throw occtError(
      'Native parallel boolean batching is unavailable in this OpenCascade build',
      span,
    );
  }
  if (tools.length < 1) {
    throw occtError('Native parallel boolean requires at least one tool', span);
  }

  const argumentsList = new oc.TopTools_ListOfShape_1();
  const toolsList = new oc.TopTools_ListOfShape_1();
  const builder = new oc.BOPAlgo_BOP_1();
  const startedAt = Date.now();
  const cpuStartedAt = cpuSnapshot();
  try {
    argumentsList.Append_1(target);
    for (const tool of tools) toolsList.Append_1(tool);
    requireMethod(builder, 'SetArguments', span)(argumentsList);
    requireMethod(builder, 'SetTools', span)(toolsList);
    requireMethod(builder, 'SetOperation', span)(operationValue(oc, kind));
    builder.SetNonDestructive?.(true);
    builder.SetFuzzyValue?.(BOOLEAN_TOLERANCE);
    requireMethod(builder, 'SetRunParallel', span)(true);
    const runParallel = requireMethod(builder, 'RunParallel', span)();
    if (runParallel !== true) {
      throw occtError(
        'OpenCascade rejected native parallel boolean mode',
        span,
      );
    }
    requireMethod(builder, 'Perform', span)();
    if (builder.HasErrors?.() === true) {
      throw occtError(`Native parallel boolean ${kind} failed`, span);
    }
    const result = requireMethod(builder, 'Shape', span)();
    if (isNullShape(result)) {
      throw occtError(
        `Native parallel boolean ${kind} returned no shape`,
        span,
      );
    }
    const cpuMs = elapsedCpuMs(cpuStartedAt, cpuSnapshot());
    return {
      shape: validOrHealedShape(
        oc,
        result,
        span,
        `Native parallel boolean ${kind} failed`,
      ),
      nativeApi: 'BOPAlgo_BOP',
      runParallel: true,
      booleanBuildCount: 1,
      elapsedMs: Date.now() - startedAt,
      ...(cpuMs === undefined ? {} : { cpuMs }),
    };
  } finally {
    builder.delete?.();
    toolsList.delete?.();
    argumentsList.delete?.();
  }
}

/**
 * Handles cpu snapshot in the operations flow.
 */
function cpuSnapshot(): CpuSnapshot | undefined {
  const runtimeProcess = (
    globalThis as typeof globalThis & {
      process?: { cpuUsage?: () => CpuSnapshot };
    }
  ).process;
  return runtimeProcess?.cpuUsage?.();
}

/**
 * Handles elapsed cpu ms in the operations flow.
 */
function elapsedCpuMs(
  start?: CpuSnapshot,
  end?: CpuSnapshot,
): number | undefined {
  if (!start || !end) return;
  return (end.user - start.user + end.system - start.system) / 1_000;
}

/**
 * Dispatches the operation to its matching action handler.
 */
function operationValue(oc: OC, kind: NativeParallelBooleanKind): unknown {
  const key = kind === 'cut' ? 'BOPAlgo_CUT' : 'BOPAlgo_FUSE';
  return oc.BOPAlgo_Operation?.[key] ?? oc[key];
}

/**
 * Handles require method in the operations flow.
 */
function requireMethod(
  target: OC,
  name: string,
  span: SourceSpan,
): (...args: OC[]) => OC {
  const method = target?.[name];
  if (typeof method !== 'function') {
    throw occtError(`Native parallel boolean API is missing '${name}'`, span);
  }
  return method.bind(target) as (...args: OC[]) => OC;
}

/**
 * Checks whether the input has methods.
 */
function hasMethods(target: OC, names: readonly string[]): boolean {
  return names.every((name) => typeof target?.[name] === 'function');
}
