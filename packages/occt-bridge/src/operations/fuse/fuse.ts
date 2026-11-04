/** Implements the fuse behavior owned by the OCCT bridge. */

import { TransformBridge } from '../transform/transform.js';

import { type FusedAliasSources } from '../../bridge/occt-bridge-base.js';

import type { IRFuse, MaterialAppearance, SourceSpan } from '@bushscad/ir';

import type { FaceFrame } from '../../topology/face-labels.js';

import { workplaneFrame } from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import {
  addDeferredPartComponent,
  commitDeferredPartSolid,
} from '../part-solid.js';

import { type PreparedNativeFuse } from '../native-boolean-batch-runtime.js';

import { nativeParallelBooleanCapability } from '../native-parallel-booleans.js';

import type { SourceAttachmentPlane } from '../../topology/source-edge-recovery.js';

import type {
  BodyEdgeMode,
  GroupBuildState,
  OC,
} from '../../bridge/bridge-types.js';

export abstract class FuseBridge extends TransformBridge {
  protected override ownerFor(state: GroupBuildState, name: string): string {
    return state.bodyOwners.get(name) ?? name;
  }

  protected override registerBodyAliases(
    state: GroupBuildState,
    owner: string,
    shape: OC,
  ): void {
    const frame = state.bodyFrames.get(owner);
    for (const [name, knownOwner] of state.bodyOwners) {
      if (knownOwner === owner) {
        state.labelMap.register(
          this.oc,
          name,
          shape,
          state.bodyEdgeModes.get(name) ?? 'outer',
          frame,
          undefined,
          state.bodyAttachmentPlanes.get(name),
        );
      }
    }
  }

  protected override registerPartSolidAliases(
    state: GroupBuildState,
    shape: OC,
  ): void {
    const owner = state.partSolidOwner;
    if (!owner) return;
    const ownerFrame =
      state.bodyFrames.get(owner) ?? workplaneFrame(state.defaultWorkplane);
    for (const alias of state.partSolidAliases) {
      state.bodyOwners.set(alias, owner);
      state.bodyShapes.set(owner, shape);
      this.registerPartSolidAliasShape(state, alias, shape, ownerFrame);
    }
  }

  protected override registerPartSolidAliasComponent(
    state: GroupBuildState,
    alias: string,
    shape: OC,
  ): void {
    const owner = state.partSolidOwner;
    if (!owner) return;
    const ownerFrame =
      state.bodyFrames.get(owner) ?? workplaneFrame(state.defaultWorkplane);
    this.registerPartSolidAliasShape(state, alias, shape, ownerFrame);
  }

  protected override registerPartSolidAliasShape(
    state: GroupBuildState,
    alias: string,
    shape: OC,
    ownerFrame: FaceFrame,
  ): void {
    state.labelMap.register(
      this.oc,
      alias,
      shape,
      state.bodyEdgeModes.get(alias) ?? 'outer',
      state.bodyFrames.get(alias) ?? ownerFrame,
      state.partSolidAliasShapes.get(alias),
      state.partSolidAliasAttachmentPlanes.get(alias),
    );
  }

  protected override addBody(
    state: GroupBuildState,
    name: string,
    shape: OC,
    frame: FaceFrame,
    material: MaterialAppearance | null,
    _span?: SourceSpan,
    attachmentPlane?: SourceAttachmentPlane,
  ): void {
    if (state.partSolidOwner) {
      this.addBodyToPartSolid(
        state,
        name,
        shape,
        frame,
        material,
        attachmentPlane,
      );
      return;
    }
    state.bodyOwners.set(name, name);
    state.bodyEdgeModes.set(name, 'outer');
    state.bodyFrames.set(name, frame);
    state.bodyShapes.set(name, shape);
    state.bodyMaterials.set(name, material);
    if (attachmentPlane) state.bodyAttachmentPlanes.set(name, attachmentPlane);
    state.labelMap.register(
      this.oc,
      name,
      shape,
      'outer',
      frame,
      undefined,
      attachmentPlane,
    );
  }

