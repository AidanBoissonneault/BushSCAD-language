/** Implements the group dispatch behavior owned by the OCCT bridge. */

import { BuildPipelineBridge } from '../../bridge/build-pipeline/build-pipeline.js';

import type { IROp, OcctError, PreparedComponentArtifact } from '@bushscad/ir';

import type { PartGroup } from '../../core/program-utils.js';

import {
  buildAlignShapeOperation,
  buildImportShapeOperation,
  buildRefOperation,
} from '../imported-ref-shapes.js';

import {
  preparedComponentName,
  restorePreparedComponent,
} from '../../bridge/prepared-component-assembly.js';

import {
  describeUnexpectedOcctException,
  isOcctError,
  occtError,
} from '../../core/occt-errors.js';

import { isModifierOp } from '../modifier-classification.js';

import {
  applyDispatchedGroupOperation,
  type GroupOperationHandlers,
} from '../group-operation-dispatch.js';

import {
  buildSurfaceFillOperation,
  buildSurfaceOffsetOperation,
} from '../../surfaces/surfaces.js';

import { NativeBooleanBatchRuntime } from '../native-boolean-batch-runtime.js';

import {
  pushOpError,
  pushOpStart,
  pushOpSuccess,
  snapshotBodies,
  type OcctBuildTrace,
} from '../build-trace.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class GroupDispatchBridge extends BuildPipelineBridge {
  protected override applyGroupOperations(
    group: PartGroup,
    state: GroupBuildState,
    trace: OcctBuildTrace | undefined,
    nativeBatches: NativeBooleanBatchRuntime | undefined,
    preparedComponents: readonly PreparedComponentArtifact[] | undefined,
  ): void {
    for (const [opIndex, op] of group.ops.entries()) {
      this.applyGroupOperationEntry(
        group,
        state,
        op,
        opIndex,
        trace,
        nativeBatches,
        preparedComponents,
      );
    }
    this.flushModifiersWithTrace(state, group.name, trace);
  }

  protected override applyGroupOperationEntry(
    group: PartGroup,
    state: GroupBuildState,
    op: PartGroup['ops'][number],
    opIndex: number,
    trace: OcctBuildTrace | undefined,
    nativeBatches: NativeBooleanBatchRuntime | undefined,
    preparedComponents: readonly PreparedComponentArtifact[] | undefined,
  ): void {
    if (isModifierOp(op)) {
      state.pendingModifiers.push(op);
      return;
    }

    this.flushModifiersWithTrace(state, group.name, trace);
    const prepared = preparedComponents?.find(
      (artifact) =>
        artifact.partName === group.name &&
        artifact.name === preparedComponentName(op) &&
        artifact.operationKind === op.kind,
    );
    if (prepared) {
      restorePreparedComponent(this.oc, state, op, prepared, {
        addBody: (name, shape, frame, material, span, sourcePlane) =>
          this.addBody(state, name, shape, frame, material, span, sourcePlane),
        addExtrudedBody: (operation, shape, axis) =>
          this.addExtrudedBody(state, operation, shape, axis),
        addBodyFromSketchAxis: (name, sketch, shape, material, span) =>
          this.addBodyFromSketchAxis(
            state,
            name,
            sketch,
            shape,
            material,
            span,
          ),
        revolveBodyFrame: (operation, axis) =>
          this.revolveBodyFrame(state, operation, axis),
        revolveAxisVectors: (operation, axis) =>
          this.revolveAxisVectors(state, operation, axis),
      });
      return;
    }
    this.runGroupOperationWithTrace(
      group,
      state,
      op,
      opIndex,
      trace,
      nativeBatches,
    );
  }

  protected override runGroupOperationWithTrace(
    group: PartGroup,
    state: GroupBuildState,
    op: PartGroup['ops'][number],
    opIndex: number,
    trace: OcctBuildTrace | undefined,
    nativeBatches: NativeBooleanBatchRuntime | undefined,
  ): void {
    const before = snapshotBodies(state);
    const opStartedAt = Date.now();
    pushOpStart(trace, group.name, op, before);
    try {
      if (!nativeBatches?.apply(opIndex, op)) {
        this.applyGroupOperation(state, op);
      }
    } catch (err) {
      const message = isOcctError(err)
        ? (err as OcctError).message
        : describeUnexpectedOcctException(err, op.kind);
      pushOpError(
        trace,
        group.name,
        op,
        before,
        message,
        isOcctError(err) ? (err as OcctError).span : op.span,
        Date.now() - opStartedAt,
      );
      if (isOcctError(err)) throw err;
      throw occtError(describeUnexpectedOcctException(err, op.kind), op.span);
    }
    pushOpSuccess(
      trace,
      group.name,
      op,
      before,
      snapshotBodies(state),
      Date.now() - opStartedAt,
    );
  }

  protected override applyGroupOperation(
    state: GroupBuildState,
    op: IROp,
  ): void {
    applyDispatchedGroupOperation(this.groupOperationHandlers(state), op);
  }

  protected override groupOperationHandlers(
    state: GroupBuildState,
  ): GroupOperationHandlers {
    return {
      sketch: (op) => this.buildSketchOperation(state, op),
      extrude: (op) => this.buildExtrudeOperation(state, op),
      solidPrimitive: (op) => this.buildSolidPrimitiveOperation(state, op),
      fuse: (op) => this.buildFuseOperation(state, op),
      cut: (op) => this.buildCutOperation(state, op),
      solid_cut: (op) => this.buildSolidCutOperation(state, op),
      revolve: (op) => this.buildRevolveOperation(state, op),
      radial_extrude: (op) => this.buildRadialExtrudeOperation(state, op),
      radial_cut: (op) => this.buildRadialCutOperation(state, op),
      loft: (op) => this.buildLoftOperation(state, op),
      shell: (op) => this.buildShellGroupOperation(state, op),
      rotate: (op) => this.buildRotateOperation(state, op),
      patternLinear: (op) => this.buildPatternLinearOperation(state, op),
      patternRadial: (op) => this.buildPatternRadialOperation(state, op),
      mirror: (op) => this.buildMirrorOperation(state, op),
      transform: (op) => this.buildTransformOperation(state, op),
      path: (op) => this.buildPathOperation(state, op),
      sweep: (op) => this.buildSweepOperation(state, op),
      sweep_cut: (op) => this.buildSweepCutOperation(state, op),
      surface: (op) => buildSurfaceFillOperation(this.oc, state, op),
      surfaceOffset: (op) => buildSurfaceOffsetOperation(this.oc, state, op),
      surfaceThicken: (op) => this.buildSurfaceThickenOperation(state, op),
      thread: (op) => this.buildThreadGroupOperation(state, op),
      fit: (op) => state.fitMetadata.set(op.fitName, op),
      hardware_visual: (op) => this.buildHardwareVisualOperation(state, op),
      importShape: (op) => buildImportShapeOperation(this.oc, state, op),
      heal: (op) => this.buildHealOperation(state, op),
      defeature: (op) => this.buildDefeatureOperation(state, op),
      ref: (op) => buildRefOperation(this.oc, state, op),
      declareShape: (op) => this.declareShapeSource(state, op.name, op.span),
      alignShape: (op) => buildAlignShapeOperation(this.oc, state, op),
    };
  }
}
