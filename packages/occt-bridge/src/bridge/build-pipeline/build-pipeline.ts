/** Implements the build pipeline behavior owned by the OCCT bridge. */

import { OcctBridgeBase } from '../occt-bridge-base.js';

import { type FinalizedGroupBuild } from '../occt-bridge-base.js';

import type {
  CompileAssets,
  IRProgram,
  MeshData,
  ResolvedJointData,
  ValidationResult,
  Workplane,
  DrawingProgram,
  DrawingResult,
  InteractionSnapshot,
  PreparedComponentArtifact,
  NativeBooleanBatchPlan,
} from '@bushscad/ir';

import { buildDrawingResults } from '../../drawing/build-drawings.js';

import { FaceLabelMap } from '../../topology/face-labels.js';

import { partitionByPart } from '../../core/program-utils.js';

import type { PartGroup } from '../../core/program-utils.js';

import { buildPartGroups } from '../part-group-orchestration.js';

import { buildInteractionTopology } from '../../topology/build-interaction-topology.js';

import { realizeInteractionSnapshot } from '../../topology/interaction-realization.js';

import {
  collectInteractionSelectionCounts,
  collectInteractionSelectionValues,
} from '../../topology/interaction-selection-counts.js';

import { realizeInteractionSketchInstances } from '../../topology/sketch-instance-realization.js';

import {
  AUTO_MESH_COLORS,
  resolvePartMeshColor,
  type PartMeshColor,
} from '../../mesh/mesh-colors.js';

import { workplaneFrame } from '../../topology/frame-utils.js';

import {
  buildMaterialShapes,
  deleteBuiltPartShapes,
  uniqueBodyEntries,
} from '../../mesh/material-shapes.js';

import { createGroupBuildState } from '../group-build-state.js';

import {
  isOcctError,
  occtError,
  rawErrorMessage,
} from '../../core/occt-errors.js';

import {
  movingJointBodyNames,
  resolveJointsForOps,
} from '../../operations/joint-resolution.js';

import { commitDeferredPartSolid } from '../../operations/part-solid.js';

import { NativeBooleanBatchRuntime } from '../../operations/native-boolean-batch-runtime.js';

import { type OcctBuildTrace } from '../../operations/build-trace.js';

import type {
  BuiltMaterialShape,
  BuiltPart,
  GroupBuildState,
  OC,
} from '../bridge-types.js';

export abstract class BuildPipelineBridge extends OcctBridgeBase {
  protected override installAssets(assets: CompileAssets): void {
    for (const font of assets.fonts) {
      this.ensureFsDir(font.fsPath.slice(0, font.fsPath.lastIndexOf('/')));
      this.oc.FS.writeFile(font.fsPath, font.data);
    }
    for (const shape of assets.shapes ?? []) {
      this.ensureFsDir(shape.fsPath.slice(0, shape.fsPath.lastIndexOf('/')));
      this.oc.FS.writeFile(shape.fsPath, shape.data);
    }
  }