  protected override buildFuseOperation(
    state: GroupBuildState,
    op: IRFuse,
  ): void {
    if (state.partSolidOwner) {
      this.flushPartSolid(state, op.span);
    }
    const owners = this.uniqueOwnersForFuse(state, op);
    const primary = owners[0];
    const fused = this.fuseOwnerShapes(state, owners, op);
    const fusedOwners = new Set(owners);
    const aliasSources = this.fusedAliasSources(state, fusedOwners);
    this.commitFusedOwners(state, primary, owners, fused, aliasSources);
  }

  protected override prepareNativeFuseOperation(
    state: GroupBuildState,
    op: IRFuse,
  ): PreparedNativeFuse | undefined {
    if (state.partSolidOwner) {
      const shapes = [...state.partSolidComponents.values()];
      const target = shapes[0];
      if (!target || shapes.length < 2) return;
      return {
        op,
        target,
        tools: shapes.slice(1),
        commit: (result) =>
          commitDeferredPartSolid(state, result, (buildState, shape) =>
            this.registerPartSolidAliases(buildState, shape),
          ),
      };
    }
    const owners = this.uniqueOwnersForFuse(state, op);
    if (owners.length < 2) return;
    const shapes = owners.map((owner) => state.bodyShapes.get(owner));
    if (shapes.some((shape) => !shape)) return;
    const target = shapes[0];
    if (!target) return;
    const fusedOwners = new Set(owners);
    const aliases = this.fusedAliasSources(state, fusedOwners);
    return {
      op,
      target,
      tools: shapes.slice(1) as OC[],
      commit: (result) =>
        this.commitFusedOwners(state, owners[0], owners, result, aliases),
    };
  }

  protected override commitFusedOwners(
    state: GroupBuildState,
    primary: string,
    owners: readonly string[],
    fused: OC,
    aliases: FusedAliasSources,
  ): void {
    const fusedOwners = new Set(owners);
    for (const [alias, owner] of state.bodyOwners) {
      if (fusedOwners.has(owner)) state.bodyOwners.set(alias, primary);
    }
    state.bodyShapes.set(primary, fused);
    for (const owner of owners.slice(1)) {
      state.bodyShapes.delete(owner);
      state.bodyMaterials.delete(owner);
    }
    this.registerFusedBodyAliases(
      state,
      primary,
      fused,
      aliases.sourceShapes,
      aliases.attachmentPlanes,
    );
  }

  protected override fuseOwnerShapes(
    state: GroupBuildState,
    owners: string[],
    op: IRFuse,
  ): OC {
    let fused = state.bodyShapes.get(owners[0]);
    if (!fused) {
      throw occtError(`fuse: no shape named '${op.targets[0]}'`, op.span);
    }
    for (const owner of owners.slice(1)) {
      const next = state.bodyShapes.get(owner);
      if (!next) throw occtError(`fuse: no shape named '${owner}'`, op.span);
      fused = this.applyBoolFuse(fused, next, op.span, 'Fuse failed');
    }
    return fused;
  }

  protected override fusedAliasSources(
    state: GroupBuildState,
    fusedOwners: Set<string>,
  ): FusedAliasSources {
    const sourceShapes = new Map<string, OC>();
    const attachmentPlanes = new Map<string, SourceAttachmentPlane>();
    for (const [alias, owner] of state.bodyOwners) {
      if (!fusedOwners.has(owner)) continue;
      const sourceShape =
        state.partSolidAliasShapes.get(alias) ?? state.bodyShapes.get(owner);
      if (sourceShape) sourceShapes.set(alias, sourceShape);
      const attachmentPlane = state.bodyAttachmentPlanes.get(alias);
      if (attachmentPlane) attachmentPlanes.set(alias, attachmentPlane);
    }
    return { sourceShapes, attachmentPlanes };
  }

  protected override uniqueOwnersForFuse(
    state: GroupBuildState,
    op: IRFuse,
  ): string[] {
    const owners: string[] = [];
    for (const target of op.targets) {
      const owner = this.ownerFor(state, target);
      if (!state.bodyShapes.has(owner)) {
        throw occtError(`fuse: no shape named '${target}'`, op.span);
      }
      if (!owners.includes(owner)) owners.push(owner);
    }
    return owners;
  }

