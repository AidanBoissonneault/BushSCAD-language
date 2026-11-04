/** Implements the modifiers behavior owned by the OCCT bridge. */

import { FuseBridge } from '../fuse/fuse.js';

import type {
  IROp,
  IRFillet,
  IRChamfer,
  IRDraft,
  OcctError,
  ValidationResult,
} from '@bushscad/ir';

import { FaceLabelMap } from '../../topology/face-labels.js';

import { parseFaceRef } from '../../core/program-utils.js';

import {
  isOcctError,
  occtError,
  rawErrorMessage,
} from '../../core/occt-errors.js';

import {
  canApplyDeferredPartModifiers,
  splitDeferredPartModifiers,
} from '../modifier-deferral.js';

import {
  pushOpError,
  pushOpStart,
  pushOpSuccess,
  snapshotBodies,
  type OcctBuildTrace,
} from '../build-trace.js';

import type {
  GroupBuildState,
  ModifierBodyGroup,
  ModifierOp,
  OC,
} from '../../bridge/bridge-types.js';

export abstract class ModifiersBridge extends FuseBridge {
  protected override flushModifiersWithTrace(
    state: GroupBuildState,
    partName: string,
    trace?: OcctBuildTrace,
  ): void {
    if (!trace || state.pendingModifiers.length === 0) {
      this.flushModifiers(state);
      return;
    }

    const phaseOps = [...state.pendingModifiers];
    const phaseOp = {
      kind: 'modifiers',
      target: phaseOps.map((op) => `${op.kind}:${op.target}`).join(', '),
      span: phaseOps[0]?.span ?? { file: '(occt)', line: 1, col: 1 },
    } as unknown as IROp;
    const before = snapshotBodies(state);
    const startedAt = Date.now();
    pushOpStart(trace, partName, phaseOp, before);
    try {
      this.flushModifiers(state);
    } catch (err) {
      const message = isOcctError(err)
        ? (err as OcctError).message
        : rawErrorMessage(err);
      pushOpError(
        trace,
        partName,
        phaseOp,
        before,
        message,
        isOcctError(err) ? (err as OcctError).span : phaseOp.span,
        Date.now() - startedAt,
      );
      throw err;
    }
    pushOpSuccess(
      trace,
      partName,
      phaseOp,
      before,
      snapshotBodies(state),
      Date.now() - startedAt,
    );
  }

  protected override flushModifiers(state: GroupBuildState): void {
    if (state.pendingModifiers.length === 0) return;
    const phaseOps = state.pendingModifiers.splice(0);
    if (canApplyDeferredPartModifiers(state, phaseOps)) {
      this.applyDeferredPartModifierPhase(state, phaseOps);
    } else if (state.partSolidOwner && state.partSolidComponents.size > 2) {
      this.applySplitPartModifierPhase(state, phaseOps);
    } else {
      this.applyFlushedModifierPhase(state, phaseOps);
    }
  }

  protected override applySplitPartModifierPhase(
    state: GroupBuildState,
    phaseOps: ModifierOp[],
  ): void {
    const { deferredPrefix, fusedSuffix } = splitDeferredPartModifiers(
      state,
      phaseOps,
    );
    if (deferredPrefix.length > 0) {
      this.applyDeferredPartModifierPhase(state, deferredPrefix);
    }
    if (fusedSuffix.length > 0) {
      this.applyFlushedModifierPhase(state, fusedSuffix);
    }
    if (fusedSuffix.length === 0 && deferredPrefix.length === 0) {
      this.applyFlushedModifierPhase(state, phaseOps);
    }
  }

  protected override applyFlushedModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
  ): void {
    this.flushPartSolid(state, ops[0]?.span);
    this.applyFusedModifierPhase(state, ops);
  }

  protected override applyDeferredPartModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
  ): void {
    this.applyModifierPhase(
      state,
      ops,
      state.labelMap,
      (name) =>
        state.partSolidAliasComponents.get(name) ?? this.ownerFor(state, name),
      (name, shape) => this.replaceDeferredPartComponent(state, name, shape),
      (validation) => state.modifierValidations.push(validation),
    );
  }

  protected override applyFusedModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
  ): void {
    this.applyModifierPhase(
      state,
      ops,
      state.labelMap,
      (name) => this.ownerFor(state, name),
      (name, shape) => this.replaceBody(state, name, shape),
      (validation) => state.modifierValidations.push(validation),
    );
  }

  protected override replaceDeferredPartComponent(
    state: GroupBuildState,
    name: string,
    shape: OC,
  ): void {
    const component = state.partSolidAliasComponents.get(name);
    if (!component) {
      this.replaceBody(state, name, shape);
      return;
    }
    state.partSolidComponents.set(component, shape);
    for (const [alias, aliasComponent] of state.partSolidAliasComponents) {
      if (aliasComponent === component) {
        this.registerPartSolidAliasComponent(state, alias, shape);
      }
    }
    const owner = state.partSolidOwner;
    if (owner) state.bodyShapes.set(owner, shape);
  }

  protected override applyModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
    labelMap: FaceLabelMap,
    ownerFor: (name: string) => string,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
  ): void {
    const groups: ModifierBodyGroup[] = [];
    const byOwner = new Map<string, ModifierBodyGroup>();

    for (const op of ops) {
      const parsed = parseFaceRef(op.target);
      const shape = labelMap.getShape(parsed.objName);
      if (!shape)
        throw occtError(
          `Unknown object '${parsed.objName}' for ${op.kind}`,
          op.span,
        );

      const owner = ownerFor(parsed.objName);
      let group = byOwner.get(owner);
      if (!group) {
        group = { owner, ops: [] };
        byOwner.set(owner, group);
        groups.push(group);
      }
      group.ops.push(op);
    }

    for (const group of groups) {
      const draftOps = group.ops.filter(
        (op): op is IRDraft => op.kind === 'draft',
      );
      const chamferOps = group.ops.filter(
        (op): op is IRChamfer => op.kind === 'chamfer',
      );
      const filletOps = group.ops.filter(
        (op): op is IRFillet => op.kind === 'fillet',
      );
      const firstChamferIndex = group.ops.findIndex(
        (op) => op.kind === 'chamfer',
      );
      const earlyFeatureFillets =
        firstChamferIndex >= 0
          ? filletOps.filter(
              (op) =>
                group.ops.indexOf(op) < firstChamferIndex &&
                parseFaceRef(op.target).objName !== group.owner,
            )
          : [];
      const remainingFillets =
        earlyFeatureFillets.length > 0
          ? filletOps.filter((op) => !earlyFeatureFillets.includes(op))
          : filletOps;

      this.applyDraftPhase(group.owner, draftOps, labelMap, replaceBody);
      const earlyFeatureFilletSelections = this.applyBlendModifierPhase(
        'fillet',
        group.owner,
        earlyFeatureFillets,
        labelMap,
        replaceBody,
        recordValidation,
        state,
        [],
      );
      this.applyBlendModifierPhase(
        'chamfer',
        group.owner,
        chamferOps,
        labelMap,
        replaceBody,
        recordValidation,
        state,
        chamferOps.some((op) => parseFaceRef(op.target).objName !== group.owner)
          ? earlyFeatureFilletSelections.map((selection) => selection.edge)
          : [],
      );
      this.applyBlendModifierPhase(
        'fillet',
        group.owner,
        remainingFillets,
        labelMap,
        replaceBody,
        recordValidation,
        state,
        [],
      );
    }
  }
}
