/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Implements the public OCCT bridge build, query, validation, and export API.
 * @last-edited October 6, 2026
 */

import type {
  CompileAssets,
  IRProgram,
  IROp,
  IRSketch,
  IRExtrude,
  IRCut,
  IRSolidCut,
  IRRevolve,
  IRRadialExtrude,
  IRRadialCut,
  IRLoft,
  IRPath,
  IRSweep,
  IRSweepCut,
  IRFillet,
  IRChamfer,
  IRFuse,
  IRDraft,
  IRRotate,
  IRPatternLinear,
  IRPatternRadial,
  IRMirror,
  IRMirrorPlane,
  IRTransform,
  IRFontRef,
  IRPrimitive,
  IRProfileSegment,
  IRPlacement,
  IRHardwareVisual,
  IRSolidPrimitive,
  IRSurfaceThicken,
  IRHeal,
  IRDefeature,
  MaterialAppearance,
  MeshData,
  OcctError,
  ExportFormat,
  ResolvedJointData,
  SourceSpan,
  ValidationResult,
  Workplane,
  DrawingProgram,
  DrawingResult,
  InteractionSnapshot,
  PreparedComponentArtifact,
  NativeBooleanBatchPlan,
} from '@bushscad/ir';
import { profileSegmentsAreClosed } from '@bushscad/ir';
import { buildDrawingResults } from './drawing/build-drawings.js';
import { FaceLabelMap, faceFrameFromAx2 } from './topology/face-labels.js';
import type { FaceFrame } from './topology/face-labels.js';
import {
  exportNameForPartGroup,
  partitionByPart,
  parseFaceRef,
} from './core/program-utils.js';
import type { PartGroup } from './core/program-utils.js';
import { buildPartGroups } from './bridge/part-group-orchestration.js';
import {
  makeDefaultAxis,
  makeWorkplaneAxis,
  boundsOverlap,
  getEdges,
  readBounds,
  readEdgeEndpoints,
  type Vec3,
} from './core/geometry-utils.js';
import {
  inlineRevolveToolProfileAxis,
  makeAxisFromVectors,
  transformShapeBetweenAxes,
  type SolidCutToolSource,
} from './operations/solid-cut-tools.js';
import { extractMesh as extractOcctMesh } from './mesh/mesh-extraction.js';
import { buildInteractionTopology } from './topology/build-interaction-topology.js';
import { realizeInteractionSnapshot } from './topology/interaction-realization.js';
import {
  collectInteractionSelectionCounts,
  collectInteractionSelectionValues,
  recordInteractionEdgeSelection,
} from './topology/interaction-selection-counts.js';
import { realizeInteractionSketchInstances } from './topology/sketch-instance-realization.js';
import {
  AUTO_MESH_COLORS,
  resolvePartMeshColor,
  type PartMeshColor,
} from './mesh/mesh-colors.js';
import { OcctShapeExporter } from './export/occt-shape-exporter.js';
import {
  axisDirection,
  axisPointAndDirection,
  axisPointAndLocalDirection,
  ax2Axes,
  cardinalAxis,
  crossVec,
  frameFromPlantNormal,
  isOpenProfile,
  localVectorToWorld,
  normalizeVec,
  projectPerpendicular,
  revolvePlantLocalNormal,
  rotateFrame,
  workplaneFrame,
} from './topology/frame-utils.js';
import {
  buildMaterialShapes,
  deleteBuiltPartShapes,
  uniqueBodyEntries,
} from './mesh/material-shapes.js';
import {
  buildAlignShapeOperation,
  buildImportShapeOperation,
  buildRefOperation,
  reregisterSourceShape,
} from './operations/imported-ref-shapes.js';
import { registerPrimitiveNamedEdgesForBody } from './topology/primitive-named-edge-labels.js';
import {
  edgeIntersectionFailure,
  selectEdgeIntersection,
} from './topology/edge-intersection-selection.js';
import { selectSketchComponentEdges } from './topology/sketch-component-selection.js';
import { createGroupBuildState } from './bridge/group-build-state.js';
import { buildFailureResult } from './bridge/build-failure-result.js';
import { serializeNativeBrep } from './bridge/native-brep-artifacts.js';
import {
  preparedComponentName,
  restorePreparedComponent,
} from './bridge/prepared-component-assembly.js';
import { arcPoint, pointsDiffer } from './profiles/profile-utils.js';
import {
  buildProfileFaceForPrimitive,
  buildProfileWireFromSegments,
  profileFaceSegmentGroups,
} from './profiles/profile-faces.js';
import {
  buildProfileRegionExtrudeSolid,
  type ProfileRegionExtrudeResult,
} from './profiles/profile-region-solids.js';
import {
  buildPlacedSelectedProfileFace,
  exactRegionProfileSelectionSource,
  profileSelectionLocalFaceTransform,
} from './profiles/profile-selection-placement.js';
import { makeXYCircleHandles } from './profiles/xy-circle.js';
import { buildXYEllipseWire } from './profiles/xy-ellipse.js';
import {
  horizontalTextAlignment,
  utf8ByteLength,
  verticalTextAlignmentCenter,
} from './core/text-utils.js';
import {
  describeUnexpectedOcctException,
  isNullShape,
  isOcctError,
  occtError,
  rawErrorMessage,
} from './core/occt-errors.js';
import {
  conflictingBlendMessage,
  describeBlendException,
  describeBlendPhaseFailure,
  describeBlendRejection,
  describeFilletFailure,
} from './operations/blend-diagnostics.js';
import { getDraftFaceHandles } from './operations/draft-face-handles.js';
import {
  isModifierOp,
  modifierValue,
  sameModifierValue,
} from './operations/modifier-classification.js';
import { edgeKey, edgeVertexKeys } from './topology/edge-identity.js';
import { sameTopoShape } from './topology/shape-equality.js';
import { buildThreadOperation } from './threads/thread-geometry.js';
import {
  applyDispatchedGroupOperation,
  type GroupOperationHandlers,
} from './operations/group-operation-dispatch.js';
import { buildThruSectionsLoft } from './operations/loft-operations.js';
import { buildShellOperation } from './operations/shell-operations.js';
import { buildRadialStations } from './operations/radial-stations.js';
import {
  movingJointBodyNames,
  resolveJointsForOps,
} from './operations/joint-resolution.js';
import {
  buildSurfaceFillOperation,
  buildSurfaceOffsetOperation,
  buildSurfaceThickenOperation,
} from './surfaces/surfaces.js';
import { buildSolidPrimitiveShape } from './primitives/solid-primitives.js';
import {
  attachmentPlane,
  transformToAxis,
} from './primitives/solid-primitive-geometry.js';
import { clipSurfaceBoundSketchFace } from './surfaces/surface-bound-sketches.js';
import {
  applyStableBoolCut,
  applyStableBoolFuse,
} from './operations/boolean-operations.js';
import { makePartFuseOverlapExtrudeInput } from './operations/additive-overlap.js';
import {
  addDeferredPartComponent,
  aliasDeferredPartCut,
  cutDeferredPartComponents,
  commitDeferredPartSolid,
  flushDeferredPartSolid,
} from './operations/part-solid.js';
import {
  NativeBooleanBatchRuntime,
  type PreparedNativeCut,
  type PreparedNativeFuse,
} from './operations/native-boolean-batch-runtime.js';
import { nativeParallelBooleanCapability } from './operations/native-parallel-booleans.js';
import { replaceDeferredPartComponent } from './operations/part-solid-transform.js';
import {
  canApplyDeferredPartModifiers,
  splitDeferredPartModifiers,
} from './operations/modifier-deferral.js';
import { tryApplySolidCutToolBlend as applySolidCutToolBlendOperation } from './operations/solid-cut-tool-blend.js';
import type { SourceAttachmentPlane } from './topology/source-edge-recovery.js';
import {
  createOcctBuildTrace,
  pushOpError,
  pushOpStart,
  pushOpSuccess,
  pushTraceEvent,
  snapshotBodies,
  type OcctBuildTrace,
} from './operations/build-trace.js';

import type {
  BlendModifierKind,
  BlendModifierOp,
  BodyEdgeMode,
  BuildResult,
  BuiltMaterialShape,
  BuiltPart,
  ConnectedEdgeSelection,
  EdgeSelection,
  EdgeSelectionBatch,
  ExportResult,
  GroupBuildState,
  ModifierBodyGroup,
  ModifierOp,
  OC,
  PrepareComponentResult,
} from './bridge/bridge-types.js';
import { OcctQueryEvaluator } from './operations/occt-query-evaluator.js';

export type {
  BuildResult,
  ExportResult,
  PrepareComponentResult,
} from './bridge/bridge-types.js';

/**
 * Request to blend retry, including operation kind, owner, ops, label map, and replace body.
 */
type BlendRetryRequest = {
  kind: BlendModifierKind;
  owner: string;
  ops: BlendModifierOp[];
  labelMap: FaceLabelMap;
  replaceBody: (name: string, shape: OC) => void;
  recordValidation: (validation: ValidationResult) => void;
  shape: OC;
  objName: string;
  expandedSelections: EdgeSelection[];
};

/**
 * Finalized group build, including shape, label map, material shapes, body shapes, and hardware
 * visuals.
 */
type FinalizedGroupBuild = {
  shape: OC;
  labelMap: FaceLabelMap;
  materialShapes: BuiltMaterialShape[];
  bodyShapes: Map<string, OC>;
  hardwareVisuals: BuiltPart['hardwareVisuals'];
  debugBlendEdgeMeshes: BuiltPart['debugBlendEdgeMeshes'];
};

/**
 * Fused alias sources, including source shapes and attachment planes.
 */
type FusedAliasSources = {
  sourceShapes: Map<string, OC>;
  attachmentPlanes: Map<string, SourceAttachmentPlane>;
};

export const OCCT_FALLBACK_FONT_PATH = '/fonts/FallbackSans-Regular.ttf';
export const OCCT_FALLBACK_SERIF_FONT_PATH = '/fonts/FallbackSerif-Regular.ttf';
export const OCCT_FALLBACK_MONO_FONT_PATH = '/fonts/FallbackMono-Regular.ttf';

/**
 * Options for occt build, including trace, on trace event, auto color offset, prepared
 * components, and native boolean plan.
 */
export type OcctBuildOptions = {
  trace?: boolean;
  onTraceEvent?: (event: import('@bushscad/ir').OcctTraceEvent) => void;
  /** Starts automatic part coloring at the source-order part index. */
  autoColorOffset?: number;
  /** Native artifacts prepared by isolated workers for source-order replay. */
  preparedComponents?: readonly PreparedComponentArtifact[];
  /** Compiler-proven native boolean runs; omitted for classic execution. */
  nativeBooleanPlan?: NativeBooleanBatchPlan;
  /** Maximum simultaneous outer native-batch owners selected by the caller. */
  nativeBooleanConcurrencyLimit?: number;
};

const FONT_ALIAS_NAMES: Record<string, string[]> = {
  sans: ['Arial', 'Helvetica', 'Noto Sans', 'Liberation Sans', 'DejaVu Sans'],
  serif: [
    'Times New Roman',
    'Times',
    'Noto Serif',
    'Liberation Serif',
    'DejaVu Serif',
  ],
  mono: [
    'Consolas',
    'Courier New',
    'Noto Sans Mono',
    'Liberation Mono',
    'DejaVu Sans Mono',
  ],
};

const BUNDLED_FONT_PATH_BY_NAME: Record<string, string> = {
  sans: OCCT_FALLBACK_FONT_PATH,
  arial: OCCT_FALLBACK_FONT_PATH,
  helvetica: OCCT_FALLBACK_FONT_PATH,
  'noto sans': OCCT_FALLBACK_FONT_PATH,
  'liberation sans': OCCT_FALLBACK_FONT_PATH,
  'dejavu sans': OCCT_FALLBACK_FONT_PATH,
  serif: OCCT_FALLBACK_SERIF_FONT_PATH,
  'times new roman': OCCT_FALLBACK_SERIF_FONT_PATH,
  times: OCCT_FALLBACK_SERIF_FONT_PATH,
  'noto serif': OCCT_FALLBACK_SERIF_FONT_PATH,
  'liberation serif': OCCT_FALLBACK_SERIF_FONT_PATH,
  'dejavu serif': OCCT_FALLBACK_SERIF_FONT_PATH,
  mono: OCCT_FALLBACK_MONO_FONT_PATH,
  monospace: OCCT_FALLBACK_MONO_FONT_PATH,
  consolas: OCCT_FALLBACK_MONO_FONT_PATH,
  'courier new': OCCT_FALLBACK_MONO_FONT_PATH,
  'noto sans mono': OCCT_FALLBACK_MONO_FONT_PATH,
  'liberation mono': OCCT_FALLBACK_MONO_FONT_PATH,
  'dejavu sans mono': OCCT_FALLBACK_MONO_FONT_PATH,
};

const FONT_ASPECT_REGULAR = 0;

/**
 * Returns the dot product for vec using the supplied shape and operation state.
 */
function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Coordinates endpoints match as part of the OpenCascade build pipeline.
 */
function endpointsMatch(
  a: readonly [Vec3, Vec3],
  b: readonly [Vec3, Vec3],
): boolean {
  return (
    (pointsWithinTolerance(a[0], b[0]) && pointsWithinTolerance(a[1], b[1])) ||
    (pointsWithinTolerance(a[0], b[1]) && pointsWithinTolerance(a[1], b[0]))
  );
}

/**
 * Coordinates points within tolerance as part of the OpenCascade build pipeline.
 */
function pointsWithinTolerance(a: Vec3, b: Vec3): boolean {
  return (
    Math.abs(a[0] - b[0]) <= 1e-3 &&
    Math.abs(a[1] - b[1]) <= 1e-3 &&
    Math.abs(a[2] - b[2]) <= 1e-3
  );
}

/**
 * Returns shape data for disables fuse glue using the supplied shape and operation state.
 */
function shapeDisablesFuseGlue(shape: unknown): boolean {
  return Boolean((shape as { _disableFuseGlue?: boolean })?._disableFuseGlue);
}

/**
 * Defines the `ComponentPreparationTarget` type used by the OCCT bridge.
 */
type ComponentPreparationTarget = Readonly<
  | { ok: true; group: PartGroup; operation: IROp }
  | { ok: false; error: OcctError }
>;

/** Finds the one output operation named by an isolated component program. */
function componentPreparationTarget(
  program: IRProgram,
  name: string,
): ComponentPreparationTarget {
  const groups = partitionByPart(program.ops);
  const group = groups[0];
  const operation = group?.ops.find((op) => preparedComponentName(op) === name);
  if (group && groups.length === 1 && operation)
    return { ok: true, group, operation };
  return {
    ok: false,
    error: {
      message: `Prepared component '${name}' is not a unique part output.`,
      span: operation?.span ?? { file: '(occt)', line: 1, col: 1 },
    },
  };
}

/**
 * Coordinates component preparation error as part of the OpenCascade build pipeline.
 */
function componentPreparationError(
  error: unknown,
  span: SourceSpan,
): OcctError {
  if (isOcctError(error)) return error as OcctError;
  return {
    message: error instanceof Error ? error.message : String(error),
    span,
  };
}

/**
 * Coordinates points close as part of the OpenCascade build pipeline.
 */
function pointsClose(a: Vec3, b: Vec3, tolerance: number): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance
  );
}

/**
 * Coordinates torus mesh as part of the OpenCascade build pipeline.
 */