  protected override registerFusedBodyAliases(
    state: GroupBuildState,
    owner: string,
    shape: OC,
    sourceShapes: Map<string, OC>,
    attachmentPlanes = new Map<string, SourceAttachmentPlane>(),
  ): void {
    const ownerFrame =
      state.bodyFrames.get(owner) ?? workplaneFrame(state.defaultWorkplane);
    for (const [alias, knownOwner] of state.bodyOwners) {
      if (knownOwner !== owner) continue;
      state.labelMap.register(
        this.oc,
        alias,
        shape,
        state.bodyEdgeModes.get(alias) ?? 'outer',
        state.bodyFrames.get(alias) ?? ownerFrame,
        sourceShapes.get(alias),
        attachmentPlanes.get(alias) ?? state.bodyAttachmentPlanes.get(alias),
      );
    }
  }

  protected override addBodyToPartSolid(
    state: GroupBuildState,
    name: string,
    shape: OC,
    frame: FaceFrame,
    material: MaterialAppearance | null,
    attachmentPlane?: SourceAttachmentPlane,
  ): void {
    const owner = state.partSolidOwner;
    if (!owner) return;
    addDeferredPartComponent(
      state,
      name,
      shape,
      frame,
      material,
      attachmentPlane,
    );
    this.registerPartSolidAliasComponent(state, name, shape);
    if (state.partSolidAliasComponents.get(owner) === name) {
      this.registerPartSolidAliasComponent(state, owner, shape);
    }
  }

  protected override replaceBody(
    state: GroupBuildState,
    name: string,
    shape: OC,
  ): void {
    const owner = this.ownerFor(state, name);
    state.bodyOwners.set(name, owner);
    state.bodyEdgeModes.set(name, state.bodyEdgeModes.get(name) ?? 'outer');
    if (state.partSolidOwner && owner === state.partSolidOwner) {
      state.partSolid = shape;
      state.bodyShapes.set(owner, shape);
      state.partSolidComponents.clear();
      state.partSolidComponents.set(owner, shape);
      state.partSolidAliases.add(name);
      for (const alias of state.partSolidAliases) {
        state.partSolidAliasComponents.set(alias, owner);
      }
      if (!state.partSolidAliasShapes.has(name)) {
        state.partSolidAliasShapes.set(name, shape);
      }
      const attachmentPlane = state.bodyAttachmentPlanes.get(name);
      if (attachmentPlane) {
        state.partSolidAliasAttachmentPlanes.set(name, attachmentPlane);
      }
      this.registerPartSolidAliases(state, shape);
      return;
    }
    state.bodyShapes.set(owner, shape);
    this.registerBodyAliases(state, owner, shape);
  }

  protected override aliasBody(
    state: GroupBuildState,
    alias: string,
    target: string,
    edgeMode: BodyEdgeMode = 'outer',
  ): void {
    const owner = this.ownerFor(state, target);
    state.bodyOwners.set(target, owner);
    state.bodyOwners.set(alias, owner);
    if (alias !== target) state.bodyEdgeModes.set(alias, edgeMode);
    if (state.partSolidOwner && owner === state.partSolidOwner) {
      this.aliasPartSolidBody(state, alias, target);
    }
  }

  protected override aliasPartSolidBody(
    state: GroupBuildState,
    alias: string,
    target: string,
  ): void {
    state.partSolidAliases.add(target);
    state.partSolidAliases.add(alias);
    this.copyPartSolidAliasShape(state, alias, target);
    this.copyPartSolidAliasAttachmentPlane(state, alias, target);
    if (state.partSolid) this.registerPartSolidAliases(state, state.partSolid);
  }

  protected override copyPartSolidAliasShape(
    state: GroupBuildState,
    alias: string,
    target: string,
  ): void {
    const regionShape = state.partSolidAliasShapes.get(target);
    if (regionShape && !state.partSolidAliasShapes.has(alias)) {
      state.partSolidAliasShapes.set(alias, regionShape);
    }
  }

  protected override copyPartSolidAliasAttachmentPlane(
    state: GroupBuildState,
    alias: string,
    target: string,
  ): void {
    const attachmentPlane =
      state.partSolidAliasAttachmentPlanes.get(target) ??
      state.bodyAttachmentPlanes.get(target);
    if (attachmentPlane && !state.partSolidAliasAttachmentPlanes.has(alias)) {
      state.partSolidAliasAttachmentPlanes.set(alias, attachmentPlane);
    }
  }

  protected override canStartNativeExplicitFuse(): boolean {
    return nativeParallelBooleanCapability(this.oc);
  }
}