  protected override ensureFsDir(path: string): void {
    if (!path || path === '/') return;
    const parts = path.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      try {
        this.oc.FS.mkdir(current);
      } catch {
        // Directory already exists.
      }
    }
  }

  protected override validateAssertions(
    program: IRProgram,
    shapeMap: Map<string, OC>,
  ): ValidationResult[] {
    return this.queryEvaluator.validateAssertions(program, shapeMap);
  }

  protected override buildProgramWithValidation(
    program: IRProgram,
    drawingProgram?: DrawingProgram,
    trace?: OcctBuildTrace,
    autoColorOffset = 0,
    preparedComponents?: readonly PreparedComponentArtifact[],
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit = 1,
  ): {
    meshes: MeshData[];
    validations: ValidationResult[];
    drawings: DrawingResult[];
    joints: ResolvedJointData[];
    interaction?: InteractionSnapshot;
  } {
    const groups = partitionByPart(program.ops);
    let colorIdx = autoColorOffset;
    const { parts: builtParts } = this.buildGroupsWithPartLabels(
      groups,
      program.workplane ?? 'XY',
      trace,
      preparedComponents,
      nativeBooleanPlan,
      nativeBooleanConcurrencyLimit,
    );
    try {
      const meshes = builtParts.flatMap((part) =>
        this.builtPartMeshes(
          part,
          () => AUTO_MESH_COLORS[colorIdx++ % AUTO_MESH_COLORS.length],
        ),
      );
      const interaction = realizeInteractionSnapshot(
        realizeInteractionSketchInstances(
          this.oc,
          builtParts,
          program.interaction,
        ),
        buildInteractionTopology(this.oc, builtParts, program.interaction),
        collectInteractionSelectionCounts(builtParts),
        collectInteractionSelectionValues(builtParts),
      );
      // Build name→shape/color maps for validation while shapes are still alive.
      const { shapeMap, colorMap } = this.collectShapeAndColorMaps(builtParts);
      const validations = [
        ...builtParts.flatMap((part) => part.validations),
        ...this.validateAssertions(program, shapeMap),
      ];
      const drawings = [
        ...buildDrawingResults(this.oc, drawingProgram, shapeMap, colorMap),
      ];
      const joints = builtParts.flatMap((part) => part.joints);
      return { meshes, validations, drawings, joints, interaction };
    } finally {
      deleteBuiltPartShapes(builtParts);
    }
  }

  protected override builtPartMeshes(
    part: BuiltPart,
    nextColor: () => string,
  ): MeshData[] {
    const color = resolvePartMeshColor(part.group.color, nextColor);
    return [
      ...this.materialShapeMeshes(part, color),
      ...this.hardwareVisualMeshes(part),
      ...this.debugBlendMeshes(part),
    ];
  }

  protected override materialShapeMeshes(
    part: BuiltPart,
    color: PartMeshColor,
  ): MeshData[] {
    return part.materialShapes.map((entry) =>
      this.materialShapeMesh(part, entry, color),
    );
  }

  protected override materialShapeMesh(
    part: BuiltPart,
    entry: BuiltMaterialShape,
    color: PartMeshColor,
  ): MeshData {
    const mesh = this.extractPartMesh(part, entry.shape);
    const meshColor = entry.material?.color ?? color.color;
    return {
      partName: part.group.name,
      ...(entry.bodyName ? { bodyName: entry.bodyName } : {}),
      ...(entry.isOpenSurface ? { isOpenSurface: true } : {}),
      color: meshColor,
      ...(color.usesDefaultColor && !entry.material
        ? { usesDefaultColor: true }
        : {}),
      ...(entry.material ? { material: entry.material } : {}),
      ...mesh,
    };
  }

  protected override extractPartMesh(
    part: BuiltPart,
    shape: OC,
  ): Omit<MeshData, 'partName' | 'color' | 'material'> {
    try {
      return this.extractMesh(shape);
    } catch (err) {
      if (isOcctError(err)) throw err;
      const span = part.group.ops.at(-1)?.span ?? {
        file: '(occt)',
        line: 1,
        col: 1,
      };
      throw occtError(
        `Mesh extraction failed for part '${part.group.name}': ${rawErrorMessage(err)}`,
        span,
      );
    }
  }

  protected override hardwareVisualMeshes(part: BuiltPart): MeshData[] {
    return part.hardwareVisuals.map(({ op, mesh }) => ({
      partName: part.group.name,
      color: op.hardwareKind === 'bolt' ? '#C0C0C0' : '#B5A642',
      isHardwareVisual: true,
      hardwareKind: op.hardwareKind,
      ...mesh,
    }));
  }

  protected override debugBlendMeshes(part: BuiltPart): MeshData[] {
    return part.debugBlendEdgeMeshes.map(({ target, mesh }, index) => ({
      partName: part.group.name,
      bodyName: `debug:${target}`,
      color: index % 2 === 0 ? '#FF00FF' : '#00E5FF',
      ...mesh,
    }));
  }

  protected override buildGroupsWithPartLabels(
    groups: PartGroup[],
    workplane: Workplane,
    trace?: OcctBuildTrace,
    preparedComponents?: readonly PreparedComponentArtifact[],
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit = 1,
  ): { parts: BuiltPart[]; globalLabels: FaceLabelMap } {
    return buildPartGroups(
      this.oc,
      groups,
      workplane,
      (group, labels, plane, activeTrace) =>
        this.buildGroup(
          group,
          labels,
          plane,
          activeTrace,
          preparedComponents,
          nativeBooleanPlan,
          nativeBooleanConcurrencyLimit,
        ),
      trace,
    );
  }

  protected override buildGroup(
    group: PartGroup,
    globalLabels: FaceLabelMap,
    workplane: Workplane,
    trace?: OcctBuildTrace,
    preparedComponents?: readonly PreparedComponentArtifact[],
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit = 1,
  ): {
    shape: OC;
    labelMap: FaceLabelMap;
    materialShapes: BuiltMaterialShape[];
    validations: ValidationResult[];
    joints: ResolvedJointData[];
    interactionSelectionCounts: Map<string, number>;
    interactionSelectionValues: Map<string, readonly string[]>;
    bodyShapes: Map<string, OC>;
    hardwareVisuals: BuiltPart['hardwareVisuals'];
    debugBlendEdgeMeshes: BuiltPart['debugBlendEdgeMeshes'];
  } {
    const state = createGroupBuildState(
      globalLabels,
      workplane,
      group.name,
      trace,
    );
    const nativeBatches = nativeBooleanPlan
      ? new NativeBooleanBatchRuntime(
          this.oc,
          group.name,
          nativeBooleanPlan,
          {
            applyDefault: (op) => this.applyGroupOperation(state, op),
            prepareCut: (op) => this.prepareNativeCutOperation(state, op),
            commitCuts: (prepared, result) =>
              this.commitNativeCutBatch(state, prepared, result),
            additiveTarget: (name) => this.nativeBatchTargetShape(state, name),
            additiveTool: (name) => state.partSolidComponents.get(name),
            commitFuse: (result) =>
              commitDeferredPartSolid(state, result, (buildState, shape) =>
                this.registerPartSolidAliases(buildState, shape),
              ),
            prepareFuse: (op) => this.prepareNativeFuseOperation(state, op),
            canBatchCut: (name) => this.canStartNativeBatch(state, name),
            canBatchAdditiveFuse: (name) =>
              this.canStartNativeBatch(state, name),
            canBatchExplicitFuse: () => this.canStartNativeExplicitFuse(),
          },
          trace,
          nativeBooleanConcurrencyLimit,
        )
      : undefined;

    this.applyGroupOperations(
      group,
      state,
      trace,
      nativeBatches,
      preparedComponents,
    );

    const finalized = this.finalizeGroupBuild(
      group,
      state,
      movingJointBodyNames(group.ops),
      workplane,
    );
    return {
      ...finalized,
      validations: state.modifierValidations,
      joints: resolveJointsForOps(this.oc, group.ops, state.labelMap),
      interactionSelectionCounts: state.interactionSelectionCounts,
      interactionSelectionValues: state.interactionSelectionValues,
    };
  }

  protected override finalizeGroupBuild(
    group: PartGroup,
    state: GroupBuildState,
    isolatedBodyNames: Set<string>,
    workplane: Workplane,
  ): FinalizedGroupBuild {
    if (!this.canFinalizeDeferredPartAsCompound(state)) {
      this.flushPartSolid(
        state,
        group.ops.at(-1)?.span ?? { file: '(occt)', line: 1, col: 1 },
      );
    }
    // Declaration-only shapes (imported shapes / refs) do not render in the
    // group that declares them — only their placed copies render elsewhere.
    const renderableShapes = this.finalRenderableShapes(state);
    const bodyEntries = uniqueBodyEntries(
      renderableShapes,
      state.bodyMaterials,
    );
    const surfaceMaterialShapes = this.surfaceMaterialShapes(state);
    const finalShapes = bodyEntries.map((entry) => entry.shape);
    if (finalShapes.length === 0) {
      return this.finalizeEmptyGroup(state, surfaceMaterialShapes);
    }
    const materialShapes = buildMaterialShapes(
      bodyEntries,
      (shapes) => this.buildCompound(shapes),
      isolatedBodyNames,
    );
    const shape =
      finalShapes.length === 1
        ? finalShapes[0]
        : this.buildCompound(finalShapes);

    this.registerNamedPartGroup(group, state, shape, workplane);

    // Build fully-resolved alias → shape map so validation queries can find any named body.
    const bodyShapes = this.finalBodyShapes(state);

    return {
      shape,
      labelMap: state.labelMap,
      materialShapes: [...materialShapes, ...surfaceMaterialShapes],
      bodyShapes,
      hardwareVisuals: state.hardwareVisuals,
      debugBlendEdgeMeshes: state.debugBlendEdgeMeshes,
    };
  }

  protected override surfaceMaterialShapes(
    state: GroupBuildState,
  ): BuiltMaterialShape[] {
    return [...state.surfaceShapes].map(([name, shape]) => ({
      shape,
      bodyName: name,
      material: state.surfaceMaterials.get(name) ?? null,
      isOpenSurface: true,
    }));
  }

  protected override finalizeEmptyGroup(
    state: GroupBuildState,
    surfaceMaterialShapes: BuiltMaterialShape[],
  ): FinalizedGroupBuild {
    if (
      state.declaredShapeNames.size === 0 &&
      surfaceMaterialShapes.length === 0
    ) {
      throw new Error('Part produced no geometry');
    }
    return {
      shape: this.buildCompound([]),
      labelMap: state.labelMap,
      materialShapes: surfaceMaterialShapes,
      bodyShapes: new Map(),
      hardwareVisuals: state.hardwareVisuals,
      debugBlendEdgeMeshes: state.debugBlendEdgeMeshes,
    };
  }

  protected override registerNamedPartGroup(
    group: PartGroup,
    state: GroupBuildState,
    shape: OC,
    workplane: Workplane,
  ): void {
    if (group.name === '__default__') return;
    state.labelMap.register(
      this.oc,
      group.name,
      shape,
      'outer',
      workplaneFrame(workplane),
    );
  }

  protected override finalBodyShapes(state: GroupBuildState): Map<string, OC> {
    const bodyShapes = new Map<string, OC>();
    for (const [alias, owner] of state.bodyOwners) {
      const component = state.partSolidAliasComponents.get(alias);
      const shape = component
        ? state.partSolidComponents.get(component)
        : state.bodyShapes.get(owner);
      if (shape) bodyShapes.set(alias, shape);
    }
    return bodyShapes;
  }

  protected override finalRenderableShapes(
    state: GroupBuildState,
  ): Map<string, OC> {
    if (this.canFinalizeDeferredPartAsCompound(state) && state.partSolidOwner) {
      return new Map(
        [...state.partSolidComponents].filter(
          ([name]) => !state.declaredShapeNames.has(name),
        ),
      );
    }
    return new Map(
      [...state.bodyShapes].filter(
        ([name]) => !state.declaredShapeNames.has(name),
      ),
    );
  }
}