function torusMesh(
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  tubeRadius: number,
): Omit<MeshData, 'partName' | 'color'> {
  const radialSegments = 128;
  const tubeSegments = 10;
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < radialSegments; i++) {
    const theta = (i / radialSegments) * Math.PI * 2;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    for (let j = 0; j < tubeSegments; j++) {
      const phi = (j / tubeSegments) * Math.PI * 2;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const x = cx + (rx + tubeRadius * cosPhi) * cosTheta;
      const y = cy + (ry + tubeRadius * cosPhi) * sinTheta;
      const z = cz + tubeRadius * sinPhi;
      vertices.push(x, y, z);
      const normal =
        normalizeVec([cosTheta * cosPhi, sinTheta * cosPhi, sinPhi]) ??
        ([0, 0, 1] as Vec3);
      normals.push(...normal);
    }
  }

  for (let i = 0; i < radialSegments; i++) {
    const nextI = (i + 1) % radialSegments;
    for (let j = 0; j < tubeSegments; j++) {
      const nextJ = (j + 1) % tubeSegments;
      const a = i * tubeSegments + j;
      const b = nextI * tubeSegments + j;
      const c = nextI * tubeSegments + nextJ;
      const d = i * tubeSegments + nextJ;
      indices.push(a, b, d, b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

/**
 * Coordinates format limit as part of the OpenCascade build pipeline.
 */
function formatLimit(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

/**
 * Executes concrete IR operations against OpenCascade and emits preview meshes,
 * drawings, validations, joints, exports, and source-linked topology metadata.
 *
 * Each part builds sketches and base features first, then applies finishing
 * modifiers per body in draft, chamfer, and fillet order. Initialize the bridge
 * only in a Node or worker context capable of loading the OpenCascade WASM.
 */
export class OcctBridge {
  private readonly queryEvaluator: OcctQueryEvaluator;
  private readonly shapeExporter: OcctShapeExporter;

  /**
   * Initializes the `OcctBridge` instance with the values supplied by its caller.
   */
  private constructor(private oc: OC) {
    this.queryEvaluator = new OcctQueryEvaluator(oc);
    this.shapeExporter = new OcctShapeExporter(oc);
  }

  /**
   * Creates a bridge around an initialized OpenCascade runtime supplied by the caller.
   */
  static async init(initOc?: () => Promise<OC>): Promise<OcctBridge> {
    if (!initOc) {
      throw new Error(
        'OcctBridge.init requires an OpenCascade initializer in this build',
      );
    }

    const oc = await initOc();
    return new OcctBridge(oc);
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

  // Program-level

  /**
   * Coordinates install assets as part of the OpenCascade build pipeline.
   */
  private installAssets(assets: CompileAssets): void {
    for (const font of assets.fonts) {
      this.ensureFsDir(font.fsPath.slice(0, font.fsPath.lastIndexOf('/')));
      this.oc.FS.writeFile(font.fsPath, font.data);
    }
    for (const shape of assets.shapes ?? []) {
      this.ensureFsDir(shape.fsPath.slice(0, shape.fsPath.lastIndexOf('/')));
      this.oc.FS.writeFile(shape.fsPath, shape.data);
    }
  }

  /**
   * Ensures fs dir for the current OpenCascade build.
   */
  private ensureFsDir(path: string): void {
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
  } /**
   * Validates program assertions against the built shapes.
   */
  /**
   * Coordinates validate assertions as part of the OpenCascade build pipeline.
   */
  private validateAssertions(
    program: IRProgram,
    shapeMap: Map<string, OC>,
  ): ValidationResult[] {
    return this.queryEvaluator.validateAssertions(program, shapeMap);
  }

  /**
   * Builds program with validation for the current OpenCascade build.
   */
  private buildProgramWithValidation(
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

  // Design validation

  /**
   * Coordinates built part meshes as part of the OpenCascade build pipeline.
   */
  private builtPartMeshes(
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

  /**
   * Coordinates material shape meshes as part of the OpenCascade build pipeline.
   */
  private materialShapeMeshes(
    part: BuiltPart,
    color: PartMeshColor,
  ): MeshData[] {
    return part.materialShapes.map((entry) =>
      this.materialShapeMesh(part, entry, color),
    );
  }

  /**
   * Coordinates material shape mesh as part of the OpenCascade build pipeline.
   */
  private materialShapeMesh(
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

  /**
   * Extracts part mesh for the current OpenCascade build.
   */
  private extractPartMesh(
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

  /**
   * Coordinates hardware visual meshes as part of the OpenCascade build pipeline.
   */
  private hardwareVisualMeshes(part: BuiltPart): MeshData[] {
    return part.hardwareVisuals.map(({ op, mesh }) => ({
      partName: part.group.name,
      color: op.hardwareKind === 'bolt' ? '#C0C0C0' : '#B5A642',
      isHardwareVisual: true,
      hardwareKind: op.hardwareKind,
      ...mesh,
    }));
  }

  /**
   * Coordinates debug blend meshes as part of the OpenCascade build pipeline.
   */
  private debugBlendMeshes(part: BuiltPart): MeshData[] {
    return part.debugBlendEdgeMeshes.map(({ target, mesh }, index) => ({
      partName: part.group.name,
      bodyName: `debug:${target}`,
      color: index % 2 === 0 ? '#FF00FF' : '#00E5FF',
      ...mesh,
    }));
  }

  /**
   * Builds groups with part labels for the current OpenCascade build.
   */
  private buildGroupsWithPartLabels(
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

  /**
   * Builds group for the current OpenCascade build.
   */
  private buildGroup(
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

  /** Applies operations in source order and flushes deferred modifiers. */
  private applyGroupOperations(
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

  /** Applies one non-modifier operation, restoring prepared work when available. */
  private applyGroupOperationEntry(
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

  /** Runs one regular operation and records its success or failure trace. */
  private runGroupOperationWithTrace(
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

  /**
   * Applies group operation for the current OpenCascade build.
   */
  private applyGroupOperation(state: GroupBuildState, op: IROp): void {
    applyDispatchedGroupOperation(this.groupOperationHandlers(state), op);
  }

  /**
   * Builds group state for operation handlers using the supplied shape and operation state.
   */
  private groupOperationHandlers(
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

  /**
   * Builds solid primitive operation for the current OpenCascade build.
   */
  private buildSolidPrimitiveOperation(
    state: GroupBuildState,
    op: IRSolidPrimitive,
  ): void {
    const built = buildSolidPrimitiveShape(this.oc, state, op);
    this.addBody(
      state,
      op.objName,
      built.shape,
      built.frame,
      op.material ?? null,
      op.span,
      built.attachmentPlane,
    );
  }

  /**
   * Builds shell group operation for the current OpenCascade build.
   */
  private buildShellGroupOperation(
    state: GroupBuildState,
    op: Extract<IROp, { kind: 'shell' }>,
  ): void {
    buildShellOperation(this.oc, state, op, (name, shape) =>
      this.replaceBody(state, name, shape),
    );
  }

  /**
   * Builds surface thicken operation for the current OpenCascade build.
   */
  private buildSurfaceThickenOperation(
    state: GroupBuildState,
    op: IRSurfaceThicken,
  ): void {
    const shape = buildSurfaceThickenOperation(this.oc, state, op);
    this.addBody(
      state,
      op.objName,
      shape,
      workplaneFrame(state.defaultWorkplane),
      op.material ?? null,
      op.span,
    );
  }

  /**
   * Builds thread group operation for the current OpenCascade build.
   */
  private buildThreadGroupOperation(
    state: GroupBuildState,
    op: Extract<IROp, { kind: 'thread' }>,
  ): void {
    buildThreadOperation(
      this.oc,
      state,
      op,
      (name) => this.ownerFor(state, name),
      (name, shape) => this.replaceBody(state, name, shape),
    );
  }

  /**
   * Builds heal operation for the current OpenCascade build.
   */
  private buildHealOperation(state: GroupBuildState, op: IRHeal): void {
    const shape = state.bodyShapes.get(op.target);
    if (!shape) {
      throw occtError(`heal: no shape named '${op.target}'`, op.span);
    }
    const fixer = new this.oc.ShapeFix_Shape_2(shape);
    fixer.SetPrecision(op.tolerance);
    fixer.SetMinTolerance(op.tolerance / 10);
    fixer.SetMaxTolerance(op.tolerance * 10);
    fixer.Perform(new this.oc.Message_ProgressRange_1());
    const healed = fixer.Shape();
    if (!healed || healed.IsNull()) {
      throw occtError(`heal: shape fixing failed for '${op.target}'`, op.span);
    }
    state.bodyShapes.set(op.target, healed);
    this.reregisterShape(state, op.target, healed);
  }

  /**
   * Marks an already-built shape as a reusable source instead of render output.
   * One-line `ref name = <object-op>;` builds with the same pipeline as `obj`
   * so cuts, placements, labels, and part components all stay consistent. This
   * marker only changes visibility at the declaration site.
   */
  private declareShapeSource(
    state: GroupBuildState,
    name: string,
    span: SourceSpan,
  ): void {
    const component = state.partSolidAliasComponents.get(name);
    const shape = component
      ? state.partSolidComponents.get(component)
      : (state.bodyShapes.get(this.ownerFor(state, name)) ??
        state.bodyShapes.get(name));
    if (!shape) {
      throw occtError(`ref: no shape named '${name}'`, span);
    }

    state.declaredShapeNames.add(name);
    state.declaredShapeNames.add(this.ownerFor(state, name));
    if (component) state.declaredShapeNames.add(component);

    const frame =
      state.bodyFrames.get(name) ??
      state.bodyFrames.get(this.ownerFor(state, name)) ??
      workplaneFrame(state.defaultWorkplane);
    const edgeMode = state.bodyEdgeModes.get(name) ?? 'outer';
    state.labelMap.register(this.oc, name, shape, edgeMode, frame);
    state.globalLabels.register(this.oc, name, shape, edgeMode, frame);
  }

  // Re-register a mutated imported/ref shape into both the group-local and the
  // shared label maps so later parts resolve the current topology.
  /**
   * Coordinates reregister shape as part of the OpenCascade build pipeline.
   */
  private reregisterShape(
    state: GroupBuildState,
    name: string,
    shape: OC,
  ): void {
    reregisterSourceShape(this.oc, state, name, shape);
  }

  /**
   * Builds defeature operation for the current OpenCascade build.
   */
  private buildDefeatureOperation(
    state: GroupBuildState,
    op: IRDefeature,
  ): void {
    const shape = state.bodyShapes.get(op.target);
    if (!shape) {
      throw occtError(`defeature: no shape named '${op.target}'`, op.span);
    }
    const defeaturing = new this.oc.BRepAlgoAPI_Defeaturing();
    defeaturing.SetShape(shape);
    defeaturing.SetRunParallel(false);
    const faceCount = this.addDefeatureFacesToRemove(
      defeaturing,
      shape,
      op.threshold,
    );

    // Nothing matched the threshold — leave the shape untouched.
    if (faceCount === 0) return;

    const result = this.buildDefeaturedShape(defeaturing, op);
    state.bodyShapes.set(op.target, result);
    this.reregisterShape(state, op.target, result);
  }

  /**
   * Builds defeatured shape for the current OpenCascade build.
   */
  private buildDefeaturedShape(defeaturing: OC, op: IRDefeature): OC {
    defeaturing.Build();
    if (!defeaturing.IsDone()) {
      throw occtError(
        `defeature: operation failed for '${op.target}'`,
        op.span,
      );
    }
    const result = defeaturing.Shape();
    if (!result || result.IsNull()) {
      throw occtError(
        `defeature: produced null shape for '${op.target}'`,
        op.span,
      );
    }
    return result;
  }

  /**
   * Adds defeature faces to remove for the current OpenCascade build.
   */
  private addDefeatureFacesToRemove(
    defeaturing: OC,
    shape: OC,
    threshold: number,
  ): number {
    const explorer = new this.oc.TopExp_Explorer_2(
      shape,
      this.oc.TopAbs_ShapeEnum.TopAbs_FACE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    let faceCount = 0;
    while (explorer.More()) {
      const face = this.oc.TopoDS.Face_1(explorer.Current());
      if (this.isDefeatureCandidateFace(face, threshold)) {
        defeaturing.AddFaceToRemove(face);
        faceCount++;
      }
      explorer.Next();
    }
    return faceCount;
  }

  /**
   * Checks whether the supplied value meets the defeature candidate face condition.
   */
  private isDefeatureCandidateFace(face: OC, threshold: number): boolean {
    if (!this.isCylinderFace(face)) return false;
    const radius = this.extractCylinderRadius(face);
    return radius > 0 && radius <= threshold;
  }

  /**
   * Builds hardware visual operation for the current OpenCascade build.
   */
  private buildHardwareVisualOperation(
    state: GroupBuildState,
    op: IRHardwareVisual,
  ): void {
    const ax2 = state.labelMap.resolveAxis(this.oc, op.placement) as OC;
    try {
      const shapes: OC[] = [];

      // Shaft / insert body: circle wire positioned at ax2, extruded inward (-depth)
      const shaftWire = this.buildCircle(op.diameterMm / 2);
      const shaftFace = this.buildFaceFromWire(shaftWire, 'circle', op.span);
      shaftWire.delete();
      const shaftPlaced = this.positionFace(shaftFace, ax2);
      shaftFace.delete();
      const shaftShape = this.applyExtrude(
        shaftPlaced,
        ax2,
        -op.heightMm,
        false,
        op.span,
      );
      shaftPlaced.delete();
      shapes.push(shaftShape);

      // Bolt head: larger circle at ax2, extruded outward (+depth above surface)
      if (op.hardwareKind === 'bolt' && op.headDiameterMm && op.headHeightMm) {
        const headWire = this.buildCircle(op.headDiameterMm / 2);
        const headFace = this.buildFaceFromWire(headWire, 'circle', op.span);
        headWire.delete();
        const headPlaced = this.positionFace(headFace, ax2);
        headFace.delete();
        const headShape = this.applyExtrude(
          headPlaced,
          ax2,
          op.headHeightMm,
          false,
          op.span,
        );
        headPlaced.delete();
        shapes.push(headShape);
      }

      const finalShape =
        shapes.length === 1 ? shapes[0] : this.buildCompound(shapes);

      const mesh = this.extractMesh(finalShape);
      state.hardwareVisuals.push({ op, mesh });
    } finally {
      (ax2 as OC).delete();
    }
  }

  /**
   * Builds sketch operation for the current OpenCascade build.
   */
  private buildSketchOperation(state: GroupBuildState, op: IRSketch): void {
    const ax2 = op.placement
      ? state.labelMap.resolveAxis(this.oc, op.placement)
      : makeWorkplaneAxis(this.oc, state.defaultWorkplane);
    state.sketchPrimitives.set(op.name, op.primitive);
    if (op.surfaceBound) {
      state.surfaceBoundSketches.set(op.name, op.surfaceBound);
    }
    if (op.primitive.kind === 'word' || this.isCompositeSketch(op.primitive)) {
      const face = this.buildSketchFace(op.primitive, op.span);
      state.sketchFaces.set(op.name, face);
      state.sketchAxes.set(op.name, ax2);
      return;
    }
    if (
      op.primitive.kind === 'profile' &&
      profileSegmentsAreClosed(op.primitive.segments)
    ) {
      const groups = profileFaceSegmentGroups(op.primitive);
      if (groups.length === 1) {
        state.sketchWires.set(op.name, this.buildProfileWire(groups[0]));
      }
      state.sketchFaces.set(
        op.name,
        buildProfileFaceForPrimitive(this.oc, op.primitive, op.span),
      );
      state.sketchAxes.set(op.name, ax2);
      return;
    }

    const wire = this.buildWire(op.primitive, op.span);
    state.sketchWires.set(op.name, wire);
    if (!isOpenProfile(op.primitive)) {
      const face = this.buildFaceFromWire(wire, op.primitive.kind, op.span);
      state.sketchFaces.set(op.name, face);
    }
    state.sketchAxes.set(op.name, ax2);
  }

  /**
   * Builds extrude operation for the current OpenCascade build.
   */
  private buildExtrudeOperation(state: GroupBuildState, op: IRExtrude): void {
    if (this.tryBuildWrappedExtrudeOperation(state, op)) return;
    if (this.tryBuildExactProfileRegionExtrudeOperation(state, op)) return;
    this.buildStandardExtrudeOperation(state, op);
  }

  /**
   * Attempts to build wrapped extrude operation using the supplied shape and operation state.
   */
  private tryBuildWrappedExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean {
    if (!op.wrap) return false;
    this.ensureCylindricalWrapTarget(state, op.from, op.span);
    const wrapShape = this.buildCylindricalWrapShape(
      state,
      op.sketchName,
      op.from!,
      op.depth,
      op.span,
    );
    if (!wrapShape) return false;
    const ax2 = state.labelMap.resolveAxis(this.oc, op.from!);
    this.addBody(
      state,
      op.objName,
      wrapShape,
      faceFrameFromAx2(ax2),
      op.material ?? null,
      op.span,
    );
    return true;
  }

  /**
   * Builds standard extrude operation for the current OpenCascade build.
   */
  private buildStandardExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): void {
    const { sketchFace, ax2 } = this.resolveSketchFaceAndAxis(
      state,
      op.sketchName,
      op.from,
      op.span,
      op.closedBodyNames,
    );
    const positionedFace = this.positionSketchFaceForExtrude(
      sketchFace,
      ax2,
      op,
    );
    const placedFace = clipSurfaceBoundSketchFace(
      this.oc,
      state,
      op.sketchName,
      positionedFace,
      op.span,
    );
    const extrudeInput = this.partFuseExtrudeInput(state, op, placedFace, ax2);
    const shape = this.applyExtrude(
      extrudeInput.face,
      ax2,
      extrudeInput.depth,
      op.symmetric,
      op.span,
    );
    if (extrudeInput.overlapped) {
      this.disableFuseGlue(shape);
    }
    extrudeInput.face.delete();
    this.addExtrudedBody(state, op, shape, ax2);
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
    );
  }

  /**
   * Coordinates position sketch face for extrude as part of the OpenCascade build pipeline.
   */
  private positionSketchFaceForExtrude(
    sketchFace: OC,
    ax2: OC,
    op: IRExtrude,
  ): OC {
    const positionedFace = this.positionFace(sketchFace, ax2);
    if (op.closedBodyNames?.length) sketchFace.delete();
    return positionedFace;
  }

  /**
   * Returns the face/depth pair used for additive part extrudes.
   * Part-scope additive bodies are eventually fused. When a placed extrude
   * starts exactly on a target face, OCCT sees tangent-only topology; a tiny
   * internal overlap makes the boolean robust without changing visible extents.
   */
  private partFuseExtrudeInput(
    state: GroupBuildState,
    op: IRExtrude,
    placedFace: OC,
    ax2: OC,
    depth = op.depth,
  ): { face: OC; depth: number; overlapped?: true } {
    if (!this.shouldOverlapPartExtrude(state, op)) {
      return { face: placedFace, depth };
    }
    return makePartFuseOverlapExtrudeInput(
      this.oc,
      placedFace,
      ax2,
      depth,
      op.span,
    );
  }

  /**
   * Determines whether the supplied value meets the overlap part extrude condition.
   */
  private shouldOverlapPartExtrude(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean {
    return Boolean(
      state.partSolidOwner &&
      state.partSolidComponents.size > 0 &&
      op.from &&
      !op.symmetric,
    );
  }

  /**
   * Attempts to build exact profile region extrude operation using the supplied shape and
   * operation state.
   */
  private tryBuildExactProfileRegionExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean {
    const exactRegion = this.buildExactProfileRegionExtrude(
      state,
      op.sketchName,
      op.from,
      op.depth,
      op.symmetric,
      op.span,
      op.closedBodyNames,
      this.shouldOverlapPartExtrude(state, op),
    );
    if (!exactRegion) return false;
    if (exactRegion.overlapped) {
      this.disableFuseGlue(exactRegion.shape);
    }
    this.addExtrudedBody(state, op, exactRegion.shape, exactRegion.ax2);
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
    );
    return true;
  }

  /**
   * Disables fuse glue for the current OpenCascade build.
   */
  private disableFuseGlue(shape: OC): void {
    (shape as { _disableFuseGlue?: boolean })._disableFuseGlue = true;
  }

  /**
   * Adds extruded body for the current OpenCascade build.
   */
  private addExtrudedBody(
    state: GroupBuildState,
    op: IRExtrude,
    shape: OC,
    ax2: OC,
  ): void {
    this.addBody(
      state,
      op.objName,
      shape,
      faceFrameFromAx2(ax2),
      op.material ?? null,
      op.span,
      op.from ? this.sourceAttachmentPlane(ax2) : undefined,
    );
  }

  /**
   * Captures the original placement plane for a source body.
   * Fused additive features can lose their source bottom/top face. Keeping the
   * plane lets later selectors recover the visible seam at the placement site.
   */
  private sourceAttachmentPlane(ax2: OC): SourceAttachmentPlane {
    return attachmentPlane(ax2);
  }

  /**
   * Applies bool fuse for the current OpenCascade build.
   */
  private applyBoolFuse(
    a: OC,
    b: OC,
    span: SourceSpan,
    failureMessage = 'Boolean fuse failed',
  ): OC {
    return applyStableBoolFuse(this.oc, a, b, span, failureMessage, {
      configure: false,
      simplify: false,
      useGlue: !shapeDisablesFuseGlue(b),
    });
  }

  /**
   * Builds cut operation for the current OpenCascade build.
   */
  private buildCutOperation(state: GroupBuildState, op: IRCut): void {
    if (this.tryBuildWrapCutOperation(state, op)) return;
    const prepared = this.prepareNativeCutOperation(state, op);
    const result = this.applyBoolCut(
      prepared.targetShape,
      prepared.tool,
      op.span,
    );
    this.commitNativeCutOperation(state, prepared, result);
  }

  /** Prepares one ordinary sketch cutter without mutating its target body. */
  private prepareNativeCutOperation(
    state: GroupBuildState,
    op: IRCut,
  ): PreparedNativeCut {
    const sketchFace = state.sketchFaces.get(op.sketchName);
    if (!sketchFace)
      throw occtError(`Unknown sketch '${op.sketchName}'`, op.span);
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = state.labelMap.getShape(parsed.objName);
    if (!targetShape)
      throw occtError(`Unknown object '${parsed.objName}' for cut`, op.span);
    const ax2 = state.labelMap.resolveAxis(this.oc, op.from);
    const exactTool = this.buildExactProfileRegionCutTool(
      state,
      op,
      ax2,
      targetShape,
    );
    const tool =
      exactTool ??
      this.buildSketchCutTool(state, op, sketchFace, ax2, targetShape);
    return {
      op,
      targetName: parsed.objName,
      targetShape,
      tool,
      axis: ax2,
    };
  }

  /** Replays one cut feature's aliases and labels against its chosen result. */
  private commitNativeCutOperation(
    state: GroupBuildState,
    prepared: PreparedNativeCut,
    result: OC,
  ): void {
    const { op, targetName, tool, axis } = prepared;
    const primaryOwner = this.ownerFor(state, targetName);
    if (state.partSolidOwner && primaryOwner === state.partSolidOwner) {
      this.applyDeferredPartCut(state, op, targetName, tool, result, axis);
    } else {
      this.applyDirectCut(state, op, targetName, primaryOwner, tool, result);
      (tool as { delete(): void }).delete();
    }
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
      { frame: faceFrameFromAx2(axis) },
    );
  }

  /** Replays all cut identities, then labels the shared final topology once. */
  private commitNativeCutBatch(
    state: GroupBuildState,
    cuts: readonly PreparedNativeCut[],
    result: OC,
  ): void {
    const owner = state.partSolidOwner;
    const first = cuts[0];
    if (!owner || !first) return;
    const component = state.partSolidAliasComponents.get(first.targetName);
    if (!component) return;
    state.partSolidComponents.set(component, result);
    state.bodyShapes.set(owner, result);
    for (const { op, targetName, tool, axis } of cuts) {
      aliasDeferredPartCut(
        state,
        op.objName,
        targetName,
        tool,
        this.sourceAttachmentPlane(axis),
      );
      registerPrimitiveNamedEdgesForBody(
        this.oc,
        state,
        op.objName,
        op.sketchName,
        { frame: faceFrameFromAx2(axis) },
      );
    }
    this.registerPartSolidAliases(state, result);
  }

  /**
   * Attempts to build wrap cut operation using the supplied shape and operation state.
   */
  private tryBuildWrapCutOperation(state: GroupBuildState, op: IRCut): boolean {
    if (!op.wrap) return false;
    this.ensureCylindricalWrapTarget(state, op.from, op.span);
    const wrapTool = this.buildCylindricalWrapCutTool(
      state,
      op.sketchName,
      op.from,
      op.through,
      op.depth,
      op.span,
    );
    if (!wrapTool) return false;
    const wrapParsed = parseFaceRef(op.from.faceRef);
    const wrapTarget = state.labelMap.getShape(wrapParsed.objName);
    if (!wrapTarget) {
      throw occtError(
        `Unknown object '${wrapParsed.objName}' for wrap cut`,
        op.span,
      );
    }
    const result = this.applyBoolCut(wrapTarget, wrapTool, op.span);
    (wrapTool as { delete(): void }).delete();
    this.aliasBody(state, op.objName, wrapParsed.objName, 'inner');
    this.replaceBody(state, wrapParsed.objName, result);
    return true;
  }

  /**
   * Applies deferred part cut for the current OpenCascade build.
   */
  private applyDeferredPartCut(
    state: GroupBuildState,
    op: IRCut,
    targetAlias: string,
    tool: OC,
    result: OC,
    ax2: OC,
  ): void {
    cutDeferredPartComponents({
      oc: this.oc,
      state,
      targetAlias,
      tool,
      targetResult: result,
      span: op.span,
      applyCut: (shape, cutTool, span) =>
        this.applyBoolCut(shape, cutTool, span),
      registerAlias: (buildState, alias, shape) =>
        this.registerPartSolidAliasComponent(buildState, alias, shape),
    });
    aliasDeferredPartCut(
      state,
      op.objName,
      targetAlias,
      tool,
      this.sourceAttachmentPlane(ax2),
    );
    this.registerPartSolidAliasComponent(state, op.objName, result);
  }

  /**
   * Applies direct cut for the current OpenCascade build.
   */
  private applyDirectCut(
    state: GroupBuildState,
    op: IRCut,
    targetName: string,
    primaryOwner: string,
    tool: OC,
    result: OC,
  ): void {
    this.aliasBody(state, op.objName, targetName, 'inner');
    this.replaceBody(state, targetName, result);
    this.cutOverlappingBodies(state, primaryOwner, tool, op.span);
  }

  /**
   * Coordinates cut overlapping bodies as part of the OpenCascade build pipeline.
   */
  private cutOverlappingBodies(
    state: GroupBuildState,
    primaryOwner: string,
    tool: OC,
    span: SourceSpan,
  ): void {
    const toolBounds = readBounds(this.oc, tool);
    const seen = new Set<string>([primaryOwner]);
    for (const [name, shape] of state.bodyShapes) {
      const owner = this.ownerFor(state, name);
      if (seen.has(owner)) continue;
      seen.add(owner);
      const bounds = readBounds(this.oc, shape);
      if (!boundsOverlap(bounds, toolBounds)) continue;
      const cutResult = this.applyBoolCut(shape, tool, span);
      this.replaceBody(state, owner, cutResult);
    }
  }

  /**
   * Resolves sketch face and axis for the current OpenCascade build.
   */
  private resolveSketchFaceAndAxis(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
    span: SourceSpan,
    closedBodyNames?: string[],
  ): { sketchFace: OC; ax2: OC } {
    const sketchFace = closedBodyNames?.length
      ? this.buildSelectedSketchFace(state, sketchName, closedBodyNames, span)
      : state.sketchFaces.get(sketchName);
    if (!sketchFace) throw occtError(`Unknown sketch '${sketchName}'`, span);
    const ax2 = this.resolveSketchAxis(state, sketchName, from);
    return { sketchFace, ax2 };
  }

  /**
   * Resolves sketch axis for the current OpenCascade build.
   */
  private resolveSketchAxis(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
  ): OC {
    return from
      ? state.labelMap.resolveAxis(this.oc, from)
      : (state.sketchAxes.get(sketchName) ?? makeDefaultAxis(this.oc));
  }

  /**
   * Builds exact profile region extrude for the current OpenCascade build.
   */
  private buildExactProfileRegionExtrude(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
    depth: number,
    symmetric: boolean,
    span: SourceSpan,
    closedBodyNames?: string[],
    overlapAdditive = false,
  ): (ProfileRegionExtrudeResult & { ax2: OC }) | null {
    const source = exactRegionProfileSelectionSource(
      state.sketchPrimitives.get(sketchName),
      closedBodyNames,
    );
    if (!source) return null;
    const ax2 = this.resolveSketchAxis(state, sketchName, from);
    const result = buildProfileRegionExtrudeSolid({
      oc: this.oc,
      primitive: source.profile,
      ax2,
      depth,
      symmetric,
      span,
      selectedNames: closedBodyNames,
      overlapAdditive,
      transformLocalFace: profileSelectionLocalFaceTransform(
        source,
        this.translateSketchShape.bind(this),
      ),
      clipPlacedFace: (face) =>
        clipSurfaceBoundSketchFace(this.oc, state, sketchName, face, span),
    });
    return { ...result, ax2 };
  }

  /**
   * Builds exact profile region cut tool for the current OpenCascade build.
   */
  private buildExactProfileRegionCutTool(
    state: GroupBuildState,
    op: IRCut,
    ax2: OC,
    targetShape: OC,
  ): OC | null {
    const source = exactRegionProfileSelectionSource(
      state.sketchPrimitives.get(op.sketchName),
      op.closedBodyNames,
    );
    if (!source) return null;
    const cutDepth =
      op.depth !== null ? op.depth : this.shapeDiagonal(targetShape) * 2 + 10;
    const signedDepth = this.cutDepthTowardShape(ax2, targetShape, cutDepth);
    return buildProfileRegionExtrudeSolid({
      oc: this.oc,
      primitive: source.profile,
      ax2,
      depth: signedDepth,
      symmetric: false,
      span: op.span,
      selectedNames: op.closedBodyNames,
      transformLocalFace: profileSelectionLocalFaceTransform(
        source,
        this.translateSketchShape.bind(this),
      ),
      clipPlacedFace: (face) =>
        clipSurfaceBoundSketchFace(
          this.oc,
          state,
          op.sketchName,
          face,
          op.span,
        ),
    }).shape;
  }

  /**
   * Builds sketch cut tool for the current OpenCascade build.
   */
  private buildSketchCutTool(
    state: GroupBuildState,
    op: IRCut,
    sketchFace: OC,
    ax2: OC,
    targetShape: OC,
  ): OC {
    const selectedFace = op.closedBodyNames?.length
      ? this.buildSelectedSketchFace(
          state,
          op.sketchName,
          op.closedBodyNames,
          op.span,
        )
      : sketchFace;
    const positionedFace = this.positionFace(selectedFace, ax2);
    if (op.closedBodyNames?.length) selectedFace.delete();
    const placedFace = clipSurfaceBoundSketchFace(
      this.oc,
      state,
      op.sketchName,
      positionedFace,
      op.span,
    );
    const tool = this.buildCutTool(
      placedFace,
      ax2,
      targetShape,
      op.depth,
      op.span,
    );
    placedFace.delete();
    return tool;
  }

  /**
   * Builds selected sketch face for the current OpenCascade build.
   */
  private buildSelectedSketchFace(
    state: GroupBuildState,
    sketchName: string,
    closedBodyNames: string[],
    span: SourceSpan,
  ): OC {
    return buildPlacedSelectedProfileFace({
      oc: this.oc,
      primitive: state.sketchPrimitives.get(sketchName),
      sketchName,
      selectedNames: closedBodyNames,
      span,
      translate: this.translateSketchShape.bind(this),
    });
  }

  /**
   * Subtracts a copied solid body from the object owning `from`.
   * Sketch cuts generate their own prism tools. Solid cuts instead reuse an
   * existing body or temporary inline solid and place a copy on the target face
   * so predefined tools remain visible and inline tools stay temporary.
   */
  private buildSolidCutOperation(state: GroupBuildState, op: IRSolidCut): void {
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = this.shapeForSolidCutTarget(state, parsed.objName);
    if (!targetShape) {
      throw occtError(
        `Unknown object '${parsed.objName}' for solid cut`,
        op.span,
      );
    }

    const targetAx2 = this.solidCutTargetAxis(
      state.labelMap.resolveAxis(this.oc, op.from),
      targetShape,
    );
    const toolSource = this.buildSolidCutToolSource(state, op);
    const placedTool = transformShapeBetweenAxes(
      this.oc,
      toolSource.shape,
      toolSource.sourceAx2,
      targetAx2,
      toolSource.copy,
    );
    if (toolSource.toolKind) {
      (placedTool as { _solidCutToolKind?: string })._solidCutToolKind =
        toolSource.toolKind;
    }
    const attachmentPlane = this.sourceAttachmentPlane(targetAx2);
    const result = this.applyBoolCut(targetShape, placedTool, op.span);
    state.solidCutAliases.set(op.objName, {
      targetName: parsed.objName,
      targetShape,
      toolShape: placedTool,
      resultShape: result,
      ...(toolSource.toolKind ? { toolKind: toolSource.toolKind } : {}),
    });
    this.aliasSolidCutResult(
      state,
      op,
      parsed.objName,
      result,
      placedTool,
      attachmentPlane,
    );

    if (toolSource.deleteSource)
      (toolSource.shape as { delete(): void }).delete?.();
    (toolSource.sourceAx2 as { delete(): void }).delete?.();
    (targetAx2 as { delete(): void }).delete?.();
  }

  /**
   * Returns shape data for for solid cut target using the supplied shape and operation state.
   */
  private shapeForSolidCutTarget(
    state: GroupBuildState,
    targetName: string,
  ): OC | undefined {
    const component = state.partSolidAliasComponents.get(targetName);
    if (component) return state.partSolidComponents.get(component);
    return state.labelMap.getShape(targetName);
  }

  /**
   * Coordinates alias solid cut result as part of the OpenCascade build pipeline.
   */
  private aliasSolidCutResult(
    state: GroupBuildState,
    op: IRSolidCut,
    targetName: string,
    result: OC,
    regionShape: OC,
    attachmentPlane: SourceAttachmentPlane,
  ): void {
    if (state.partSolidOwner) {
      const component = state.partSolidAliasComponents.get(targetName);
      if (component) {
        state.partSolidComponents.set(component, result);
        this.registerPartSolidAliasComponent(state, targetName, result);
        aliasDeferredPartCut(
          state,
          op.objName,
          targetName,
          regionShape,
          attachmentPlane,
        );
        this.registerPartSolidAliasComponent(state, op.objName, result);
        return;
      }
    }
    this.aliasBody(state, op.objName, targetName, 'inner');
    this.replaceBody(state, targetName, result);
    const frame =
      state.bodyFrames.get(this.ownerFor(state, targetName)) ??
      workplaneFrame(state.defaultWorkplane);
    state.labelMap.register(
      this.oc,
      op.objName,
      result,
      'inner',
      frame,
      regionShape,
      attachmentPlane,
    );
  }

  /**
   * Builds solid cut tool source for the current OpenCascade build.
   */
  private buildSolidCutToolSource(
    state: GroupBuildState,
    op: IRSolidCut,
  ): SolidCutToolSource {
    if (op.tool.kind === 'object') {
      this.preserveSolidCutToolComponent(state, op.tool.objName);
      const shape = this.shapeForSolidCutTool(state, op.tool.objName);
      if (!shape) {
        throw occtError(
          `solid cut: no tool object named '${op.tool.objName}'`,
          op.span,
        );
      }
      return {
        shape,
        sourceAx2: this.sourceAxisForSolidCutTool(state, op.tool.objName),
        copy: true,
        deleteSource: false,
        ...((shape as { _sourceOperationKind?: string })._sourceOperationKind
          ? {
              toolKind: (shape as { _sourceOperationKind?: string })
                ._sourceOperationKind,
            }
          : {}),
      };
    }
    return {
      ...this.buildInlineSolidToolShape(state, op.tool.operation),
      copy: true,
      deleteSource: true,
    };
  }

  /**
   * Preserves solid cut tool component for the current OpenCascade build.
   */
  private preserveSolidCutToolComponent(
    state: GroupBuildState,
    toolName: string,
  ): void {
    const component = state.partSolidAliasComponents.get(toolName);
    if (component) state.preservedPartComponents.add(component);
  }

  /**
   * Returns shape data for for solid cut tool using the supplied shape and operation state.
   */
  private shapeForSolidCutTool(
    state: GroupBuildState,
    toolName: string,
  ): OC | undefined {
    const component = state.partSolidAliasComponents.get(toolName);
    if (component) return state.partSolidComponents.get(component);
    return state.bodyShapes.get(this.ownerFor(state, toolName));
  }

  /**
   * Returns the authored placement axis for a predefined solid cut tool.
   * The bottom face label's normal points outward from the tool, which reverses
   * an extruded punch when placing it into a top cut. The source origin should
   * still be the tool bottom center, but the orientation must come from the
   * body frame that describes the direction the solid was authored to grow.
   */
  private sourceAxisForSolidCutTool(
    state: GroupBuildState,
    toolName: string,
  ): OC {
    const bottomAx2 = state.labelMap.resolveAxis(this.oc, {
      faceRef: `${toolName}.bottom.center`,
    }) as OC;
    const bottomAxes = ax2Axes(bottomAx2);
    bottomAx2.delete?.();
    const frame =
      state.bodyFrames.get(toolName) ??
      state.bodyFrames.get(this.ownerFor(state, toolName)) ??
      workplaneFrame(state.defaultWorkplane);
    return makeAxisFromVectors(this.oc, bottomAxes.point, frame.z, frame.x);
  }

  /**
   * Builds inline solid tool shape for the current OpenCascade build.
   */
  private buildInlineSolidToolShape(
    state: GroupBuildState,
    op: Extract<IRSolidCut['tool'], { kind: 'operation' }>['operation'],
  ): { shape: OC; sourceAx2: OC; toolKind?: string } {
    if (op.kind === 'extrude') {
      return this.buildInlineExtrudeToolShape(state, op);
    }
    if (op.kind === 'revolve') {
      return this.buildInlineRevolveToolShape(state, op);
    }
    if (op.kind === 'loft') {
      return { ...this.buildLoftShape(state, op), toolKind: 'loft' };
    }
    if (op.kind === 'sweep') {
      const shape = this.buildSweepSolid(
        state,
        op.sketchName,
        op.pathName,
        op.orientation,
        op.span,
      );
      const ax2 =
        state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc);
      return { shape, sourceAx2: ax2 };
    }
    return {
      shape: buildSurfaceThickenOperation(this.oc, state, op),
      sourceAx2: makeWorkplaneAxis(this.oc, state.defaultWorkplane),
    };
  }

  /**
   * Builds inline extrude tool shape for the current OpenCascade build.
   */
  private buildInlineExtrudeToolShape(
    state: GroupBuildState,
    op: IRExtrude,
  ): { shape: OC; sourceAx2: OC } {
    const exactRegion = this.buildExactProfileRegionExtrude(
      state,
      op.sketchName,
      op.from,
      op.depth,
      op.symmetric,
      op.span,
      op.closedBodyNames,
    );
    if (exactRegion)
      return { shape: exactRegion.shape, sourceAx2: exactRegion.ax2 };
    const { sketchFace, ax2 } = this.resolveSketchFaceAndAxis(
      state,
      op.sketchName,
      op.from,
      op.span,
      op.closedBodyNames,
    );
    const placedFace = this.positionFace(sketchFace, ax2);
    if (op.closedBodyNames?.length) sketchFace.delete();
    const shape = this.applyExtrude(
      placedFace,
      ax2,
      op.depth,
      op.symmetric,
      op.span,
    );
    placedFace.delete();
    return { shape, sourceAx2: ax2 };
  }

  /**
   * Builds an inline revolve cutter in the tool's local radial/axial frame.
   * A normal revolve body uses the sketch plane directly. For solid cut tools,
   * the tool's local positive Z is the cutting and revolve axis, so the sketch
   * face must first move into a plane containing that axis to avoid degenerate
   * fan geometry when the user writes `revolve(profile around z)`.
   */
  private buildInlineRevolveToolShape(
    state: GroupBuildState,
    op: IRRevolve,
  ): { shape: OC; sourceAx2: OC } {
    const sketchFace = this.sketchFaceForInlineTool(
      state,
      op.sketchName,
      op.span,
    );
    const sourceAx2 = this.sketchAxisForInlineTool(state, op.sketchName);
    const profileAx2 = inlineRevolveToolProfileAxis(this.oc, sourceAx2);
    const placedFace = this.positionInlineRevolveToolFace(
      sketchFace,
      profileAx2,
      op.radius,
    );
    const shape = this.revolveInlineToolFace(state, op, placedFace, sourceAx2);

    placedFace.delete();
    profileAx2.delete?.();
    return { shape, sourceAx2 };
  }

  /**
   * Builds sketch data for face for inline tool using the supplied shape and operation state.
   */
  private sketchFaceForInlineTool(
    state: GroupBuildState,
    sketchName: string,
    span: SourceSpan,
  ): OC {
    const sketchFace = state.sketchFaces.get(sketchName);
    if (!sketchFace) throw occtError(`Unknown sketch '${sketchName}'`, span);
    return sketchFace;
  }

  /**
   * Builds sketch data for axis for inline tool using the supplied shape and operation state.
   */
  private sketchAxisForInlineTool(
    state: GroupBuildState,
    sketchName: string,
  ): OC {
    return state.sketchAxes.get(sketchName) ?? makeDefaultAxis(this.oc);
  }

  /**
   * Places and offsets a revolve tool profile in its radial/axial plane.
   * The profile face must be moved before revolve so sketch X is radial and
   * sketch Y is axial along the tool's local cut direction.
   */
  private positionInlineRevolveToolFace(
    sketchFace: OC,
    profileAx2: OC,
    radius: number | undefined,
  ): OC {
    const placedFace = this.positionFace(sketchFace, profileAx2);
    return this.translateInlineRevolveToolFace(placedFace, profileAx2, radius);
  }

  /**
   * Translates inline revolve tool face for the current OpenCascade build.
   */
  private translateInlineRevolveToolFace(
    placedFace: OC,
    profileAx2: OC,
    radius: number | undefined,
  ): OC {
    if (radius === undefined || radius === 0) return placedFace;
    return this.translateAlongSketchX(placedFace, profileAx2, radius);
  }

  /**
   * Coordinates revolve inline tool face as part of the OpenCascade build pipeline.
   */
  private revolveInlineToolFace(
    state: GroupBuildState,
    op: IRRevolve,
    placedFace: OC,
    sourceAx2: OC,
  ): OC {
    const axis = this.makeRevolveAxisFromVec(
      this.revolveAxisVectors(state, op, sourceAx2),
    );
    const revol = new this.oc.BRepPrimAPI_MakeRevol_1(
      placedFace,
      axis,
      (op.angleDeg * Math.PI) / 180,
      false,
    );
    if (!revol.IsDone())
      throw occtError('Solid cut revolve tool failed', op.span);
    const shape = revol.Shape();
    axis.delete?.();
    revol.delete();
    return shape;
  }

  /**
   * Returns a placement axis whose normal points into the target solid.
   * Solid tools are authored with their local positive Z as their cutting
   * direction. Face labels point outward from the target, so top/side solid
   * cuts must flip that face frame when the body center is behind the normal.
   */
  private solidCutTargetAxis(targetAx2: OC, targetShape: OC): OC {
    const axes = ax2Axes(targetAx2);
    const [cx, cy, cz] = this.shapeCenter(targetShape);
    const toCenter: Vec3 = [
      cx - axes.point[0],
      cy - axes.point[1],
      cz - axes.point[2],
    ];
    const dot =
      axes.z[0] * toCenter[0] +
      axes.z[1] * toCenter[1] +
      axes.z[2] * toCenter[2];
    targetAx2.delete?.();
    if (dot >= 0)
      return makeAxisFromVectors(this.oc, axes.point, axes.z, axes.x);
    return makeAxisFromVectors(
      this.oc,
      axes.point,
      [-axes.z[0], -axes.z[1], -axes.z[2]],
      axes.x,
    );
  }

  /**
   * Builds radial extrude operation for the current OpenCascade build.
   */
  private buildRadialExtrudeOperation(
    state: GroupBuildState,
    op: IRRadialExtrude,
  ): void {
    const shape = this.buildRadialSolid(state, op, op.span);
    this.addBodyFromSketchAxis(
      state,
      op.objName,
      op.sketchName,
      shape,
      op.material ?? null,
      op.span,
    );
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
    );
  }

  /**
   * Adds a body using the source sketch axis as the face-frame basis.
   * Several sketch-derived solids need identical frame registration so face
   * labels resolve consistently after construction.
   */
  private addBodyFromSketchAxis(
    state: GroupBuildState,
    objName: string,
    sketchName: string,
    shape: OC,
    material: MaterialAppearance | null,
    span?: SourceSpan,
  ): void {
    const ax2 = state.sketchAxes.get(sketchName) ?? makeDefaultAxis(this.oc);
    this.addBody(state, objName, shape, faceFrameFromAx2(ax2), material, span);
  }

  /**
   * Builds radial cut operation for the current OpenCascade build.
   */
  private buildRadialCutOperation(
    state: GroupBuildState,
    op: IRRadialCut,
  ): void {
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = state.labelMap.getShape(parsed.objName);
    if (!targetShape)
      throw occtError(
        `Unknown object '${parsed.objName}' for radial_cut`,
        op.span,
      );
    const tool = this.buildRadialSolid(state, op, op.span, targetShape);
    const result = this.applyBoolCut(targetShape, tool as OC, op.span);
    this.aliasBody(state, op.objName, parsed.objName, 'inner');
    this.replaceBody(state, parsed.objName, result);
    (tool as { delete?(): void }).delete?.();
  }

  /**
   * Builds radial solid for the current OpenCascade build.
   */
  private buildRadialSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
    cutTargetShape?: OC,
  ): OC {
    const sketchWire = this.radialSketchWire(state, op, span);
    const ax2 = this.radialSourceAxis(state, op);

    if (op.extent.kind === 'placement-bridge') {
      return this.buildRadialPlacementBridgeSolid(
        state,
        op,
        ax2,
        span,
        cutTargetShape,
      );
    }

    if (op.extent.kind !== 'angle-length') {
      throw occtError(
        `radial 'between:' extent is not yet supported by the OCCT bridge — use 'angle:' + 'length:'`,
        span,
      );
    }
    const extent = op.extent;
    this.validateRadialAngleLengthModifiers(op, span);
    const axisVec = this.radialAxisVector(state, op, ax2);
    const axialSign = this.radialAxialSign(op, axisVec, cutTargetShape);
    const stations = this.radialStations(op, extent, span);
    const wires = this.buildRadialStationWires(
      sketchWire,
      ax2,
      op,
      axisVec,
      stations,
      axialSign,
    );

    // Ruled mode (param 2 = true) — linear sections between consecutive wires.
    // Smoother (ruled=false) can fragment helical sweeps into compound solids,
    // which then mesh-extract as multiple meshes (one per sub-solid) and the
    // renderer colors each with a different palette entry.
    return this.buildRadialLoftShape(wires, span);
  }

  /**
   * Builds radial data for sketch wire using the supplied shape and operation state.
   */
  private radialSketchWire(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
  ): OC {
    const sketchWire = state.sketchWires.get(op.sketchName);
    if (!sketchWire) throw occtError(`Unknown sketch '${op.sketchName}'`, span);
    return sketchWire;
  }

  /**
   * Builds radial data for source axis using the supplied shape and operation state.
   */
  private radialSourceAxis(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
  ): OC {
    return op.from
      ? state.labelMap.resolveAxis(this.oc, op.from)
      : (state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc));
  }

  /**
   * Rejects radial modifiers this OCCT path does not support.
   * Angle/length radial sweeps support station placement only; twist and taper
   * must keep the same explicit errors as before the extraction.
   */
  private validateRadialAngleLengthModifiers(
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
  ): void {
    if (op.twistDeg !== 0) {
      throw occtError(
        `radial 'twist:' is not yet supported by the OCCT bridge`,
        span,
      );
    }
    if (op.taperDeg !== 0) {
      throw occtError(
        `radial 'taper:' is not yet supported by the OCCT bridge`,
        span,
      );
    }
  }

  /**
   * Builds radial data for axis vector using the supplied shape and operation state.
   */
  private radialAxisVector(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
  ): { point: Vec3; dir: Vec3 } {
    return typeof op.axis === 'string'
      ? axisPointAndLocalDirection(ax2, op.axis)
      : axisPointAndDirection(state.labelMap.resolveAxis(this.oc, op.axis));
  }

  /**
   * Builds radial data for axial sign using the supplied shape and operation state.
   */
  private radialAxialSign(
    op: IRRadialExtrude | IRRadialCut,
    axisVec: { point: Vec3; dir: Vec3 },
    cutTargetShape?: OC,
  ): number {
    return cutTargetShape && op.kind === 'radial_cut'
      ? this.axisSignTowardShape(axisVec.point, axisVec.dir, cutTargetShape)
      : 1;
  }

  /**
   * Builds radial data for stations using the supplied shape and operation state.
   */
  private radialStations(
    op: IRRadialExtrude | IRRadialCut,
    extent: Extract<
      (IRRadialExtrude | IRRadialCut)['extent'],
      { kind: 'angle-length' }
    >,
    span: SourceSpan,
  ): ReturnType<typeof buildRadialStations> {
    const stations = buildRadialStations({
      angleDeg: extent.angleDeg,
      lengthMm: extent.lengthMm,
      curve: op.curve,
      direction: op.direction,
      startDeg: op.startDeg,
      sections: op.sections,
    });

    if (stations.length < 2) {
      throw occtError(
        `radial sweep produced fewer than 2 distinct stations (angle=${extent.angleDeg}, length=${extent.lengthMm})`,
        span,
      );
    }
    return stations;
  }

  /**
   * Builds radial station wires for the current OpenCascade build.
   */
  private buildRadialStationWires(
    sketchWire: OC,
    ax2: OC,
    op: IRRadialExtrude | IRRadialCut,
    axisVec: { point: Vec3; dir: Vec3 },
    stations: ReturnType<typeof buildRadialStations>,
    axialSign: number,
  ): OC[] {
    return stations.map(({ rotDeg, axialMm }) =>
      this.buildRadialStationWire(
        sketchWire,
        ax2,
        op,
        axisVec,
        rotDeg,
        axialMm,
        axialSign,
      ),
    );
  }

  /**
   * Builds radial station wire for the current OpenCascade build.
   */
  private buildRadialStationWire(
    sketchWire: OC,
    ax2: OC,
    op: IRRadialExtrude | IRRadialCut,
    axisVec: { point: Vec3; dir: Vec3 },
    rotDeg: number,
    axialMm: number,
    axialSign: number,
  ): OC {
    let placed = this.positionFace(sketchWire, ax2);
    if (op.radius !== 0) {
      placed = this.translateAlongSketchX(placed, ax2, op.radius);
    }
    if (rotDeg !== 0) {
      placed = this.rotateShape(placed, axisVec.point, axisVec.dir, rotDeg);
    }
    if (axialMm !== 0) {
      placed = this.translateShape(
        placed,
        axisVec.dir[0] * axialMm * axialSign,
        axisVec.dir[1] * axialMm * axialSign,
        axisVec.dir[2] * axialMm * axialSign,
      );
    }
    return placed;
  }

  /**
   * Builds the ruled loft through radial station wires.
   * Ruled mode keeps helical radial sweeps as one solid for stable mesh output
   * and color assignment.
   */
  private buildRadialLoftShape(wires: OC[], span: SourceSpan): OC {
    const loft = new this.oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
    loft.CheckCompatibility?.(false);
    for (const w of wires) loft.AddWire(this.oc.TopoDS.Wire_1(w));
    loft.Build();
    if (loft.IsDone && !loft.IsDone())
      throw occtError('Radial loft failed', span);
    const shape = loft.Shape();
    for (const w of wires) (w as { delete?(): void }).delete?.();
    loft.delete?.();
    return shape;
  }

  /**
   * Builds radial placement bridge solid for the current OpenCascade build.
   */
  private buildRadialPlacementBridgeSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
    span: SourceSpan,
    cutTargetShape?: OC,
  ): OC {
    if (op.extent.kind !== 'placement-bridge') {
      throw occtError('Expected radial placement bridge extent', span);
    }
    const pathWire = this.radialPlacementGuidePathWire(state, op.extent, span);
    if (!pathWire) {
      return this.buildAutoRadialPlacementBridgeSolid(
        state,
        op,
        ax2,
        cutTargetShape,
        span,
      );
    }
    const sketchWire = this.radialSketchWire(state, op, span);
    const profileAx2 = this.radialPlacementProfileAxis(
      pathWire,
      op,
      ax2,
      cutTargetShape,
    );
    const ownsProfileAx2 = profileAx2 !== ax2;
    const placedProfile = this.positionFace(sketchWire, profileAx2);
    if (ownsProfileAx2) (profileAx2 as { delete?(): void }).delete?.();
    return this.buildRadialPlacementPipeSolid(pathWire, placedProfile, span);
  }

  /**
   * Builds radial data for placement guide path wire using the supplied shape and operation state.
   */
  private radialPlacementGuidePathWire(
    state: GroupBuildState,
    extent: Extract<
      (IRRadialExtrude | IRRadialCut)['extent'],
      { kind: 'placement-bridge' }
    >,
    span: SourceSpan,
  ): OC | null {
    const pathWire = extent.guidePathName
      ? state.pathWires.get(extent.guidePathName)
      : null;
    if (!pathWire && extent.guidePathName) {
      throw occtError(
        `Unknown path '${extent.guidePathName}' for radial placement bridge`,
        span,
      );
    }
    return pathWire ?? null;
  }

  /**
   * Builds radial data for placement profile axis using the supplied shape and operation state.
   */
  private radialPlacementProfileAxis(
    pathWire: OC,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
    cutTargetShape?: OC,
  ): OC {
    return cutTargetShape && op.kind === 'radial_cut'
      ? this.radialBridgeCutProfileAxis(pathWire, op, ax2, cutTargetShape)
      : ax2;
  }

  /**
   * Builds radial placement pipe solid for the current OpenCascade build.
   */
  private buildRadialPlacementPipeSolid(
    pathWire: OC,
    placedProfile: OC,
    span: SourceSpan,
  ): OC {
    const pipeShell = new this.oc.BRepOffsetAPI_MakePipeShell(pathWire);
    pipeShell.Add_1(this.oc.TopoDS.Wire_1(placedProfile), false, false);
    pipeShell.SetMode_1(false);
    pipeShell.Build();
    if (!pipeShell.IsDone()) {
      throw occtError('Radial placement bridge sweep failed', span);
    }
    pipeShell.MakeSolid();
    const shape = pipeShell.Shape();
    (placedProfile as { delete?(): void }).delete?.();
    pipeShell.delete?.();
    return shape;
  }

  /**
   * Builds auto radial placement bridge solid for the current OpenCascade build.
   */
  private buildAutoRadialPlacementBridgeSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    fromAx2: OC,
    cutTargetShape: OC | undefined,
    span: SourceSpan,
  ): OC {
    if (op.extent.kind !== 'placement-bridge') {
      throw occtError('Expected radial placement bridge extent', span);
    }
    const sketchWire = state.sketchWires.get(op.sketchName);
    if (!sketchWire) {
      throw occtError(`Unknown sketch '${op.sketchName}'`, span);
    }

    const fromAxes = ax2Axes(fromAx2);
    const toAx2 = state.labelMap.resolveAxis(this.oc, op.extent.to) as OC;
    const toAxes = ax2Axes(toAx2);
    (toAx2 as { delete?(): void }).delete?.();

    const startDir = this.bridgeInteriorDirection(
      fromAxes.point,
      fromAxes.z,
      cutTargetShape,
    );
    const endInteriorDir = this.bridgeInteriorDirection(
      toAxes.point,
      toAxes.z,
      cutTargetShape,
    );
    const endDir: Vec3 = [
      -endInteriorDir[0],
      -endInteriorDir[1],
      -endInteriorDir[2],
    ];
    const points = this.buildAutoBridgeBezierPoints(
      fromAxes.point,
      startDir,
      toAxes.point,
      endDir,
      op.curve,
      cutTargetShape,
    );
    const wires = points.map(({ point, tangent, t }) => {
      const xDir = this.bridgeSectionXDirection(
        fromAxes.x,
        toAxes.x,
        tangent,
        t,
      );
      const sectionAx2 = this.makeAx2(point, tangent, xDir);
      const placed = this.positionFace(sketchWire, sectionAx2);
      (sectionAx2 as { delete?(): void }).delete?.();
      return placed;
    });

    const shape = buildThruSectionsLoft(
      this.oc,
      wires,
      'Radial placement bridge loft failed',
      span,
    );
    for (const wire of wires) (wire as { delete?(): void }).delete?.();
    return shape;
  }

  /**
   * Builds radial data for bridge curve scales using the supplied shape and operation state.
   */
  private radialBridgeCurveScales(
    curve: IRRadialExtrude['curve'],
  ): [number, number] {
    switch (curve.kind) {
      case 'ease-in':
        return [0.55, 1.45];
      case 'ease-out':
        return [1.45, 0.55];
      case 'ease':
      case 'ease-in-out':
        return [1.25, 1.25];
      case 'step-start':
        return [0.35, 1.65];
      case 'step-end':
        return [1.65, 0.35];
      case 'cubic-bezier':
        return [
          Math.max(0.25, Math.min(1.75, 0.5 + curve.y1)),
          Math.max(0.25, Math.min(1.75, 0.5 + (1 - curve.y2))),
        ];
      default:
        return [1, 1];
    }
  }

  /**
   * Coordinates bridge interior direction as part of the OpenCascade build pipeline.
   */
  private bridgeInteriorDirection(
    point: Vec3,
    normal: Vec3,
    targetShape: OC | undefined,
  ): Vec3 {
    const sign = targetShape
      ? this.axisSignTowardShape(point, normal, targetShape)
      : 1;
    return [normal[0] * sign, normal[1] * sign, normal[2] * sign];
  }

  /**
   * Adds scaled vec for the current OpenCascade build.
   */
  private addScaledVec(point: Vec3, dir: Vec3, scale: number): Vec3 {
    return [
      point[0] + dir[0] * scale,
      point[1] + dir[1] * scale,
      point[2] + dir[2] * scale,
    ];
  }

  /**
   * Calculates distance for between using the supplied shape and operation state.
   */
  private distanceBetween(a: Vec3, b: Vec3): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  /**
   * Builds auto bridge bezier points for the current OpenCascade build.
   */
  private buildAutoBridgeBezierPoints(
    start: Vec3,
    startDir: Vec3,
    end: Vec3,
    endDir: Vec3,
    curve: IRRadialExtrude['curve'],
    targetShape: OC | undefined,
  ): { point: Vec3; tangent: Vec3; t: number }[] {
    const [startScale, endScale] = this.radialBridgeCurveScales(curve);
    const distance = Math.max(1, this.distanceBetween(start, end));
    const baseHandle = distance * 0.3;
    const bounds = targetShape ? readBounds(this.oc, targetShape) : null;
    let startHandle = baseHandle * startScale;
    let endHandle = baseHandle * endScale;
    for (let i = 0; i < 8 && bounds; i++) {
      const p1 = this.addScaledVec(start, startDir, startHandle);
      const p2 = this.addScaledVec(end, endDir, -endHandle);
      if (this.pointInBounds(p1, bounds) && this.pointInBounds(p2, bounds)) {
        break;
      }
      startHandle *= 0.65;
      endHandle *= 0.65;
    }

    const p0 = start;
    const p1 = this.addScaledVec(start, startDir, startHandle);
    const p2 = this.addScaledVec(end, endDir, -endHandle);
    const p3 = end;
    const samples = 12;
    return Array.from({ length: samples + 1 }, (_, index) => {
      const t = index / samples;
      const point = this.cubicBezierPoint(p0, p1, p2, p3, t);
      const tangent =
        this.cubicBezierTangent(p0, p1, p2, p3, t) ??
        (index === samples ? endDir : startDir);
      return { point, tangent, t };
    });
  }

  /**
   * Coordinates bridge section x direction as part of the OpenCascade build pipeline.
   */
  private bridgeSectionXDirection(
    startX: Vec3,
    endX: Vec3,
    tangent: Vec3,
    t: number,
  ): Vec3 {
    const blended = normalizeVec([
      startX[0] * (1 - t) + endX[0] * t,
      startX[1] * (1 - t) + endX[1] * t,
      startX[2] * (1 - t) + endX[2] * t,
    ]);
    return (
      (blended ? projectPerpendicular(blended, tangent) : null) ??
      projectPerpendicular(startX, tangent) ??
      projectPerpendicular(endX, tangent) ??
      ([1, 0, 0] as Vec3)
    );
  }

  /**
   * Coordinates cubic bezier point as part of the OpenCascade build pipeline.
   */
  private cubicBezierPoint(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    t: number,
  ): Vec3 {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [
      p0[0] * a + p1[0] * b + p2[0] * c + p3[0] * d,
      p0[1] * a + p1[1] * b + p2[1] * c + p3[1] * d,
      p0[2] * a + p1[2] * b + p2[2] * c + p3[2] * d,
    ];
  }

  /**
   * Coordinates cubic bezier tangent as part of the OpenCascade build pipeline.
   */
  private cubicBezierTangent(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    t: number,
  ): Vec3 | null {
    const u = 1 - t;
    return normalizeVec([
      3 * u * u * (p1[0] - p0[0]) +
        6 * u * t * (p2[0] - p1[0]) +
        3 * t * t * (p3[0] - p2[0]),
      3 * u * u * (p1[1] - p0[1]) +
        6 * u * t * (p2[1] - p1[1]) +
        3 * t * t * (p3[1] - p2[1]),
      3 * u * u * (p1[2] - p0[2]) +
        6 * u * t * (p2[2] - p1[2]) +
        3 * t * t * (p3[2] - p2[2]),
    ]);
  }

  /**
   * Builds point data for in bounds using the supplied shape and operation state.
   */
  private pointInBounds(
    point: Vec3,
    bounds: ReturnType<typeof readBounds>,
  ): boolean {
    const eps = 1e-6;
    return (
      point[0] >= bounds.xMin.current - eps &&
      point[0] <= bounds.xMax.current + eps &&
      point[1] >= bounds.yMin.current - eps &&
      point[1] <= bounds.yMax.current + eps &&
      point[2] >= bounds.zMin.current - eps &&
      point[2] <= bounds.zMax.current + eps
    );
  }

  /**
   * Reads a placement axis without taking ownership of the OCCT handle.
   * Some frame helpers intentionally delete the axis they read. Radial bridge
   * construction receives the live `from:` axis and must keep it valid for
   * later profile placement.
   */
  private readAx2PointAndDirection(ax2: OC): { point: Vec3; dir: Vec3 } {
    const axes = ax2Axes(ax2);
    return { point: axes.point, dir: axes.z };
  }

  /**
   * Builds axis data for sign toward shape using the supplied shape and operation state.
   */
  private axisSignTowardShape(point: Vec3, dir: Vec3, targetShape: OC): number {
    const [cx, cy, cz] = this.shapeCenter(targetShape);
    const dot =
      dir[0] * (cx - point[0]) +
      dir[1] * (cy - point[1]) +
      dir[2] * (cz - point[2]);
    return dot < 0 ? -1 : 1;
  }

  /**
   * Builds radial data for bridge cut profile axis using the supplied shape and operation state.
   */
  private radialBridgeCutProfileAxis(
    pathWire: OC,
    op: IRRadialCut,
    ax2: OC,
    targetShape: OC,
  ): OC {
    if (op.extent.kind !== 'placement-bridge') return ax2;
    const tangent = this.pathStartTangent(pathWire);
    if (!tangent) return ax2;

    const axis = this.readAx2PointAndDirection(ax2);
    const normal = axis.dir;
    const inward = this.axisSignTowardShape(axis.point, normal, targetShape);
    const inwardVec: Vec3 = [
      normal[0] * inward,
      normal[1] * inward,
      normal[2] * inward,
    ];
    const xDir = projectPerpendicular(inwardVec, tangent);
    if (!xDir) return ax2;
    return this.makeAx2(axis.point, tangent, xDir);
  }

  /**
   * Builds path data for start tangent using the supplied shape and operation state.
   */
  private pathStartTangent(pathWire: OC): Vec3 | null {
    const edges = getEdges(this.oc, pathWire);
    const first = edges[0];
    if (!first) return null;
    const [start, end] = readEdgeEndpoints(this.oc, first);
    return normalizeVec([
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2],
    ]);
  }

  /**
   * Creates axis system for the current OpenCascade build.
   */
  private makeAx2(point: Vec3, zDirVec: Vec3, xDirVec: Vec3): OC {
    const origin = new this.oc.gp_Pnt_3(point[0], point[1], point[2]);
    const zDir = new this.oc.gp_Dir_4(zDirVec[0], zDirVec[1], zDirVec[2]);
    const xDir = new this.oc.gp_Dir_4(xDirVec[0], xDirVec[1], xDirVec[2]);
    const ax2 = new this.oc.gp_Ax2_2(origin, zDir, xDir);
    origin.delete();
    zDir.delete();
    xDir.delete();
    return ax2;
  }

  /**
   * Builds revolve operation for the current OpenCascade build.
   */
  private buildRevolveOperation(state: GroupBuildState, op: IRRevolve): void {
    const ax2 = state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc);
    const shape = this.buildRevolveShape(state, op);
    this.addBody(
      state,
      op.objName,
      shape,
      this.revolveBodyFrame(state, op, ax2),
      op.material ?? null,
      op.span,
    );
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
      { revolveAxis: this.revolveAxisVectors(state, op, ax2) },
    );
  }

  /**
   * Builds revolve shape for the current OpenCascade build.
   */
  private buildRevolveShape(state: GroupBuildState, op: IRRevolve): OC {
    const sketchFace = state.sketchFaces.get(op.sketchName);
    if (!sketchFace)
      throw occtError(`Unknown sketch '${op.sketchName}'`, op.span);
    const ax2 = state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc);
    let placedFace = this.positionFace(sketchFace, ax2);
    if (op.radius !== undefined && op.radius !== 0) {
      placedFace = this.translateAlongSketchX(placedFace, ax2, op.radius);
    }
    const revolveAxisVec = this.revolveAxisVectors(state, op, ax2);
    const axis = this.makeRevolveAxisFromVec(revolveAxisVec);
    const revol = new this.oc.BRepPrimAPI_MakeRevol_1(
      placedFace,
      axis,
      (op.angleDeg * Math.PI) / 180,
      false,
    );
    if (!revol.IsDone()) throw occtError('Revolve failed', op.span);
    const shape = revol.Shape();
    placedFace.delete();
    axis.delete?.();
    revol.delete();
    void revolveAxisVec;
    return shape;
  }

  /**
   * Translates along sketch x for the current OpenCascade build.
   */
  private translateAlongSketchX(face: OC, ax2: OC, radius: number): OC {
    const axis = ax2 as Record<string, () => OC>;
    const xDir = axis.XDirection() as Record<string, () => number>;
    const dx = xDir.X() * radius;
    const dy = xDir.Y() * radius;
    const dz = xDir.Z() * radius;
    (xDir as unknown as { delete(): void }).delete();
    return this.translateShape(face, dx, dy, dz);
  }

  /**
   * Builds loft operation for the current OpenCascade build.
   */
  private buildLoftOperation(state: GroupBuildState, op: IRLoft): void {
    const { shape: movedShape, sourceAx2: baseAx2 } = this.buildLoftShape(
      state,
      op,
    );
    (movedShape as { _sourceOperationKind?: string })._sourceOperationKind =
      'loft';
    this.addBody(
      state,
      op.objName,
      movedShape,
      faceFrameFromAx2(baseAx2),
      op.material ?? null,
      op.span,
    );
    for (const sketchName of op.sketchNames) {
      registerPrimitiveNamedEdgesForBody(
        this.oc,
        state,
        op.objName,
        sketchName,
      );
    }
  }

  /**
   * Builds loft shape for the current OpenCascade build.
   */
  private buildLoftShape(
    state: GroupBuildState,
    op: IRLoft,
  ): { shape: OC; sourceAx2: OC } {
    // Build loft in canonical workplane space, then rigidly transform to instance placement.
    // This keeps the loft's shape independent of where it is mounted.
    const baseAx2 =
      state.sketchAxes.get(op.sketchNames[0]) ?? makeDefaultAxis(this.oc);
    const loftWorkplane = op.guideWorkplane ?? state.defaultWorkplane;
    const wpAx2 = makeWorkplaneAxis(this.oc, loftWorkplane);

    let shape: OC;
    if (op.guide) {
      shape = this.applyGuidedLoft(state, op, wpAx2);
    } else {
      const wires = op.sketchNames.map((name, index) =>
        this.positionLoftWire(state, name, index, op, wpAx2),
      );
      shape = this.applyThruSectionsLoft(op, wires);
    }

    const fromAx3 = new this.oc.gp_Ax3_2(wpAx2);
    const toAx3 = new this.oc.gp_Ax3_2(baseAx2);
    const trsf = new this.oc.gp_Trsf_1();
    trsf.SetDisplacement(fromAx3, toAx3);
    const movedShape = new this.oc.BRepBuilderAPI_Transform_2(
      shape,
      trsf,
      false,
    ).Shape();
    shape.delete?.();
    [fromAx3, toAx3, trsf, wpAx2].forEach((o) => o.delete?.());
    return { shape: movedShape, sourceAx2: baseAx2 };
  }

  /**
   * Coordinates revolve axis vectors as part of the OpenCascade build pipeline.
   */
  private revolveAxisVectors(
    state: GroupBuildState,
    op: IRRevolve,
    ax2: OC,
  ): { point: Vec3; dir: Vec3 } {
    return typeof op.around === 'string'
      ? axisPointAndLocalDirection(ax2, op.around)
      : axisPointAndDirection(state.labelMap.resolveAxis(this.oc, op.around));
  }

  /**
   * Coordinates revolve body frame as part of the OpenCascade build pipeline.
   */
  private revolveBodyFrame(
    state: GroupBuildState,
    op: IRRevolve,
    ax2: OC,
  ): FaceFrame {
    if (typeof op.around !== 'string') return faceFrameFromAx2(ax2);
    const prim = state.sketchPrimitives.get(op.sketchName);
    const localPlantNormal = prim
      ? revolvePlantLocalNormal(prim, op.around)
      : null;
    if (!localPlantNormal) return faceFrameFromAx2(ax2);
    const axes = ax2Axes(ax2);
    const worldPlantNormal = localVectorToWorld(localPlantNormal, axes);
    return frameFromPlantNormal(worldPlantNormal, axes);
  }

  /**
   * Creates revolve axis from vec for the current OpenCascade build.
   */
  private makeRevolveAxisFromVec(axis: { point: Vec3; dir: Vec3 }): OC {
    const pnt = new this.oc.gp_Pnt_3(
      axis.point[0],
      axis.point[1],
      axis.point[2],
    );
    const dir = new this.oc.gp_Dir_4(axis.dir[0], axis.dir[1], axis.dir[2]);
    const ax1 = new this.oc.gp_Ax1_2(pnt, dir);
    pnt.delete();
    dir.delete();
    return ax1;
  }

  /**
   * Coordinates position loft wire as part of the OpenCascade build pipeline.
   */
  private positionLoftWire(
    state: GroupBuildState,
    sketchName: string,
    index: number,
    op: IRLoft,
    wpAx2: OC,
  ): OC {
    const wire = state.sketchWires.get(sketchName);
    if (!wire) throw occtError(`Unknown sketch '${sketchName}'`, op.span);
    const placed = this.positionFace(wire, wpAx2);
    if (index === 0 || op.sketchNames.length <= 1) return placed;

    const dir = axisDirection(wpAx2);
    const offset = (op.height * index) / (op.sketchNames.length - 1);
    return this.translateShape(
      placed,
      dir[0] * offset,
      dir[1] * offset,
      dir[2] * offset,
    );
  }

  /**
   * Applies thru sections loft for the current OpenCascade build.
   */
  private applyThruSectionsLoft(op: IRLoft, wires: OC[]): OC {
    return buildThruSectionsLoft(this.oc, wires, 'Loft failed', op.span);
  }

  /**
   * Applies guided loft for the current OpenCascade build.
   */
  private applyGuidedLoft(state: GroupBuildState, op: IRLoft, wpAx2: OC): OC {
    const guideWire = state.sketchWires.get(op.guide!);
    if (!guideWire)
      throw occtError(`Unknown guide sketch '${op.guide}'`, op.span);

    // Build guide axis so guide y-coord maps to the workplane stacking direction (wpAx2 normal).
    // guideNormal = cross(wpX, wpZ) ensures yDir = cross(guideNormal, wpX) = wpZ = stackDir.
    const wpAxes = ax2Axes(wpAx2);
    const lateralDir = wpAxes.x;
    const stackDir = wpAxes.z;
    const guideNormal =
      normalizeVec(crossVec(lateralDir, stackDir)) ?? ([0, -1, 0] as Vec3);

    const gOrigin = new this.oc.gp_Pnt_3(0, 0, 0);
    const gNormal = new this.oc.gp_Dir_4(...guideNormal);
    const gXDir = new this.oc.gp_Dir_4(...lateralDir);
    const guideAx2 = new this.oc.gp_Ax2_2(gOrigin, gNormal, gXDir);
    gOrigin.delete();
    gNormal.delete();
    gXDir.delete();

    const posGuide = this.positionFace(guideWire, guideAx2);
    guideAx2.delete?.();

    let guideStart: Vec3 = [0, 0, 0];
    let guideEnd: Vec3 = [0, 0, 0];
    try {
      const guideEdges = getEdges(this.oc, posGuide);
      if (guideEdges.length > 0) {
        [guideStart] = readEdgeEndpoints(this.oc, guideEdges[0]);
        [, guideEnd] = readEdgeEndpoints(
          this.oc,
          guideEdges[guideEdges.length - 1],
        );
      }
    } catch {
      /* empty */
    }
    posGuide.delete?.();

    const n = op.sketchNames.length;
    const wires = op.sketchNames.map((sketchName, index) => {
      const wire = state.sketchWires.get(sketchName);
      if (!wire) throw occtError(`Unknown sketch '${sketchName}'`, op.span);
      const t = n <= 1 ? 0 : index / (n - 1);
      // Relative offset from guide start so index=0 gets zero displacement.
      const tx = t * (guideEnd[0] - guideStart[0]);
      const ty = t * (guideEnd[1] - guideStart[1]);
      const tz = t * (guideEnd[2] - guideStart[2]);
      const placed = this.positionFace(wire, wpAx2);
      return this.translateShape(placed, tx, ty, tz);
    });
    return this.applyThruSectionsLoft(op, wires);
  }

  /**
   * Translates shape for the current OpenCascade build.
   */
  private translateShape(shape: OC, dx: number, dy: number, dz: number): OC {
    const trsf = new this.oc.gp_Trsf_1();
    const vec = new this.oc.gp_Vec_4(dx, dy, dz);
    trsf.SetTranslation_1(vec);
    const moved = new this.oc.BRepBuilderAPI_Transform_2(
      shape,
      trsf,
      false,
    ).Shape();
    shape.delete?.();
    trsf.delete();
    vec.delete();
    return moved;
  }

  /**
   * Ensures cylindrical wrap target for the current OpenCascade build.
   */
  private ensureCylindricalWrapTarget(
    state: GroupBuildState,
    placement: IRPlacement | null,
    span: SourceSpan,
  ): void {
    if (!placement)
      throw occtError('wrap:true requires a face placement', span);
    const parsed = parseFaceRef(placement.faceRef);
    if (!parsed.curved) {
      throw occtError('wrap:true requires a cylindrical .curved target', span);
    }
    const faces = state.labelMap.getAllFaceHandles(parsed.objName);
    if (faces.length === 0) {
      throw occtError(`Unknown object '${parsed.objName}' for wrap`, span);
    }
    if (!faces.some((face) => this.isCylinderFace(face))) {
      throw occtError('wrap:true target is not cylindrical', span);
    }
  }

  /**
   * Checks whether the supplied value meets the cylinder face condition.
   */
  private isCylinderFace(face: OC): boolean {
    try {
      const BRepAdaptorSurface =
        this.oc.BRepAdaptor_Surface_2 ?? this.oc.BRepAdaptor_Surface;
      const adaptor = new BRepAdaptorSurface(face, true);
      const type = adaptor.GetType();
      adaptor.delete?.();
      return this.isCylinderSurfaceType(type);
    } catch {
      return false;
    }
  }

  /**
   * Checks whether the supplied value meets the cylinder surface type condition.
   */
  private isCylinderSurfaceType(type: unknown): boolean {
    return (
      type === this.oc.GeomAbs_SurfaceType?.GeomAbs_Cylinder ||
      type === this.oc.GeomAbs_Cylinder ||
      type === 1 ||
      String(type).toLowerCase().includes('cylinder')
    );
  }

  /**
   * Extracts cylinder radius for the current OpenCascade build.
   */
  private extractCylinderRadius(face: OC): number {
    try {
      const BRepAdaptorSurface =
        this.oc.BRepAdaptor_Surface_2 ?? this.oc.BRepAdaptor_Surface;
      const adaptor = new BRepAdaptorSurface(face, true);
      const type = adaptor.GetType();
      if (!this.isCylinderSurfaceType(type)) {
        adaptor.delete?.();
        return 0;
      }
      const cyl = adaptor.Cylinder();
      const r = cyl.Radius();
      cyl.delete?.();
      adaptor.delete?.();
      return r;
    } catch {
      return 0;
    }
  }

  /**
   * Resolves the shared cylindrical-wrap geometry (center, frame axes, radius,
   * and rect-derived extents) used by both wrap-shape and wrap-cut builders.
   */
  private resolveCylindricalWrapGeometry(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
  ): {
    cylCenter: Vec3;
    cylAxisDir: Vec3;
    refXDir: Vec3;
    cylRadius: number;
    axialSize: number;
    sweepAngleDeg: number;
    centerAngleDeg: number;
  } | null {
    const prim = this.wrapRectanglePrimitive(state, sketchName);
    if (!prim) return null;

    const parsed = parseFaceRef(placement.faceRef);
    const cylRadius = this.firstCylinderRadius(state, parsed.objName);
    if (cylRadius <= 0) return null;
    const cylShape = state.labelMap.getShape(parsed.objName);
    if (!cylShape) return null;
    const cylCenter = this.shapeBoundsCenter(cylShape);

    const frame =
      state.bodyFrames.get(parsed.objName) ??
      workplaneFrame(state.defaultWorkplane);

    // rect width = axial extent (sketch X = cylinder axis), height = circumferential extent
    const axialSize = prim.width;
    const circumSize = prim.height;
    const sweepAngleDeg = (circumSize / cylRadius) * (180 / Math.PI);
    const centerAngleDeg = placement.surfaceAngleDeg ?? placement.angleDeg ?? 0;

    return {
      cylCenter,
      // axis = frame.z (extrude direction), angle-0 reference = frame.x
      cylAxisDir: frame.z,
      refXDir: frame.x,
      cylRadius,
      axialSize,
      sweepAngleDeg,
      centerAngleDeg,
    };
  }

  /**
   * Wraps rectangle primitive using the supplied shape and operation state.
   */
  private wrapRectanglePrimitive(
    state: GroupBuildState,
    sketchName: string,
  ): Extract<IRPrimitive, { kind: 'rect' }> | null {
    const prim = state.sketchPrimitives.get(sketchName);
    return prim?.kind === 'rect' ? prim : null;
  }

  /**
   * Coordinates first cylinder radius as part of the OpenCascade build pipeline.
   */
  private firstCylinderRadius(state: GroupBuildState, objName: string): number {
    for (const face of state.labelMap.getAllFaceHandles(objName)) {
      const radius = this.extractCylinderRadius(face);
      if (radius > 0) return radius;
    }
    return 0;
  }

  /**
   * Returns shape data for bounds center using the supplied shape and operation state.
   */
  private shapeBoundsCenter(shape: OC): Vec3 {
    const bounds = readBounds(this.oc, shape);
    return [
      (bounds.xMin.current + bounds.xMax.current) / 2,
      (bounds.yMin.current + bounds.yMax.current) / 2,
      (bounds.zMin.current + bounds.zMax.current) / 2,
    ];
  }

  /**
   * Builds cylindrical wrap shape for the current OpenCascade build.
   */
  private buildCylindricalWrapShape(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
    depth: number,
    span: SourceSpan,
  ): OC | null {
    const geo = this.resolveCylindricalWrapGeometry(
      state,
      sketchName,
      placement,
    );
    if (!geo) return null;

    return this.buildCylindricalWrapSolid(
      geo.cylCenter,
      geo.cylAxisDir,
      geo.refXDir,
      geo.cylRadius,
      geo.cylRadius + depth,
      geo.centerAngleDeg,
      geo.axialSize,
      geo.sweepAngleDeg,
      span,
    );
  }

  /**
   * Builds cylindrical wrap cut tool for the current OpenCascade build.
   */
  private buildCylindricalWrapCutTool(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
    through: boolean,
    depth: number | null,
    span: SourceSpan,
  ): OC | null {
    const geo = this.resolveCylindricalWrapGeometry(
      state,
      sketchName,
      placement,
    );
    if (!geo) return null;

    const {
      cylCenter,
      cylAxisDir,
      refXDir,
      cylRadius,
      axialSize,
      sweepAngleDeg,
      centerAngleDeg,
    } = geo;

    // Outer extends slightly past surface; inner is the cut floor
    const outerR = cylRadius + 1;
    const cutDepth = through ? cylRadius + 1 : (depth ?? cylRadius);
    const innerR = Math.max(cylRadius - cutDepth, 0.001);

    return this.buildCylindricalWrapSolid(
      cylCenter,
      cylAxisDir,
      refXDir,
      innerR,
      outerR,
      centerAngleDeg,
      axialSize,
      sweepAngleDeg,
      span,
    );
  }

  /**
   * Builds cylindrical wrap solid for the current OpenCascade build.
   */
  private buildCylindricalWrapSolid(
    cylCenter: Vec3,
    cylAxisDir: Vec3,
    refXDir: Vec3,
    innerRadius: number,
    outerRadius: number,
    centerAngleDeg: number,
    axialSize: number,
    sweepAngleDeg: number,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const h = axialSize;
    const Ri = innerRadius;
    const Ro = outerRadius;
    const clampedSweep = Math.max(
      0.1,
      Math.min(Math.abs(sweepAngleDeg), 359.9),
    );
    const sweepRad = (clampedSweep * Math.PI) / 180;

    // Rectangular profile in canonical XZ half-plane (axis=Z, ref=X):
    // radially Ri→Ro, axially -h/2→+h/2
    const pts: [number, number, number][] = [
      [Ri, 0, -h / 2],
      [Ro, 0, -h / 2],
      [Ro, 0, h / 2],
      [Ri, 0, h / 2],
    ];

    const wb = new oc.BRepBuilderAPI_MakeWire_1();
    const ptHandles = pts.map(([x, y, z]) => new oc.gp_Pnt_3(x, y, z));
    const edgeHandles: OC[] = [];
    for (let i = 0; i < 4; i++) {
      const e = new oc.BRepBuilderAPI_MakeEdge_3(
        ptHandles[i],
        ptHandles[(i + 1) % 4],
      ).Edge();
      wb.Add_1(e);
      edgeHandles.push(e);
    }
    const profileWire = wb.Wire();
    [...ptHandles, ...edgeHandles].forEach((o: OC) => {
      try {
        o?.delete?.();
      } catch {
        /* empty */
      }
    });
    wb.delete();

    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(profileWire, false);
    if (!faceMaker.IsDone()) throw occtError('Wrap: profile face failed', span);
    const profileFace = faceMaker.Face();
    faceMaker.delete();
    profileWire.delete();

    // Revolve profile around canonical Z by sweepRad
    const zOrig = new oc.gp_Pnt_3(0, 0, 0);
    const zDirObj = new oc.gp_Dir_4(0, 0, 1);
    const revolveAx1 = new oc.gp_Ax1_2(zOrig, zDirObj);
    const revol = new oc.BRepPrimAPI_MakeRevol_1(
      profileFace,
      revolveAx1,
      sweepRad,
      false,
    );
    if (!revol.IsDone()) throw occtError('Wrap: revolve failed', span);
    let shape = revol.Shape();
    profileFace.delete();
    zOrig.delete();
    zDirObj.delete();
    revolveAx1.delete();
    revol.delete();

    // Rotate shape in canonical space so it is centered at centerAngleDeg
    const startAngleDeg = centerAngleDeg - clampedSweep / 2;
    if (Math.abs(startAngleDeg) > 0.001) {
      shape = this.rotateShape(shape, [0, 0, 0], [0, 0, 1], startAngleDeg);
    }

    // SetDisplacement from canonical (origin=[0,0,0], Z=[0,0,1], X=[1,0,0])
    // to actual cylinder frame (origin=cylCenter, Z=cylAxisDir, X=refXDir)
    const [cx, cy, cz] = cylCenter;
    const [dax, day, daz] = cylAxisDir;
    const [rx, ry, rz] = refXDir;

    const srcOrig = new oc.gp_Pnt_3(0, 0, 0);
    const srcZ = new oc.gp_Dir_4(0, 0, 1);
    const srcX = new oc.gp_Dir_4(1, 0, 0);
    const srcAx3 = new oc.gp_Ax3_3(srcOrig, srcZ, srcX);

    const trgOrig = new oc.gp_Pnt_3(cx, cy, cz);
    const trgZ = new oc.gp_Dir_4(dax, day, daz);
    const trgX = new oc.gp_Dir_4(rx, ry, rz);
    const trgAx3 = new oc.gp_Ax3_3(trgOrig, trgZ, trgX);

    const trsf = new oc.gp_Trsf_1();
    trsf.SetDisplacement(srcAx3, trgAx3);
    const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
    shape.delete?.();
    [srcOrig, srcZ, srcX, srcAx3, trgOrig, trgZ, trgX, trgAx3, trsf].forEach(
      (o: OC) => {
        try {
          o?.delete?.();
        } catch {
          /* empty */
        }
      },
    );

    return moved;
  }

  /**
   * Builds rotate operation for the current OpenCascade build.
   */
  private buildRotateOperation(state: GroupBuildState, op: IRRotate): void {
    const deferredComponent = state.partSolidOwner
      ? state.partSolidAliasComponents.get(op.target)
      : undefined;
    if (
      deferredComponent &&
      deferredComponent !== state.partSolidOwner &&
      state.partSolidComponents.has(deferredComponent)
    ) {
      this.rotateDeferredPartComponent(state, op, deferredComponent);
      return;
    }

    const owner = this.ownerFor(state, op.target);
    const shape =
      state.labelMap.getShape(owner) ?? state.labelMap.getShape(op.target);
    if (!shape)
      throw occtError(`Unknown object '${op.target}' for rotate`, op.span);

    const rotated = this.rotateShapeForOperation(state, op, shape);
    state.bodyFrames.set(
      owner,
      rotateFrame(
        state.bodyFrames.get(owner) ?? workplaneFrame(state.defaultWorkplane),
        rotated.axis.dir,
        op.angleDeg,
      ),
    );
    this.replaceBody(state, owner, rotated.shape);
  }

  /**
   * Applies an IR rotate op to a shape and returns the resolved axis.
   * Callers need the same axis for both the OCCT shape transform and the
   * source-frame update that keeps later face labels aligned.
   */
  private rotateShapeForOperation(
    state: GroupBuildState,
    op: IRRotate,
    shape: OC,
  ): { shape: OC; axis: { point: Vec3; dir: Vec3 } } {
    const axis = this.rotationAxis(state, op);
    return {
      shape: this.rotateShape(shape, axis.point, axis.dir, op.angleDeg),
      axis,
    };
  }

  /**
   * Rotates one source component inside an explicit part.
   * M39 defers explicit-part additive bodies as separate components until final
   * output. Source names still point at the part owner, so rotating via owner
   * lookup would rotate or collapse the whole part instead of the requested
   * placed feature.
   */
  private rotateDeferredPartComponent(
    state: GroupBuildState,
    op: IRRotate,
    component: string,
  ): void {
    const shape = state.partSolidComponents.get(component);
    if (!shape)
      throw occtError(`Unknown object '${op.target}' for rotate`, op.span);

    const rotated = this.rotateShapeForOperation(state, op, shape);
    const frame =
      state.bodyFrames.get(component) ??
      state.bodyFrames.get(op.target) ??
      workplaneFrame(state.defaultWorkplane);
    const rotatedFrame = rotateFrame(frame, rotated.axis.dir, op.angleDeg);
    state.bodyFrames.set(component, rotatedFrame);
    for (const [alias, aliasComponent] of state.partSolidAliasComponents) {
      if (aliasComponent === component)
        state.bodyFrames.set(alias, rotatedFrame);
    }
    this.replaceDeferredPartComponent(state, op.target, rotated.shape);
  }

  /**
   * Coordinates rotation axis as part of the OpenCascade build pipeline.
   */
  private rotationAxis(
    state: GroupBuildState,
    op: IRRotate,
  ): { point: Vec3; dir: Vec3 } {
    if (typeof op.around === 'string') {
      return {
        point: [0, 0, 0],
        dir: cardinalAxis(op.around),
      };
    }
    const ax2 = state.labelMap.resolveAxis(this.oc, op.around);
    return axisPointAndDirection(ax2);
  }

  /**
   * Resolves the source shape, body frame, and material for a pattern/mirror
   * operation, throwing a contextual error when the object is unknown.
   */
  private resolvePatternSource(
    state: GroupBuildState,
    objName: string,
    span: SourceSpan,
    context: string,
  ) {
    const shape = state.labelMap.getShape(objName);
    if (!shape)
      throw occtError(`Unknown object '${objName}' for ${context}`, span);
    const frame =
      state.bodyFrames.get(objName) ?? workplaneFrame(state.defaultWorkplane);
    const material = state.bodyMaterials.get(objName) ?? null;
    return { shape, frame, material };
  }

  /**
   * Builds pattern linear operation for the current OpenCascade build.
   */
  private buildPatternLinearOperation(
    state: GroupBuildState,
    op: IRPatternLinear,
  ): void {
    const { shape, frame, material } = this.resolvePatternSource(
      state,
      op.objName,
      op.span,
      'pattern',
    );
    const oc = this.oc;
    for (let i = 0; i < op.countX; i++) {
      for (let j = 0; j < op.countY; j++) {
        if (i === 0 && j === 0) continue;
        const dx = i * op.spacingX;
        const dy = j * op.spacingY;
        const trsf = new oc.gp_Trsf_1();
        const vec = new oc.gp_Vec_4(dx, dy, 0);
        trsf.SetTranslation_1(vec);
        const copy = new oc.BRepBuilderAPI_Transform_2(
          shape,
          trsf,
          true,
        ).Shape();
        vec.delete();
        trsf.delete();
        const copyName = `${op.objName}__p${i}_${j}`;
        this.addBody(state, copyName, copy, frame, material, op.span);
      }
    }
  }

  /**
   * Builds pattern radial operation for the current OpenCascade build.
   */
  private buildPatternRadialOperation(
    state: GroupBuildState,
    op: IRPatternRadial,
  ): void {
    const { shape, frame, material } = this.resolvePatternSource(
      state,
      op.objName,
      op.span,
      'radial pattern',
    );
    const ax2 = state.labelMap.resolveAxis(this.oc, { faceRef: op.aroundRef });
    const { point: axisPoint, dir: axisDir } = axisPointAndDirection(ax2);
    const angleStep = 360 / op.count;
    for (let i = 1; i < op.count; i++) {
      const angleDeg = i * angleStep;
      const copy = this.rotateShapeCopy(shape, axisPoint, axisDir, angleDeg);
      const copyName = `${op.objName}__r${i}`;
      const copyFrame = rotateFrame(frame, axisDir, angleDeg);
      this.addBody(state, copyName, copy, copyFrame, material, op.span);
    }
  }

  /**
   * Builds mirror operation for the current OpenCascade build.
   */
  private buildMirrorOperation(state: GroupBuildState, op: IRMirror): void {
    const { shape, frame, material } = this.resolvePatternSource(
      state,
      op.objName,
      op.span,
      'mirror',
    );
    const oc = this.oc;
    const trsf = new oc.gp_Trsf_1();
    const mirrorAx2 = this.resolveMirrorPlane(state, op.across, op.objName);
    trsf.SetMirror_3(mirrorAx2);
    const copy = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
    trsf.delete();
    const mirrorName = `${op.objName}__m`;
    this.addBody(state, mirrorName, copy, frame, material, op.span);
  }

  /**
   * Resolves mirror plane for the current OpenCascade build.
   */
  private resolveMirrorPlane(
    state: GroupBuildState,
    plane: IRMirrorPlane,
    objName: string,
  ): OC {
    const oc = this.oc;
    if (plane.kind === 'world') {
      const origin = new oc.gp_Pnt_3(0, 0, 0);
      let normal: OC;
      if (plane.axis === 'x') normal = new oc.gp_Dir_4(1, 0, 0);
      else if (plane.axis === 'y') normal = new oc.gp_Dir_4(0, 1, 0);
      else normal = new oc.gp_Dir_4(0, 0, 1);
      const ax2 = new oc.gp_Ax2_3(origin, normal);
      origin.delete();
      normal.delete();
      return ax2;
    }
    if (plane.kind === 'faceRef') {
      return state.labelMap.resolveAxis(oc, { faceRef: plane.ref });
    }
    // 'named' — use AABB centroid of the target object as mirror plane origin
    const shape = state.labelMap.getShape(objName);
    const bounds = shape ? readBounds(oc, shape) : null;
    const cx = bounds ? (bounds.xMin.current + bounds.xMax.current) / 2 : 0;
    const cy = bounds ? (bounds.yMin.current + bounds.yMax.current) / 2 : 0;
    const cz = bounds ? (bounds.zMin.current + bounds.zMax.current) / 2 : 0;
    const origin = new oc.gp_Pnt_3(cx, cy, cz);
    const normal = new oc.gp_Dir_4(0, 0, 1);
    const ax2 = new oc.gp_Ax2_3(origin, normal);
    origin.delete();
    normal.delete();
    return ax2;
  }

  /**
   * Builds transform operation for the current OpenCascade build.
   */
  private buildTransformOperation(
    state: GroupBuildState,
    op: IRTransform,
  ): void {
    const shape = state.labelMap.getShape(op.objName);
    if (!shape)
      throw occtError(`Unknown object '${op.objName}' for transform`, op.span);
    const oc = this.oc;
    let result: OC;
    if (op.operation.kind === 'translate') {
      result = this.translateShape(
        shape,
        op.operation.x,
        op.operation.y,
        op.operation.z,
      );
    } else if (op.operation.kind === 'rotate') {
      const around = op.operation.around;
      const axis =
        typeof around === 'string'
          ? {
              point: [0, 0, 0] as [number, number, number],
              dir: cardinalAxis(around),
            }
          : axisPointAndDirection(state.labelMap.resolveAxis(oc, around));
      result = this.rotateShape(
        shape,
        axis.point,
        axis.dir,
        op.operation.angleDeg,
      );
      const frame = state.bodyFrames.get(op.objName);
      if (frame) {
        state.bodyFrames.set(
          op.objName,
          rotateFrame(frame, axis.dir, op.operation.angleDeg),
        );
      }
    } else {
      const trsf = new oc.gp_Trsf_1();
      trsf.SetScaleFactor(op.operation.factor);
      result = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
      trsf.delete();
    }
    if (
      replaceDeferredPartComponent(
        state,
        op.objName,
        result,
        (buildState, alias, aliasShape) =>
          this.registerPartSolidAliasComponent(buildState, alias, aliasShape),
      )
    ) {
      return;
    }
    this.replaceBody(state, op.objName, result);
  }

  /**
   * Coordinates owner for as part of the OpenCascade build pipeline.
   */
  private ownerFor(state: GroupBuildState, name: string): string {
    return state.bodyOwners.get(name) ?? name;
  }

  /**
   * Registers body aliases for the current OpenCascade build.
   */
  private registerBodyAliases(
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

  /**
   * Registers every source name in a unified part against the current fused
   * solid.
   * M39 keeps one coherent part topology, but source-level refs such as
   * `base.top` and `boss.top` must continue to resolve after each fuse/cut.
   */
  private registerPartSolidAliases(state: GroupBuildState, shape: OC): void {
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

  /**
   * Registers one explicit-part alias against its current deferred component.
   * Before modifiers or output force a full fuse, source refs still need to
   * resolve against the latest component topology, including cuts.
   */
  private registerPartSolidAliasComponent(
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

  /**
   * Registers part solid alias shape for the current OpenCascade build.
   */
  private registerPartSolidAliasShape(
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

  /**
   * Adds body for the current OpenCascade build.
   */
  private addBody(
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

  /**
   * Fuses explicitly named bodies and aliases every fused source to the result.
   * Explicit parts already fuse additive solids by default. This operation
   * remains useful for default-scope geometry and for making user intent clear
   * when a later operation needs several named bodies to share topology.
   */
  private buildFuseOperation(state: GroupBuildState, op: IRFuse): void {
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

  /** Captures a fixed-owner explicit fuse for one native OCCT reduction. */
  private prepareNativeFuseOperation(
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

  /** Applies fused ownership and label aliases only after geometry succeeds. */
  private commitFusedOwners(
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

  /**
   * Coordinates fuse owner shapes as part of the OpenCascade build pipeline.
   */
  private fuseOwnerShapes(
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

  /**
   * Coordinates fused alias sources as part of the OpenCascade build pipeline.
   */
  private fusedAliasSources(
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

  /**
   * Removes duplicate owners for fuse using the supplied shape and operation state.
   */
  private uniqueOwnersForFuse(state: GroupBuildState, op: IRFuse): string[] {
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

  /**
   * Registers fused body aliases for the current OpenCascade build.
   */
  private registerFusedBodyAliases(
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

  /**
   * Adds a generated solid into the running part solid.
   * Fillets need to see one coherent topology across all additive features in
   * a part, so later additions are fused immediately instead of compounded at
   * final mesh time.
   */
  private addBodyToPartSolid(
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

  /**
   * Replaces body for the current OpenCascade build.
   */
  private replaceBody(state: GroupBuildState, name: string, shape: OC): void {
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

  /**
   * Coordinates alias body as part of the OpenCascade build pipeline.
   */
  private aliasBody(
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

  /**
   * Coordinates alias part solid body as part of the OpenCascade build pipeline.
   */
  private aliasPartSolidBody(
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

  /**
   * Copies part solid alias shape for the current OpenCascade build.
   */
  private copyPartSolidAliasShape(
    state: GroupBuildState,
    alias: string,
    target: string,
  ): void {
    const regionShape = state.partSolidAliasShapes.get(target);
    if (regionShape && !state.partSolidAliasShapes.has(alias)) {
      state.partSolidAliasShapes.set(alias, regionShape);
    }
  }

  /**
   * Copies part solid alias attachment plane for the current OpenCascade build.
   */
  private copyPartSolidAliasAttachmentPlane(
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

  /**
   * Applies modifiers with trace for the current OpenCascade build.
   */
  private flushModifiersWithTrace(
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

  /**
   * Applies modifiers for the current OpenCascade build.
   */
  private flushModifiers(state: GroupBuildState): void {
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

  /**
   * Applies split part modifier phase for the current OpenCascade build.
   */
  private applySplitPartModifierPhase(
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

  /**
   * Applies flushed modifier phase for the current OpenCascade build.
   */
  private applyFlushedModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
  ): void {
    this.flushPartSolid(state, ops[0]?.span);
    this.applyFusedModifierPhase(state, ops);
  }

  /**
   * Applies deferred part modifier phase for the current OpenCascade build.
   */
  private applyDeferredPartModifierPhase(
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

  /**
   * Applies fused modifier phase for the current OpenCascade build.
   */
  private applyFusedModifierPhase(
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

  /**
   * Replaces deferred part component for the current OpenCascade build.
   */
  private replaceDeferredPartComponent(
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

  /**
   * Finalizes group build for the current OpenCascade build.
   */
  private finalizeGroupBuild(
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

  // Sketch building

  /**
   * Builds surface data for material shapes using the supplied shape and operation state.
   */
  private surfaceMaterialShapes(state: GroupBuildState): BuiltMaterialShape[] {
    return [...state.surfaceShapes].map(([name, shape]) => ({
      shape,
      bodyName: name,
      material: state.surfaceMaterials.get(name) ?? null,
      isOpenSurface: true,
    }));
  }

  /**
   * Finalizes empty group for the current OpenCascade build.
   */
  private finalizeEmptyGroup(
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

  /**
   * Registers named part group for the current OpenCascade build.
   */
  private registerNamedPartGroup(
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

  /**
   * Coordinates final body shapes as part of the OpenCascade build pipeline.
   */
  private finalBodyShapes(state: GroupBuildState): Map<string, OC> {
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

  /**
   * Builds sketch face for the current OpenCascade build.
   */
  private buildSketchFace(prim: IRPrimitive, span: SourceSpan): OC {
    if (prim.kind === 'sketchAlias') {
      return this.buildSketchFace(prim.primitive, span);
    }
    if (prim.kind === 'word')
      return this.buildWordShape(
        prim.text,
        prim.size,
        prim.font,
        prim.align,
        span,
      );
    if (prim.kind === 'sketchAt') {
      const face = this.buildSketchFace(prim.primitive, span);
      return this.translateSketchShape(face, prim.x, prim.y);
    }
    if (prim.kind === 'sketchBoolean') {
      const left = this.buildSketchFace(prim.left, span);
      const right = this.buildSketchFace(prim.right, span);
      return prim.op === 'add'
        ? applyStableBoolFuse(this.oc, left, right, span, 'Sketch union failed')
        : this.applyBoolCut(left, right, span);
    }
    if (prim.kind === 'sketchRef') {
      throw occtError(`Unresolved sketch reference '${prim.name}'`, span);
    }
    // Composite wrappers recurse here, so closed profiles still need their
    // multi-loop face builder rather than one disconnected wire.
    if (prim.kind === 'profile' && profileSegmentsAreClosed(prim.segments)) {
      return buildProfileFaceForPrimitive(this.oc, prim, span);
    }

    const wire = this.buildWire(prim, span);
    return this.buildFaceFromWire(wire, prim.kind, span);
  }

  /**
   * Checks whether the supplied value meets the composite sketch condition.
   */
  private isCompositeSketch(prim: IRPrimitive): boolean {
    if (prim.kind === 'sketchAlias') {
      return this.isCompositeSketch(prim.primitive);
    }
    return prim.kind === 'sketchAt' || prim.kind === 'sketchBoolean';
  }

  /**
   * Builds face from wire for the current OpenCascade build.
   */
  private buildFaceFromWire(wire: OC, kind: string, span: SourceSpan): OC {
    const oc = this.oc;
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
    if (!faceMaker.IsDone())
      throw occtError(`Face build failed for ${kind}`, span);
    const face = faceMaker.Face();
    faceMaker.delete();
    return face;
  }

  /**
   * Coordinates position face as part of the OpenCascade build pipeline.
   */
  private positionFace(face: OC, ax2: OC): OC {
    return transformToAxis(this.oc, face, ax2);
  }

  /**
   * Translates sketch shape for the current OpenCascade build.
   */
  private translateSketchShape(shape: OC, x: number, y: number): OC {
    const oc = this.oc;
    const trsf = new oc.gp_Trsf_1();
    const vec = new oc.gp_Vec_4(x, y, 0);
    trsf.SetTranslation_1(vec);
    const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
    vec.delete();
    trsf.delete();
    return moved;
  }

  /**
   * Rotates `shape` about an axis. `copy` selects whether OCCT duplicates the
   * shape (true) or transforms it in place (false).
   */
  private applyRotation(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
    copy: boolean,
  ): OC {
    const oc = this.oc;
    const trsf = new oc.gp_Trsf_1();
    const pnt = new oc.gp_Pnt_3(point[0], point[1], point[2]);
    const axisDir = new oc.gp_Dir_4(dir[0], dir[1], dir[2]);
    const axis = new oc.gp_Ax1_2(pnt, axisDir);
    const setRotation = trsf.SetRotation_1 ?? trsf.SetRotation;
    if (typeof setRotation !== 'function') {
      throw new Error('gp_Trsf rotation API is unavailable');
    }
    setRotation.call(trsf, axis, (angleDeg * Math.PI) / 180);
    const rotated = new oc.BRepBuilderAPI_Transform_2(
      shape,
      trsf,
      copy,
    ).Shape();
    axis.delete?.();
    axisDir.delete();
    pnt.delete();
    trsf.delete();
    return rotated;
  }

  /**
   * Rotates shape copy for the current OpenCascade build.
   */
  private rotateShapeCopy(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
  ): OC {
    return this.applyRotation(shape, point, dir, angleDeg, true);
  }

  /**
   * Rotates shape for the current OpenCascade build.
   */
  private rotateShape(shape: OC, point: Vec3, dir: Vec3, angleDeg: number): OC {
    return this.applyRotation(shape, point, dir, angleDeg, false);
  }

  /**
   * Builds wire for the current OpenCascade build.
   */
  private buildWire(prim: IRPrimitive, span: SourceSpan): OC {
    if (prim.kind === 'sketchAlias') {
      return this.buildWire(prim.primitive, span);
    }
    const builder = this.wirePrimitiveBuilders()[prim.kind];
    if (builder) return builder(prim);
    throw this.unsupportedWirePrimitiveError(prim, span);
  }

  /**
   * Coordinates wire primitive builders as part of the OpenCascade build pipeline.
   */
  private wirePrimitiveBuilders(): Partial<
    Record<IRPrimitive['kind'], (prim: IRPrimitive) => OC>
  > {
    return {
      rect: (prim) => {
        const rect = prim as Extract<IRPrimitive, { kind: 'rect' }>;
        return this.buildRect(rect.width, rect.height);
      },
      circle: (prim) => {
        const circle = prim as Extract<IRPrimitive, { kind: 'circle' }>;
        return this.buildCircle(circle.diameter / 2);
      },
      ellipse: (prim) => {
        const ellipse = prim as Extract<IRPrimitive, { kind: 'ellipse' }>;
        return buildXYEllipseWire(this.oc, ellipse.width, ellipse.height);
      },
      roundrect: (prim) => {
        const roundrect = prim as Extract<IRPrimitive, { kind: 'roundrect' }>;
        return this.buildRoundRect(
          roundrect.width,
          roundrect.height,
          roundrect.radius,
        );
      },
      triangle: (prim) => {
        const triangle = prim as Extract<IRPrimitive, { kind: 'triangle' }>;
        return this.buildTriangle(triangle.base, triangle.height);
      },
      polygon: (prim) => {
        const polygon = prim as Extract<IRPrimitive, { kind: 'polygon' }>;
        return this.buildPolygon(polygon.points);
      },
      profile: (prim) => {
        const profile = prim as Extract<IRPrimitive, { kind: 'profile' }>;
        return this.buildProfileWire(profile.segments);
      },
    };
  }

  /**
   * Coordinates unsupported wire primitive error as part of the OpenCascade build pipeline.
   */
  private unsupportedWirePrimitiveError(
    prim: IRPrimitive,
    span: SourceSpan,
  ): OcctError {
    if (prim.kind === 'word') {
      return occtError('Word sketch must be built as a compound shape', span);
    }
    if (prim.kind === 'sketchRef') {
      return occtError(`Unresolved sketch reference '${prim.name}'`, span);
    }
    return occtError(
      'Composite sketch does not expose a single source wire',
      span,
    );
  }

  /**
   * Builds profile wire for the current OpenCascade build.
   */
  private buildProfileWire(segments: IRProfileSegment[]): OC {
    return buildProfileWireFromSegments(this.oc, segments);
  }

  /**
   * Builds rect for the current OpenCascade build.
   */
  private buildRect(w: number, h: number): OC {
    return this.buildRectAt(w, h, 0, 0);
  }

  /**
   * Builds rect at for the current OpenCascade build.
   */
  private buildRectAt(w: number, h: number, cx: number, cy: number): OC {
    const hw = w / 2,
      hh = h / 2;
    return this.buildClosedPolylineWire([
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ]);
  }

  /**
   * Builds circle for the current OpenCascade build.
   */
  private buildCircle(radius: number): OC {
    const oc = this.oc;
    const { origin, zDir, xDir, ax2, circ } = this.makeXYCircle(0, 0, radius);
    const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ).Edge();
    const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
    [origin, zDir, xDir, ax2, circ, edge].forEach((o: OC) => o.delete());
    return wire;
  }

  /**
   * Builds round rect for the current OpenCascade build.
   */
  private buildRoundRect(w: number, h: number, r: number): OC {
    const oc = this.oc;
    const hw = w / 2,
      hh = h / 2;
    const radius = Math.min(Math.max(r, 0), hw, hh);
    if (radius <= 1e-9) return this.buildRect(w, h);

    // Corner centers: [cx, cy, startAngle, endAngle (CCW)]
    const corners: [number, number, number, number][] = [
      [-hw + radius, -hh + radius, 180, 270], // bottom-left
      [hw - radius, -hh + radius, 270, 360], // bottom-right
      [hw - radius, hh - radius, 0, 90], // top-right
      [-hw + radius, hh - radius, 90, 180], // top-left
    ];
    const wb = new oc.BRepBuilderAPI_MakeWire_1();
    const edges: OC[] = [];

    for (let i = 0; i < 4; i++) {
      const [cx, cy, a0, a1] = corners[i];
      const [ncx, ncy, nextA0] = corners[(i + 1) % 4];

      // Arc at corner i
      const arcEdge = this.buildArcEdge(cx, cy, radius, a0, a1);
      wb.Add_1(arcEdge);
      edges.push(arcEdge);

      // Straight edge to next corner arc start
      const exit = arcPoint(cx, cy, radius, a1);
      const entry = arcPoint(ncx, ncy, radius, nextA0);
      if (pointsDiffer(exit, entry)) {
        const exitPt = new oc.gp_Pnt_3(...exit);
        const entryPt = new oc.gp_Pnt_3(...entry);
        const linEdge = new oc.BRepBuilderAPI_MakeEdge_3(
          exitPt,
          entryPt,
        ).Edge();
        wb.Add_1(linEdge);
        edges.push(linEdge);
        [exitPt, entryPt].forEach((o: OC) => o.delete());
      }
    }

    const wire = wb.Wire();
    edges.forEach((o: OC) => o.delete());
    wb.delete();
    return wire;
  }

  /**
   * Builds arc edge for the current OpenCascade build.
   */
  private buildArcEdge(
    cx: number,
    cy: number,
    r: number,
    a0deg: number,
    a1deg: number,
  ): OC {
    const oc = this.oc;
    const { origin, zDir, xDir, ax2, circ } = this.makeXYCircle(cx, cy, r);
    const a0 = (a0deg * Math.PI) / 180;
    const a1 = (a1deg * Math.PI) / 180;
    const edge = new oc.BRepBuilderAPI_MakeEdge_9(circ, a0, a1).Edge();
    [origin, zDir, xDir, ax2, circ].forEach((o: OC) => o.delete());
    return edge;
  }

  /**
   * Builds triangle for the current OpenCascade build.
   */
  private buildTriangle(base: number, height: number): OC {
    return this.buildClosedPolylineWire([
      [-base / 2, 0],
      [base / 2, 0],
      [0, height],
    ]);
  }

  /**
   * Builds polygon for the current OpenCascade build.
   */
  private buildPolygon(points: [number, number][]): OC {
    return this.buildClosedPolylineWire(points);
  }

  /**
   * Builds closed polyline wire for the current OpenCascade build.
   */
  private buildClosedPolylineWire(
    points: readonly (readonly [number, number])[],
  ): OC {
    const oc = this.oc;
    const wb = new oc.BRepBuilderAPI_MakeWire_1();
    const pointHandles = points.map(([x, y]) => new oc.gp_Pnt_3(x, y, 0));
    const edgeHandles: OC[] = [];
    for (let i = 0; i < pointHandles.length; i++) {
      const edge = new oc.BRepBuilderAPI_MakeEdge_3(
        pointHandles[i],
        pointHandles[(i + 1) % pointHandles.length],
      ).Edge();
      wb.Add_1(edge);
      edgeHandles.push(edge);
    }
    const wire = wb.Wire();
    [...pointHandles, ...edgeHandles].forEach((o: OC) => o.delete());
    wb.delete();
    return wire;
  }

  /**
   * Creates xy circle for the current OpenCascade build.
   */
  private makeXYCircle(
    cx: number,
    cy: number,
    radius: number,
  ): { origin: OC; zDir: OC; xDir: OC; ax2: OC; circ: OC } {
    return makeXYCircleHandles(this.oc, cx, cy, radius);
  }

  /**
   * Builds word shape for the current OpenCascade build.
   */
  private buildWordShape(
    text: string,
    size: number,
    fontName: IRFontRef,
    align: 'center' | 'left' | 'right',
    span: SourceSpan,
  ): OC {
    if (text.length === 0) return this.buildEmptyWordMarker(size);

    const attempts = this.fontAttempts(fontName);
    const failures: string[] = [];
    for (const attempt of attempts) {
      const font = new this.oc.StdPrs_BRepFont_1();
      const fontString = this.ocUtf8String(attempt.value);
      try {
        const loaded =
          attempt.kind === 'path'
            ? font.Init_1(fontString, size, 0)
            : font.Init_2(fontString, FONT_ASPECT_REGULAR, size);
        if (!loaded) {
          failures.push(`${attempt.label}: unavailable`);
          continue;
        }

        const shape = this.performBRepText(text, font, align);
        if (!isNullShape(shape)) return shape;
        failures.push(`${attempt.label}: empty text shape`);
        shape?.delete?.();
      } catch (err) {
        failures.push(`${attempt.label}: ${rawErrorMessage(err)}`);
      } finally {
        fontString.delete();
        font.delete();
      }
    }

    if (typeof fontName !== 'string') {
      throw occtError(
        `Unable to build word sketch with imported font '${fontName.name}' from '${fontName.sourcePath}' (${failures.join('; ')})`,
        span,
      );
    }

    throw occtError(
      `Unable to build word sketch with font '${fontName}' or bundled fallback font (${failures.join('; ')})`,
      span,
    );
  }

  /**
   * Coordinates font attempts as part of the OpenCascade build pipeline.
   */
  private fontAttempts(
    fontName: IRFontRef,
  ): { kind: 'name' | 'path'; value: string; label: string }[] {
    if (typeof fontName !== 'string') {
      return [
        {
          kind: 'path',
          value: fontName.fsPath,
          label: `imported:${fontName.name}`,
        },
      ];
    }

    const requested = fontName.trim() || 'sans';
    const bundledPath = BUNDLED_FONT_PATH_BY_NAME[requested.toLowerCase()];
    if (bundledPath) {
      return [{ kind: 'path', value: bundledPath, label: requested }];
    }

    const attempts: { kind: 'name' | 'path'; value: string; label: string }[] =
      [{ kind: 'name', value: requested, label: requested }];
    const seen = new Set([requested.toLowerCase()]);
    const aliases = FONT_ALIAS_NAMES[requested.toLowerCase()] ?? [];
    for (const alias of aliases) {
      const key = alias.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      attempts.push({ kind: 'name', value: alias, label: alias });
    }
    attempts.push({
      kind: 'path',
      value: OCCT_FALLBACK_FONT_PATH,
      label: OCCT_FALLBACK_FONT_PATH,
    });
    return attempts;
  }

  /**
   * Coordinates perform b rep text as part of the OpenCascade build pipeline.
   */
  private performBRepText(
    text: string,
    font: OC,
    align: 'center' | 'left' | 'right',
  ): OC {
    const oc = this.oc;
    const textString = this.ocUtf8String(text);
    const origin = new oc.gp_Pnt_3(0, 0, 0);
    const normal = new oc.gp_Dir_4(0, 0, 1);
    const xDir = new oc.gp_Dir_4(1, 0, 0);
    const pen = new oc.gp_Ax3_3(origin, normal, xDir);
    const builder = new oc.StdPrs_BRepTextBuilder();
    try {
      return builder.Perform_2(
        font,
        textString,
        pen,
        horizontalTextAlignment(oc, align),
        verticalTextAlignmentCenter(oc),
      );
    } finally {
      builder.delete();
      textString.delete();
      pen.delete();
      origin.delete();
      normal.delete();
      xDir.delete();
    }
  }

  /**
   * Coordinates oc utf8 string as part of the OpenCascade build pipeline.
   */
  private ocUtf8String(value: string): OC {
    return new this.oc.NCollection_Utf8String_4(value, utf8ByteLength(value));
  }

  /**
   * Builds empty word marker for the current OpenCascade build.
   */
  private buildEmptyWordMarker(size: number): OC {
    const wire = this.buildRect(size * 0.1, size * 0.1);
    const faceMaker = new this.oc.BRepBuilderAPI_MakeFace_15(wire, false);
    const face = faceMaker.Face();
    faceMaker.delete();
    wire.delete();
    return face;
  }

  // Geometry operations

  /**
   * Applies extrude for the current OpenCascade build.
   */
  private applyExtrude(
    face: OC,
    ax2: OC,
    depth: number,
    symmetric: boolean,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const dir = (ax2 as Record<string, () => OC>).Direction();
    const dx = (dir as Record<string, () => number>).X();
    const dy = (dir as Record<string, () => number>).Y();
    const dz = (dir as Record<string, () => number>).Z();

    const vec = new oc.gp_Vec_4(dx * depth, dy * depth, dz * depth);
    let prism: OC | null = null;
    let shape: OC;
    try {
      prism = new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true);
      if (!prism.IsDone()) throw occtError('Extrude failed', span);
      shape = prism.Shape();
    } catch (err) {
      if (isOcctError(err)) throw err;
      throw occtError(
        `OCCT extrude operation failed unexpectedly: ${
          err instanceof Error ? err.message : String(err)
        }`,
        span,
      );
    } finally {
      vec.delete();
      prism?.delete?.();
      (dir as { delete(): void }).delete();
    }

    if (symmetric) {
      const trsf = new oc.gp_Trsf_1();
      const halfVec = new oc.gp_Vec_4(
        (-dx * depth) / 2,
        (-dy * depth) / 2,
        (-dz * depth) / 2,
      );
      trsf.SetTranslation_1(halfVec);
      const loc = new oc.TopLoc_Location_2(trsf);
      shape = (shape as OC).Located(loc);
      [trsf, halfVec, loc].forEach((o: OC) => o.delete());
    }

    return shape;
  }

  /**
   * Builds cut tool for the current OpenCascade build.
   */
  private buildCutTool(
    sketchFace: OC,
    ax2: OC,
    targetShape: OC,
    depth: number | null,
    span: SourceSpan,
  ): OC {
    const cutDepth =
      depth !== null ? depth : this.shapeDiagonal(targetShape) * 2 + 10;
    const signedDepth = this.cutDepthTowardShape(ax2, targetShape, cutDepth);
    return this.applyExtrude(sketchFace, ax2, signedDepth, false, span);
  }

  /**
   * Coordinates cut depth toward shape as part of the OpenCascade build pipeline.
   */
  private cutDepthTowardShape(ax2: OC, targetShape: OC, depth: number): number {
    const axis = ax2 as Record<string, () => OC>;
    const loc = axis.Location() as Record<string, () => number> & {
      delete(): void;
    };
    const dir = axis.Direction() as Record<string, () => number> & {
      delete(): void;
    };

    const [cx, cy, cz] = this.shapeCenter(targetShape);
    const toCenterX = cx - loc.X();
    const toCenterY = cy - loc.Y();
    const toCenterZ = cz - loc.Z();
    const dot = dir.X() * toCenterX + dir.Y() * toCenterY + dir.Z() * toCenterZ;

    loc.delete();
    dir.delete();

    return dot < 0 ? -depth : depth;
  }

  /**
   * Returns the center of a shape's bounding box.
   */
  private shapeCenter(shape: OC): Vec3 {
    const { xMin, xMax, yMin, yMax, zMin, zMax } = readBounds(this.oc, shape);
    return [
      (xMin.current + xMax.current) / 2,
      (yMin.current + yMax.current) / 2,
      (zMin.current + zMax.current) / 2,
    ];
  }

  /**
   * Returns shape data for diagonal using the supplied shape and operation state.
   */
  private shapeDiagonal(shape: OC): number {
    const { xMin, xMax, yMin, yMax, zMin, zMax } = readBounds(this.oc, shape);
    const dx = xMax.current - xMin.current;
    const dy = yMax.current - yMin.current;
    const dz = zMax.current - zMin.current;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Applies bool cut for the current OpenCascade build.
   */
  private applyBoolCut(target: OC, tool: OC, span: SourceSpan): OC {
    return applyStableBoolCut(this.oc, target, tool, span);
  }

  /** Confirms the runtime still has the compiler-proven single target revision. */
  private canStartNativeBatch(
    state: GroupBuildState,
    targetName: string,
  ): boolean {
    if (
      !nativeParallelBooleanCapability(this.oc) ||
      !state.partSolidOwner ||
      state.partSolidComponents.size !== 1
    )
      return false;
    return this.nativeBatchTargetShape(state, targetName) !== undefined;
  }

  /** Confirms that explicit fuses can use the native parallel builder. */
  private canStartNativeExplicitFuse(): boolean {
    return nativeParallelBooleanCapability(this.oc);
  }

  /**
   * Coordinates native batch target shape as part of the OpenCascade build pipeline.
   */
  private nativeBatchTargetShape(
    state: GroupBuildState,
    targetName: string,
  ): OC | undefined {
    const component = state.partSolidAliasComponents.get(targetName);
    return component ? state.partSolidComponents.get(component) : undefined;
  }

  /**
   * Checks whether the supplied value meets the finalize deferred part as compound condition.
   */
  private canFinalizeDeferredPartAsCompound(state: GroupBuildState): boolean {
    return Boolean(
      state.partSolidOwner &&
      (state.partSolidComponents.size > 2 ||
        state.preservedPartComponents.size > 0),
    );
  }

  /**
   * Coordinates final renderable shapes as part of the OpenCascade build pipeline.
   */
  private finalRenderableShapes(state: GroupBuildState): Map<string, OC> {
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

  /**
   * Applies part solid for the current OpenCascade build.
   */
  private flushPartSolid(
    state: GroupBuildState,
    span: SourceSpan = { file: '(occt)', line: 1, col: 1 },
  ): OC | null {
    return flushDeferredPartSolid(
      state,
      span,
      (a, b, fuseSpan, failureMessage) =>
        this.applyBoolFuse(a, b, fuseSpan, failureMessage),
      (buildState, shape) => this.registerPartSolidAliases(buildState, shape),
    );
  }

  /**
   * Builds compound for the current OpenCascade build.
   */
  private buildCompound(shapes: OC[]): OC {
    const oc = this.oc;
    const compound = new oc.TopoDS_Compound();
    const builder = new oc.BRep_Builder();
    builder.MakeCompound(compound);
    for (const shape of shapes) builder.Add(compound, shape);
    builder.delete();
    return compound;
  }

  /**
   * Applies modifier phase for the current OpenCascade build.
   */
  private applyModifierPhase(
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

  /**
   * Applies draft phase for the current OpenCascade build.
   */
  private applyDraftPhase(
    owner: string,
    ops: IRDraft[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
  ): void {
    const oc = this.oc;
    for (const op of ops) {
      let neutralPlane: OC | null = null;
      try {
        const parsed = parseFaceRef(op.target);
        const shape = labelMap.getShape(parsed.objName);
        if (!shape)
          throw occtError(
            `Unknown object '${parsed.objName}' for draft`,
            op.span,
          );
        const faceHandles = getDraftFaceHandles(labelMap, op.target);
        if (faceHandles.length === 0)
          throw occtError(`No face for draft '${op.target}'`, op.span);
        neutralPlane = this.buildNeutralPlane(oc, shape);
        const result = this.applyDraft(
          shape,
          faceHandles,
          op.angleDeg,
          neutralPlane,
          op.span,
        );
        replaceBody(parsed.objName, result);
      } catch (err) {
        const parsed = parseFaceRef(op.target);
        if (labelMap.hasSourceMemory(parsed.objName)) return;
        if (isOcctError(err)) throw err;
        throw occtError(
          `Draft phase failed for body '${owner}' target '${op.target}': ${rawErrorMessage(err)}`,
          op.span,
        );
      } finally {
        neutralPlane?.delete?.();
      }
    }
  }

  /**
   * Applies blend modifier phase for the current OpenCascade build.
   */
  private applyBlendModifierPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    state: GroupBuildState,
    excludedEdges: unknown[] = [],
  ): EdgeSelection[] {
    if (ops.length === 0) return [];

    const parsed = parseFaceRef(ops[0].target);
    const shape = labelMap.getShape(parsed.objName);
    if (!shape)
      throw occtError(
        `Unknown object '${parsed.objName}' for ${kind}`,
        ops[0].span,
      );

    const expandedSelections = this.collectBlendSelectionsForPhase(
      kind,
      owner,
      ops,
      labelMap,
      replaceBody,
      recordValidation,
      state,
      shape,
      excludedEdges,
    );
    if (expandedSelections.length === 0) return [];

    return this.applyBlendSelectionsForPhase(
      kind,
      owner,
      ops,
      labelMap,
      replaceBody,
      recordValidation,
      shape,
      parsed.objName,
      expandedSelections,
    )
      ? expandedSelections
      : [];
  }

  /**
   * Collects blend selections for phase for the current OpenCascade build.
   */
  private collectBlendSelectionsForPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    state: GroupBuildState,
    shape: OC,
    excludedEdges: unknown[],
  ): EdgeSelection[] {
    try {
      if (
        this.tryApplySolidCutToolBlend(
          kind,
          owner,
          ops,
          labelMap,
          replaceBody,
          state,
        )
      ) {
        return [];
      }

      const selections = this.collectBlendEdgeSelections(
        kind,
        owner,
        ops,
        labelMap,
        state,
        excludedEdges,
        shape,
      );
      if (selections.length === 0) return [];
      const expanded = this.expandBlendSelections(
        kind,
        owner,
        shape,
        selections,
        labelMap,
      );
      this.captureDebugBlendEdges(state, kind, expanded);
      if (kind === 'fillet') this.rejectOversizedFillets(shape, expanded);
      return expanded;
    } catch (err) {
      if (!isOcctError(err)) throw err;
      recordValidation(this.blendFailureValidation(err as OcctError));
      return [];
    }
  }

  /**
   * Routes eligible loft-cut edge blends through their original cutter.
   *
   * Why: the cut's closed rim can split into artificial edges and select the
   * wrong blend side; the source loft retains the exact closed contour.
   */
  private tryApplySolidCutToolBlend(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    state: GroupBuildState,
  ): boolean {
    return applySolidCutToolBlendOperation({
      oc: this.oc,
      kind,
      owner,
      ops,
      labelMap,
      replaceBody,
      state,
      collectSelections: (selectionOwner, selectionOps, selectionLabels) =>
        this.collectBlendEdgeSelections(
          kind,
          selectionOwner,
          selectionOps,
          selectionLabels,
          state,
          [],
        ),
      applyBlendBatch: (
        blendKind,
        targetShape,
        selections,
        targetOwner,
        span,
      ) =>
        this.applyBlendBatch(
          blendKind,
          targetShape,
          selections,
          targetOwner,
          span,
        ),
      applyBoolCut: (target, tool, span) =>
        this.applyBoolCut(target, tool, span),
    });
  }

  /**
   * Expands blend selections for the current OpenCascade build.
   */
  private expandBlendSelections(
    kind: BlendModifierKind,
    owner: string,
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    return kind === 'fillet'
      ? this.expandFilletTangentSelections(owner, shape, selections, labelMap)
      : selections;
  }

  /**
   * Applies blend selections for phase for the current OpenCascade build.
   */
  private applyBlendSelectionsForPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    shape: OC,
    objName: string,
    expandedSelections: EdgeSelection[],
  ): boolean {
    try {
      const result = this.applyBlendBatch(
        kind,
        shape,
        expandedSelections,
        owner,
        ops[0].span,
      );
      replaceBody(objName, result);
      return true;
    } catch (err) {
      return this.retryBlendSelectionsForPhase(
        {
          kind,
          owner,
          ops,
          labelMap,
          replaceBody,
          recordValidation,
          shape,
          objName,
          expandedSelections,
        },
        err,
      );
    }
  }

  /**
   * Retries blend selections for phase for the current OpenCascade build.
   */
  private retryBlendSelectionsForPhase(
    request: BlendRetryRequest,
    err: unknown,
  ): boolean {
    if (!isOcctError(err)) throw err;
    const targetRetry = this.tryBlendByTargetGroups(
      request.kind,
      request.shape,
      request.expandedSelections,
      request.owner,
      request.labelMap,
      request.replaceBody,
      request.objName,
      request.recordValidation,
    );
    if (targetRetry) return true;
    return this.applyConnectedBlendRetry(request, err as OcctError);
  }

  /**
   * Applies connected blend retry for the current OpenCascade build.
   */
  private applyConnectedBlendRetry(
    request: BlendRetryRequest,
    err: OcctError,
  ): boolean {
    try {
      this.applyBlendBatchWithConnectedRetry(
        request.kind,
        request.shape,
        request.expandedSelections,
        request.owner,
        request.labelMap,
        request.ops[0].span,
        (result) => request.replaceBody(request.objName, result),
        err,
      );
      return true;
    } catch (retryErr) {
      if (
        this.canSkipConsumedSourceBlend(
          request.owner,
          request.labelMap,
          request.expandedSelections,
        )
      ) {
        return false;
      }
      if (isOcctError(retryErr)) {
        request.recordValidation(
          this.blendFailureValidation(retryErr as OcctError),
        );
        return false;
      }
      throw retryErr;
    }
  }

  /**
   * Converts a non-fatal blend failure into a validation result.
   * Fillet/chamfer radii can be locally invalid while the rest of the model is
   * still useful. Reporting them as validations keeps the mesh and later blend
   * operations available while preserving the source-mapped error.
   */
  private blendFailureValidation(error: OcctError): ValidationResult {
    return {
      passed: false,
      severity: 'error',
      message: error.message,
      span: error.span,
    };
  }

  /**
   * Emits opt-in preview meshes for blend edge selections.
   * OCCT can accept a blend and return a valid but geometrically wrong result.
   * Rendering the exact pre-blend edge loops makes selector errors visually
   * separable from fillet-builder failures.
   */
  private captureDebugBlendEdges(
    state: GroupBuildState,
    _kind: BlendModifierKind,
    selections: EdgeSelection[],
  ): void {
    const filter = process.env.BUSHSCAD_DEBUG_BLEND_EDGES;
    if (!filter) return;
    for (const selection of selections) {
      const parsed = parseFaceRef(selection.target);
      if (
        filter !== '*' &&
        filter !== selection.target &&
        filter !== parsed.objName
      ) {
        continue;
      }
      const mesh = this.debugClosedPlanarEdgeMesh(selection.edge);
      if (mesh) {
        state.debugBlendEdgeMeshes.push({
          target: selection.target,
          mesh,
        });
      }
    }
  }

  /**
   * Coordinates debug closed planar edge mesh as part of the OpenCascade build pipeline.
   */
  private debugClosedPlanarEdgeMesh(
    edge: unknown,
  ): Omit<MeshData, 'partName' | 'color'> | null {
    let bounds: ReturnType<typeof readBounds>;
    let endpoints: [Vec3, Vec3];
    try {
      bounds = readBounds(this.oc, edge);
      endpoints = readEdgeEndpoints(this.oc, edge);
    } catch {
      return null;
    }
    if (!pointsClose(endpoints[0], endpoints[1], 1e-4)) return null;
    const zSpan = bounds.zMax.current - bounds.zMin.current;
    if (Math.abs(zSpan) > 1e-3) return null;

    const cx = (bounds.xMin.current + bounds.xMax.current) / 2;
    const cy = (bounds.yMin.current + bounds.yMax.current) / 2;
    const cz = (bounds.zMin.current + bounds.zMax.current) / 2;
    const rx = (bounds.xMax.current - bounds.xMin.current) / 2;
    const ry = (bounds.yMax.current - bounds.yMin.current) / 2;
    if (rx <= 1e-6 || ry <= 1e-6) return null;
    const tubeRadius = Math.max(0.25, Math.min(rx, ry) * 0.015);
    return torusMesh(cx, cy, cz, rx, ry, tubeRadius);
  }

  /**
   * Checks whether the supplied value meets the skip consumed source blend condition.
   */
  private canSkipConsumedSourceBlend(
    owner: string,
    labelMap: FaceLabelMap,
    selections: EdgeSelection[],
  ): boolean {
    return (
      selections.length > 0 &&
      selections.every((selection) => {
        if (
          selection.selection?.edgeIntersection ||
          selection.selection?.sketchComponent
        )
          return false;
        const objName = parseFaceRef(selection.target).objName;
        return objName !== owner || labelMap.hasSourceMemory(objName);
      })
    );
  }

  /**
   * Retries a failed blend by source target before graph connectivity.
   * A fused part has one body, but selectors such as `r.top.edges` and
   * `rr.top.edges` still describe independent source features. OCCT can reject
   * a large combined fillet set even when each feature fillets cleanly. If one
   * target still fails, record that target as a validation error and keep later
   * blend targets moving so one bad radius does not suppress unrelated details.
   */
  private tryBlendByTargetGroups(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    replaceName: string,
    recordValidation: (validation: ValidationResult) => void,
  ): boolean {
    const groups = this.groupSelectionsByTarget(selections);
    if (groups.length <= 1) return false;

    let currentShape = shape;
    for (const group of groups) {
      try {
        const targetSelections = this.reselectTargetBlendSelections(
          group,
          labelMap,
        );
        currentShape = this.applyBlendBatchWithConnectedRetry(
          kind,
          currentShape,
          targetSelections,
          owner,
          labelMap,
          group[0]?.span ?? { file: '(occt)', line: 1, col: 1 },
          (result) => replaceBody(replaceName, result),
        );
      } catch (err) {
        if (isOcctError(err)) {
          recordValidation(this.blendFailureValidation(err as OcctError));
          continue;
        }
        throw err;
      }
    }
    return true;
  }

  /**
   * Applies a blend batch, then falls back to connected sub-batches if needed.
   * Fused part selectors can resolve to several disconnected edge islands for a
   * single source feature after later geometry splits an edge. OCCT may reject
   * the whole selector batch even though each island remains valid.
   */
  private applyBlendBatchWithConnectedRetry(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    span: SourceSpan,
    replaceCurrentShape: (shape: OC) => void,
    initialError?: OcctError,
  ): OC {
    if (initialError) {
      return this.applyConnectedBlendBatchesAfterFailure(
        kind,
        shape,
        selections,
        owner,
        labelMap,
        span,
        replaceCurrentShape,
        initialError,
      );
    }
    try {
      const result = this.applyBlendBatch(kind, shape, selections, owner, span);
      replaceCurrentShape(result);
      return result;
    } catch (err) {
      if (!isOcctError(err)) throw err;

      return this.applyConnectedBlendBatchesAfterFailure(
        kind,
        shape,
        selections,
        owner,
        labelMap,
        span,
        replaceCurrentShape,
        err as OcctError,
      );
    }
  }

  /**
   * Applies connected blend batches after failure for the current OpenCascade build.
   */
  private applyConnectedBlendBatchesAfterFailure(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    span: SourceSpan,
    replaceCurrentShape: (shape: OC) => void,
    err: OcctError,
  ): OC {
    const batches = this.planConnectedBlendBatches(selections);
    if (!batches || batches.length <= 1) throw err;

    try {
      let currentShape = shape;
      for (const batch of batches) {
        const batchSelections = this.reselectConnectedBlendBatch(
          batch,
          labelMap,
        );
        currentShape = this.applyBlendBatch(
          kind,
          currentShape,
          batchSelections,
          owner,
          batch.selections[0]?.span ?? span,
        );
        replaceCurrentShape(currentShape);
      }
      return currentShape;
    } catch (fallbackErr) {
      if (isOcctError(fallbackErr)) {
        throw occtError(
          `${rawErrorMessage(err)} Disconnected-edge retry also failed: ${rawErrorMessage(fallbackErr)}`,
          (fallbackErr as OcctError).span ?? span,
        );
      }
      throw fallbackErr;
    }
  }

  /**
   * Builds group state for selections by target using the supplied shape and operation state.
   */
  private groupSelectionsByTarget(
    selections: EdgeSelection[],
  ): EdgeSelection[][] {
    const groups: EdgeSelection[][] = [];
    const byTarget = new Map<string, EdgeSelection[]>();
    for (const selection of selections) {
      const key = `${selection.target}:${selection.value}`;
      let group = byTarget.get(key);
      if (!group) {
        group = [];
        byTarget.set(key, group);
        groups.push(group);
      }
      group.push(selection);
    }
    return groups;
  }

  /**
   * Selects again target blend selections for the current OpenCascade build.
   */
  private reselectTargetBlendSelections(
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    const selected: EdgeSelection[] = [];
    const seen = new Set<unknown>();
    for (const selection of selections) {
      const candidates = this.blendEdgesForTarget(
        labelMap,
        selection.target,
        selection.selection,
      );
      const match =
        candidates.find(
          (edge) =>
            sameTopoShape(edge, selection.edge) &&
            ![...seen].some((used) => sameTopoShape(used, edge)),
        ) ?? selection.edge;
      seen.add(match);
      selected.push({ ...selection, edge: match });
    }
    return selected;
  }

  /**
   * Collects blend edge selections for the current OpenCascade build.
   */
  private collectBlendEdgeSelections(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    state: GroupBuildState,
    excludedEdges: unknown[] = [],
    ownerShape?: OC,
  ): EdgeSelection[] {
    const selections: EdgeSelection[] = [];
    for (const op of ops) {
      const value = modifierValue(op);
      const parsed = parseFaceRef(op.target);
      const edges = this.blendEdgesForOperation(
        labelMap,
        op,
        parsed.objName,
        excludedEdges,
        ownerShape,
      );
      recordInteractionEdgeSelection(
        this.oc,
        state,
        labelMap,
        op.selection,
        edges,
      );
      if (edges.length === 0 && op.selection?.edgeIntersection) {
        throw occtError(
          edgeIntersectionFailure(
            op.selection,
            selectEdgeIntersection(this.oc, labelMap, op.selection, ownerShape),
          ),
          op.span,
        );
      }
      if (edges.length === 0 && labelMap.hasSourceMemory(parsed.objName)) {
        continue;
      }
      if (edges.length === 0)
        throw occtError(`No edges for ${kind} '${op.target}'`, op.span);

      this.addBlendEdgeSelections(selections, edges, kind, owner, op, value);
    }
    return selections;
  }

  /**
   * Coordinates blend edges for operation as part of the OpenCascade build pipeline.
   */
  private blendEdgesForOperation(
    labelMap: FaceLabelMap,
    op: BlendModifierOp,
    sourceObjName: string,
    excludedEdges: unknown[],
    ownerShape?: OC,
  ): unknown[] {
    return this.blendEdgesForTarget(
      labelMap,
      op.target,
      op.selection,
      ownerShape,
    )
      .filter(
        (edge) =>
          !excludedEdges.some((excluded) =>
            this.edgesMatchForExclusion(excluded, edge),
          ),
      )
      .filter((edge) => this.edgeBelongsToSource(edge, sourceObjName));
  }

  /**
   * Coordinates blend edges for target as part of the OpenCascade build pipeline.
   */
  private blendEdgesForTarget(
    labelMap: FaceLabelMap,
    target: string,
    selection: import('@bushscad/ir').ResolvedSelectionTarget | undefined,
    ownerShape?: OC,
  ): unknown[] {
    if (selection?.edgeIntersection) {
      return selectEdgeIntersection(this.oc, labelMap, selection, ownerShape)
        .selected;
    }
    return selection?.sketchComponent
      ? selectSketchComponentEdges(this.oc, labelMap, selection, ownerShape)
      : labelMap.getBlendEdges(this.oc, target);
  }

  /**
   * Resolves edge data for belongs to source using the supplied shape and operation state.
   */
  private edgeBelongsToSource(edge: unknown, sourceObjName: string): boolean {
    const sourceName = (edge as { _sourceName?: string })?._sourceName;
    return sourceName === undefined || sourceName === sourceObjName;
  }

  /**
   * Adds blend edge selections for the current OpenCascade build.
   */
  private addBlendEdgeSelections(
    selections: EdgeSelection[],
    edges: unknown[],
    kind: BlendModifierKind,
    owner: string,
    op: BlendModifierOp,
    value: number,
  ): void {
    for (const edge of edges) {
      this.addBlendEdgeSelection(selections, edge, kind, owner, op, value);
    }
  }

  /**
   * Adds blend edge selection for the current OpenCascade build.
   */
  private addBlendEdgeSelection(
    selections: EdgeSelection[],
    edge: unknown,
    kind: BlendModifierKind,
    owner: string,
    op: BlendModifierOp,
    value: number,
  ): void {
    const existing = selections.find((selection) =>
      sameTopoShape(selection.edge, edge),
    );
    if (!existing) {
      selections.push({
        edge,
        value,
        target: op.target,
        span: op.span,
        ...(op.selection ? { selection: op.selection } : {}),
      });
      return;
    }
    if (sameModifierValue(existing.value, value)) return;
    if (existing.target !== op.target) {
      selections.push({
        edge,
        value,
        target: op.target,
        span: op.span,
        ...(op.selection ? { selection: op.selection } : {}),
      });
      return;
    }
    throw occtError(
      conflictingBlendMessage(kind, owner, existing, op.target, value),
      op.span,
    );
  }

  /**
   * Compares a broad selector candidate against an already-claimed edge.
   * Earlier feature-specific blends reserve their edges for later broad
   * selectors. Re-resolving those feature targets after a fillet can overmatch,
   * so the exclusion follows the concrete edge handle and its endpoints.
   */
  private edgesMatchForExclusion(
    claimed: unknown,
    candidate: unknown,
  ): boolean {
    if (sameTopoShape(claimed, candidate)) return true;
    try {
      const claimedEndpoints = readEdgeEndpoints(this.oc, claimed);
      const candidateEndpoints = readEdgeEndpoints(this.oc, candidate);
      return endpointsMatch(claimedEndpoints, candidateEndpoints);
    } catch {
      return false;
    }
  }

  /**
   * Expands selected fillet edges across tangent-connected neighbors.
   * Fused features often split circular or swept edges into multiple OCCT
   * edge handles. A user-facing fillet selector should wrap the smooth chain
   * instead of stopping at an artificial fuse seam.
   */
  private expandFilletTangentSelections(
    owner: string,
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    const expanded = [...selections];
    const queued = [...selections];
    const candidates = this.targetScopedTangentCandidates(
      shape,
      selections,
      labelMap,
    );

    while (queued.length > 0) {
      const current = queued.shift() as EdgeSelection;
      this.expandTangentSelection(owner, current, candidates, expanded, queued);
    }

    return expanded;
  }

  /**
   * Expands tangent selection for the current OpenCascade build.
   */
  private expandTangentSelection(
    owner: string,
    current: EdgeSelection,
    candidates: unknown[],
    expanded: EdgeSelection[],
    queued: EdgeSelection[],
  ): void {
    for (const edge of candidates) {
      if (!this.shouldPropagateTangentEdge(current, edge, expanded)) continue;
      const existing = expanded.find((selection) =>
        sameTopoShape(selection.edge, edge),
      );
      if (existing) {
        throw occtError(
          conflictingBlendMessage(
            'fillet',
            owner,
            existing,
            current.target,
            current.value,
          ),
          current.span,
        );
      }
      const propagated = { ...current, edge };
      expanded.push(propagated);
      queued.push(propagated);
    }
  }

  /**
   * Determines whether the supplied value meets the propagate tangent edge condition.
   */
  private shouldPropagateTangentEdge(
    current: EdgeSelection,
    edge: unknown,
    expanded: EdgeSelection[],
  ): boolean {
    if (!this.edgesAreTangentConnected(current.edge, edge)) return false;
    const existing = expanded.find((selection) =>
      sameTopoShape(selection.edge, edge),
    );
    if (!existing) return true;
    if (sameModifierValue(existing.value, current.value)) return false;
    return existing.target === current.target;
  }

  /**
   * Limits tangent expansion to edges that still belong to the target selector.
   * Fused shapes can contain tangent or coincident seams from unrelated source
   * features. Expansion should continue split edges for the same selector, not
   * implicitly add a boss/base seam to `flange.bottom.edges`.
   */
  private targetScopedTangentCandidates(
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): unknown[] {
    const candidates = getEdges(this.oc, shape);
    if (
      selections.every(
        (selection) =>
          !labelMap.hasSourceMemory(parseFaceRef(selection.target).objName),
      )
    ) {
      return candidates;
    }
    const byTarget = new Map<string, unknown[]>();
    for (const selection of selections) {
      if (!byTarget.has(selection.target)) {
        byTarget.set(
          selection.target,
          this.blendEdgesForTarget(
            labelMap,
            selection.target,
            selection.selection,
          ),
        );
      }
    }
    return candidates.filter((edge) =>
      [...byTarget].some(([target, targetEdges]) => {
        const targetObj = parseFaceRef(target).objName;
        const sourceName = (edge as { _sourceName?: string })?._sourceName;
        return (
          sourceName === targetObj ||
          targetEdges.some((targetEdge) => sameTopoShape(edge, targetEdge))
        );
      }),
    );
  }

  /**
   * Coordinates edges are tangent connected as part of the OpenCascade build pipeline.
   */
  private edgesAreTangentConnected(a: unknown, b: unknown): boolean {
    if (sameTopoShape(a, b)) return false;
    const groupA = (a as { _tangentGroup?: unknown })?._tangentGroup;
    const groupB = (b as { _tangentGroup?: unknown })?._tangentGroup;
    if (groupA !== undefined && groupA === groupB) return this.edgesTouch(a, b);

    const dirA = this.edgeDirection(a);
    const dirB = this.edgeDirection(b);
    if (!dirA || !dirB || !this.edgesTouch(a, b)) return false;
    return Math.abs(dotVec(dirA, dirB)) >= Math.cos((8 * Math.PI) / 180);
  }

  /**
   * Coordinates edges touch as part of the OpenCascade build pipeline.
   */
  private edgesTouch(a: unknown, b: unknown): boolean {
    const keysA = edgeVertexKeys(this.oc, a);
    const keysB = edgeVertexKeys(this.oc, b);
    return Boolean(keysA && keysB && keysA.some((key) => keysB.includes(key)));
  }

  /**
   * Resolves edge data for direction using the supplied shape and operation state.
   */
  private edgeDirection(edge: unknown): Vec3 | null {
    try {
      const [first, last] = readEdgeEndpoints(this.oc, edge);
      return normalizeVec([
        last[0] - first[0],
        last[1] - first[1],
        last[2] - first[2],
      ]);
    } catch {
      return null;
    }
  }

  /**
   * Performs a conservative pre-check for obviously impossible fillet radii.
   * OCCT can throw low-level exceptions for self-intersecting blends. When the
   * local limit is obvious from the target bounds, report a source-mapped
   * diagnostic before invoking the builder.
   */
  private rejectOversizedFillets(shape: OC, selections: EdgeSelection[]): void {
    const limit = this.estimateFilletRadiusLimit(shape);
    if (limit === null) return;
    for (const selection of selections) {
      if (selection.value <= limit) continue;
      throw occtError(
        `Fillet radius ${selection.value} is too large for '${selection.target}'; maximum estimated radius is ${formatLimit(limit)}`,
        selection.span,
      );
    }
  }

  /**
   * Estimates fillet radius limit for the current OpenCascade build.
   */
  private estimateFilletRadiusLimit(shape: OC): number | null {
    try {
      const bounds = readBounds(this.oc, shape);
      const dims = [
        bounds.xMax.current - bounds.xMin.current,
        bounds.yMax.current - bounds.yMin.current,
        bounds.zMax.current - bounds.zMin.current,
      ].filter((dim) => Number.isFinite(dim) && dim > 1e-6);
      if (dims.length === 0) return null;
      return Math.min(...dims) / 2;
    } catch {
      return null;
    }
  }

  /**
   * Applies blend batch for the current OpenCascade build.
   */
  private applyBlendBatch(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC {
    return kind === 'fillet'
      ? this.applyFilletBatch(shape, selections, owner, span)
      : this.applyChamferBatch(shape, selections, owner, span);
  }

  /**
   * Coordinates plan connected blend batches as part of the OpenCascade build pipeline.
   */
  private planConnectedBlendBatches(
    selections: EdgeSelection[],
  ): EdgeSelectionBatch[] | null {
    const connected = selections.map((selection) => {
      const vertexKeys = edgeVertexKeys(this.oc, selection.edge);
      if (!vertexKeys) return null;
      return {
        ...selection,
        vertexKeys,
        edgeKey: edgeKey(vertexKeys),
      };
    });

    if (connected.some((selection) => selection === null)) return null;

    const planned = connected as ConnectedEdgeSelection[];
    const parents = planned.map((_, index) => index);
    const byVertex = new Map<string, number>();
    /**
     * Finds the root index for an edge selection and compresses the traversed path.
     */
    const find = (index: number): number => {
      let root = index;
      while (parents[root] !== root) root = parents[root];
      while (parents[index] !== index) {
        const next = parents[index];
        parents[index] = root;
        index = next;
      }
      return root;
    };
    /**
     * Joins the sets containing two edge selections when they have different roots.
     */
    const union = (a: number, b: number): void => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parents[rootB] = rootA;
    };

    planned.forEach((selection, index) => {
      for (const vertexKey of selection.vertexKeys) {
        const existing = byVertex.get(vertexKey);
        if (existing === undefined) {
          byVertex.set(vertexKey, index);
        } else {
          union(existing, index);
        }
      }
    });

    const batches: EdgeSelectionBatch[] = [];
    const byRoot = new Map<number, EdgeSelectionBatch>();
    planned.forEach((selection, index) => {
      const root = find(index);
      let batch = byRoot.get(root);
      if (!batch) {
        batch = { selections: [] };
        byRoot.set(root, batch);
        batches.push(batch);
      }
      batch.selections.push(selection);
    });

    return batches;
  }

  /**
   * Selects again connected blend batch for the current OpenCascade build.
   */
  private reselectConnectedBlendBatch(
    batch: EdgeSelectionBatch,
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    const candidatesByTarget = new Map<string, ConnectedEdgeSelection[]>();
    const used: ConnectedEdgeSelection[] = [];
    const selected: EdgeSelection[] = [];

    for (const planned of batch.selections) {
      const targetKey = `${planned.target}:${planned.value}`;
      let candidates = candidatesByTarget.get(targetKey);
      if (!candidates) {
        candidates = labelMap
          .getBlendEdges(this.oc, planned.target)
          .map((edge) => {
            const vertexKeys = edgeVertexKeys(this.oc, edge);
            return vertexKeys
              ? {
                  edge,
                  value: planned.value,
                  target: planned.target,
                  span: planned.span,
                  vertexKeys,
                  edgeKey: edgeKey(vertexKeys),
                }
              : null;
          })
          .filter(
            (selection): selection is ConnectedEdgeSelection =>
              selection !== null,
          );
        candidatesByTarget.set(targetKey, candidates);
      }

      const match = candidates.find(
        (candidate) =>
          candidate.edgeKey === planned.edgeKey &&
          !used.some((existing) =>
            sameTopoShape(existing.edge, candidate.edge),
          ),
      );
      if (!match) return batch.selections;

      used.push(match);
      selected.push({
        edge: match.edge,
        value: planned.value,
        target: planned.target,
        span: planned.span,
      });
    }

    return selected;
  }

  /**
   * Applies fillet batch for the current OpenCascade build.
   */
  private applyFilletBatch(
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    let filler: OC | null = null;
    try {
      filler = new oc.BRepFilletAPI_MakeFillet(
        shape,
        oc.ChFi3d_FilletShape?.ChFi3d_Rational,
      );
      for (const selection of selections)
        filler.Add_2(selection.value, selection.edge);
      filler.Build();
      if (!filler.IsDone()) {
        throw occtError(
          describeBlendPhaseFailure(
            'fillet',
            owner,
            selections,
            describeFilletFailure(filler, selections),
          ),
          span,
        );
      }
      return filler.Shape();
    } catch (err) {
      if (isOcctError(err)) throw err;
      throw occtError(
        describeBlendPhaseFailure(
          'fillet',
          owner,
          selections,
          describeBlendException('fillet', selections, err),
        ),
        span,
      );
    } finally {
      filler?.delete?.();
    }
  }

  /**
   * Applies chamfer batch for the current OpenCascade build.
   */
  private applyChamferBatch(
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    let chamferer: OC | null = null;
    try {
      chamferer = new oc.BRepFilletAPI_MakeChamfer(shape);
      for (const selection of selections)
        chamferer.Add_2(selection.value, selection.edge);
      chamferer.Build();
      if (!chamferer.IsDone()) {
        throw occtError(
          describeBlendPhaseFailure(
            'chamfer',
            owner,
            selections,
            describeBlendRejection('chamfer', selections),
          ),
          span,
        );
      }
      return chamferer.Shape();
    } catch (err) {
      if (isOcctError(err)) throw err;
      throw occtError(
        describeBlendPhaseFailure(
          'chamfer',
          owner,
          selections,
          describeBlendException('chamfer', selections, err),
        ),
        span,
      );
    } finally {
      chamferer?.delete?.();
    }
  }

  /**
   * Builds neutral plane for the current OpenCascade build.
   */
  private buildNeutralPlane(oc: OC, shape: OC): OC {
    // Use the bottom face's plane as the neutral plane for draft
    const { xMin, xMax, yMin, yMax, zMin } = readBounds(oc, shape);
    const midX = (xMin.current + xMax.current) / 2;
    const midY = (yMin.current + yMax.current) / 2;
    const origin = new oc.gp_Pnt_3(midX, midY, zMin.current);
    const normal = new oc.gp_Dir_4(0, 0, 1);
    const plane = new oc.gp_Pln_3(origin, normal);
    origin.delete();
    normal.delete();
    return plane;
  }

  /**
   * Applies draft for the current OpenCascade build.
   */
  private applyDraft(
    shape: OC,
    faces: unknown[],
    angleDeg: number,
    neutralPlane: OC,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const drafter = new oc.BRepOffsetAPI_DraftAngle_2(shape);
    const pullDir = new oc.gp_Dir_4(0, 0, 1);
    const angleRad = (angleDeg * Math.PI) / 180;
    for (const face of faces)
      drafter.Add(face, pullDir, angleRad, neutralPlane, false);
    drafter.Build();
    if (!drafter.IsDone()) throw occtError('Draft failed', span);
    const result = drafter.Shape();
    pullDir.delete();
    drafter.delete();
    return result;
  }

  // Mesh extraction

  /**
   * Extracts mesh for the current OpenCascade build.
   */
  private extractMesh(shape: OC): Omit<MeshData, 'partName' | 'color'> {
    return extractOcctMesh(this.oc, shape);
  }

  /**
   * Builds name→shape and name→color lookup maps from built parts, indexing by
   * body name first and falling back to the part group name.
   */
  private collectShapeAndColorMaps(builtParts: BuiltPart[]): {
    shapeMap: Map<string, OC>;
    colorMap: Map<string, string>;
  } {
    const shapeMap = new Map<string, OC>();
    for (const { group, shape } of builtParts) shapeMap.set(group.name, shape);
    for (const { bodyShapes } of builtParts) {
      for (const [name, s] of bodyShapes) shapeMap.set(name, s);
    }
    const colorMap = new Map<string, string>();
    for (const { group, bodyShapes } of builtParts) {
      const c = group.color ?? '#D0D0D0';
      colorMap.set(group.name, c);
      for (const [name] of bodyShapes) colorMap.set(name, c);
    }
    return { shapeMap, colorMap };
  }

  // Export

  /**
   * Coordinates export program as part of the OpenCascade build pipeline.
   */
  private exportProgram(
    program: IRProgram,
    format: ExportFormat,
    drawingProgram?: DrawingProgram,
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit = 1,
  ): {
    buffers: { name: string; data: ArrayBuffer }[];
    drawings: DrawingResult[];
  } {
    const groups = partitionByPart(program.ops);
    const hasExplicitParts =
      program.parts.length > 0 ||
      groups.some((group) => group.name !== '__default__');
    const { parts: builtParts } = this.buildGroupsWithPartLabels(
      groups,
      program.workplane ?? 'XY',
      undefined,
      undefined,
      nativeBooleanPlan,
      nativeBooleanConcurrencyLimit,
    );
    try {
      const buffers = builtParts.map(({ group, shape }) => {
        const name = exportNameForPartGroup(group.name, hasExplicitParts);
        return this.exportShape(shape, name, format);
      });
      const { shapeMap, colorMap } = this.collectShapeAndColorMaps(builtParts);
      const drawings = [
        ...buildDrawingResults(this.oc, drawingProgram, shapeMap, colorMap),
      ];
      return { buffers, drawings };
    } finally {
      deleteBuiltPartShapes(builtParts);
    }
  }

  /**
   * Coordinates export shape as part of the OpenCascade build pipeline.
   */
  private exportShape(
    shape: OC,
    name: string,
    format: ExportFormat,
  ): { name: string; data: ArrayBuffer } {
    return this.shapeExporter.exportShape(shape, name, format);
  }

  // Path and Sweep operations

  /**
   * Builds path operation for the current OpenCascade build.
   */
  private buildPathOperation(state: GroupBuildState, op: IRPath): void {
    const oc = this.oc;
    const { points } = op.primitive;
    if (points.length < 2)
      throw occtError(`Path '${op.name}' needs at least 2 points`, op.span);

    if (op.primitive.kind === 'polyline' && points.length === 2) {
      // Straight 2-point line — single edge, no corner issues
      const a = points[0],
        b = points[1];
      const pa = new oc.gp_Pnt_3(a.x, a.y, a.z);
      const pb = new oc.gp_Pnt_3(b.x, b.y, b.z);
      const edge = new oc.BRepBuilderAPI_MakeEdge_3(pa, pb).Edge();
      this.storeBuiltPathWire(
        state,
        op.name,
        edge,
        `Polyline path '${op.name}' failed`,
        op.span,
      );
      pa.delete();
      pb.delete();
    } else {
      // Multi-segment polyline or spline: use B-spline through points.
      // Sharp corner wires produce inverted transition faces in MakePipeShell;
      // a smooth B-spline through the same points avoids the C0 discontinuity.
      const ptArr = new oc.TColgp_Array1OfPnt_2(1, points.length);
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        ptArr.SetValue(i + 1, new oc.gp_Pnt_3(pt.x, pt.y, pt.z));
      }
      const continuity = oc.GeomAbs_Shape?.GeomAbs_C2 ?? oc.GeomAbs_C2 ?? 5;
      const interp = new oc.GeomAPI_PointsToBSpline_2(
        ptArr,
        3,
        8,
        continuity,
        1e-3,
      );
      if (!interp.IsDone())
        throw occtError(`Spline path '${op.name}' failed`, op.span);
      const bspline = interp.Curve();
      const curveHandle = new oc.Handle_Geom_Curve_2(bspline.get());
      const edge = new oc.BRepBuilderAPI_MakeEdge_24(curveHandle).Edge();
      curveHandle.delete();
      this.storeBuiltPathWire(
        state,
        op.name,
        edge,
        `Spline wire '${op.name}' failed`,
        op.span,
      );
      ptArr.delete();
    }
  }

  /**
   * Stores a path wire built from a single OCCT edge.
   */
  private storeBuiltPathWire(
    state: GroupBuildState,
    name: string,
    edge: OC,
    failureMessage: string,
    span: SourceSpan,
  ): void {
    const wb = new this.oc.BRepBuilderAPI_MakeWire_2(edge);
    if (!wb.IsDone()) throw occtError(failureMessage, span);
    state.pathWires.set(name, wb.Wire());
    wb.delete();
  }

  /**
   * Builds sweep solid for the current OpenCascade build.
   */
  private buildSweepSolid(
    state: GroupBuildState,
    sketchName: string,
    pathName: string,
    orientation: string,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const pathWire = state.pathWires.get(pathName);
    if (!pathWire) throw occtError(`Unknown path '${pathName}'`, span);
    const profileWire = state.sketchWires.get(sketchName);
    if (!profileWire) throw occtError(`Unknown sketch '${sketchName}'`, span);

    const pipeShell = new oc.BRepOffsetAPI_MakePipeShell(pathWire);
    // RightCorner (1) creates proper miter joints at polyline corners — prevents inside-out faces
    pipeShell.Add_1(profileWire, false, false);
    if (orientation === 'fixed') {
      pipeShell.SetMode_1(false);
    } else if (orientation === 'binormal') {
      const zDir = new oc.gp_Dir_4(0, 0, 1);
      pipeShell.SetMode_3(zDir);
      zDir.delete();
    }
    pipeShell.Build();
    if (!pipeShell.IsDone()) {
      throw occtError('Sweep failed', span);
    }
    pipeShell.MakeSolid();
    const shape = pipeShell.Shape();
    pipeShell.delete();
    return shape;
  }

  /**
   * Builds sweep operation for the current OpenCascade build.
   */
  private buildSweepOperation(state: GroupBuildState, op: IRSweep): void {
    const shape = this.buildSweepSolid(
      state,
      op.sketchName,
      op.pathName,
      op.orientation,
      op.span,
    );
    this.addBodyFromSketchAxis(
      state,
      op.objName,
      op.sketchName,
      shape,
      op.material ?? null,
      op.span,
    );
  }

  /**
   * Builds sweep cut operation for the current OpenCascade build.
   */
  private buildSweepCutOperation(state: GroupBuildState, op: IRSweepCut): void {
    const sweepShape = this.buildSweepSolid(
      state,
      op.sketchName,
      op.pathName,
      op.orientation,
      op.span,
    );
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = state.labelMap.getShape(parsed.objName);
    if (!targetShape)
      throw occtError(
        `sweep_cut: target body '${parsed.objName}' not built yet`,
        op.span,
      );
    const result = this.applyBoolCut(targetShape, sweepShape, op.span);
    (sweepShape as { delete(): void }).delete();
    this.aliasBody(state, op.objName, parsed.objName, 'inner');
    this.replaceBody(state, parsed.objName, result);
  }
}
