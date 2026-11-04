/** Composes the operation-specific bridge layers into the public bridge operations. */

import { PathSweepBridge } from '../operations/path-sweep/path-sweep.js';

import type {
  CompileAssets,
  IRProgram,
  OcctError,
  ExportFormat,
  DrawingProgram,
  PreparedComponentArtifact,
} from '@bushscad/ir';

import { FaceLabelMap } from '../topology/face-labels.js';

import { deleteBuiltPartShapes } from '../mesh/material-shapes.js';

import { buildFailureResult } from './build-failure-result.js';

import { serializeNativeBrep } from './native-brep-artifacts.js';

import { isOcctError, occtError } from '../core/occt-errors.js';

import {
  createOcctBuildTrace,
  pushTraceEvent,
} from '../operations/build-trace.js';

import type {
  BuildResult,
  BuiltPart,
  ExportResult,
  PrepareComponentResult,
  OC,
} from './bridge-types.js';
import {
  componentPreparationTarget,
  componentPreparationError,
} from './occt-bridge-base.js';
import type { OcctBuildOptions } from './occt-bridge-base.js';

export class OcctBridgeImplementation extends PathSweepBridge {
  constructor(oc: OC) {
    super(oc);
  }

  /** Builds a complete IR program and releases native shapes after extraction. */
  build(
    program: IRProgram,
    assets: CompileAssets = { fonts: [], shapes: [] },
    drawingProgram?: DrawingProgram,
    options: OcctBuildOptions = {},
  ): BuildResult {
    const trace = options.trace
      ? createOcctBuildTrace(options.onTraceEvent)
      : undefined;
    const startedAt = Date.now();
    try {
      pushTraceEvent(trace, { kind: 'build-start' });
      this.installAssets(assets);
      const { meshes, validations, drawings, joints, interaction } =
        this.buildProgramWithValidation(
          program,
          drawingProgram,
          trace,
          options.autoColorOffset ?? 0,
          options.preparedComponents,
          options.nativeBooleanPlan,
          options.nativeBooleanConcurrencyLimit ?? 1,
        );
      pushTraceEvent(trace, {
        kind: 'build-success',
        elapsedMs: Date.now() - startedAt,
      });
      return {
        ok: true,
        meshes,
        validations,
        drawings,
        joints,
        ...(interaction ? { interaction } : {}),
        ...(trace ? { occtTraceEvents: trace.events } : {}),
      };
    } catch (e) {
      return buildFailureResult(e, trace, startedAt);
    }
  }

  /** Builds one self-contained positive component and returns native BRep. */
  prepareComponent(
    program: IRProgram,
    name: string,
    semanticConsumerIds: readonly string[],
    assets: CompileAssets = { fonts: [], shapes: [] },
  ): PrepareComponentResult {
    const target = componentPreparationTarget(program, name);
    if (!target.ok) return target;
    const { group, operation } = target;
    let built: Omit<BuiltPart, 'group'> | undefined;
    try {
      this.installAssets(assets);
      built = this.buildGroup(
        group,
        new FaceLabelMap(),
        program.workplane ?? 'XY',
      );
      const shape = built.bodyShapes.get(name);
      if (!shape)
        throw occtError(
          `Prepared component '${name}' has no shape.`,
          operation.span,
        );
      const artifact: PreparedComponentArtifact = {
        format: 'occt-brep-v1',
        partName: group.name,
        name,
        operationKind:
          operation.kind as PreparedComponentArtifact['operationKind'],
        span: operation.span,
        semanticConsumerIds: [...semanticConsumerIds],
        brep: serializeNativeBrep(this.oc, shape),
      };
      return { ok: true, artifact };
    } catch (error) {
      return {
        ok: false,
        error: componentPreparationError(error, operation.span),
      };
    } finally {
      if (built) deleteBuiltPartShapes([{ group, ...built }]);
    }
  }

  /**
   * Builds the program and writes the requested geometry and drawing exports.
   */
  export(
    program: IRProgram,
    format: ExportFormat,
    assets: CompileAssets = { fonts: [], shapes: [] },
    drawingProgram?: DrawingProgram,
    options: Pick<
      OcctBuildOptions,
      'nativeBooleanPlan' | 'nativeBooleanConcurrencyLimit'
    > = {},
  ): ExportResult {
    try {
      this.installAssets(assets);
      const { buffers, drawings } = this.exportProgram(
        program,
        format,
        drawingProgram,
        options.nativeBooleanPlan,
        options.nativeBooleanConcurrencyLimit ?? 1,
      );
      return { ok: true, buffers, drawings };
    } catch (e) {
      if (isOcctError(e)) return { ok: false, error: e as OcctError };
      throw e;
    }
  }
}
