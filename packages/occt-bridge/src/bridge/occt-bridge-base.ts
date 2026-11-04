/** Shared internal contract and state for the operation-specific OCCT bridge layers. */

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

import { FaceLabelMap } from '../topology/face-labels.js';

import type { FaceFrame } from '../topology/face-labels.js';

import { partitionByPart } from '../core/program-utils.js';

import type { PartGroup } from '../core/program-utils.js';

import { readBounds, type Vec3 } from '../core/geometry-utils.js';

import { type SolidCutToolSource } from '../operations/solid-cut-tools.js';

import { type PartMeshColor } from '../mesh/mesh-colors.js';

import { OcctShapeExporter } from '../export/occt-shape-exporter.js';

import { normalizeVec } from '../topology/frame-utils.js';

import { preparedComponentName } from './prepared-component-assembly.js';

import { type ProfileRegionExtrudeResult } from '../profiles/profile-region-solids.js';

import { isOcctError } from '../core/occt-errors.js';

import { type GroupOperationHandlers } from '../operations/group-operation-dispatch.js';

import { buildRadialStations } from '../operations/radial-stations.js';

import {
  NativeBooleanBatchRuntime,
  type PreparedNativeCut,
  type PreparedNativeFuse,
} from '../operations/native-boolean-batch-runtime.js';

import type { SourceAttachmentPlane } from '../topology/source-edge-recovery.js';

import { type OcctBuildTrace } from '../operations/build-trace.js';

import type {
  BlendModifierKind,
  BlendModifierOp,
  BodyEdgeMode,
  BuiltMaterialShape,
  BuiltPart,
  EdgeSelection,
  EdgeSelectionBatch,
  GroupBuildState,
  ModifierOp,
  OC,
} from './bridge-types.js';

import { OcctQueryEvaluator } from '../operations/occt-query-evaluator.js';

/**
 * Request to blend retry, including operation kind, owner, ops, label map, and replace body.
 */
export type BlendRetryRequest = {
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
export type FinalizedGroupBuild = {
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
export type FusedAliasSources = {
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

/**
 * Coordinates endpoints match as part of the OpenCascade build pipeline.
 */
export function endpointsMatch(
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
export function shapeDisablesFuseGlue(shape: unknown): boolean {
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
export function componentPreparationTarget(
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
export function componentPreparationError(
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
export function pointsClose(a: Vec3, b: Vec3, tolerance: number): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance
  );
}

/**
 * Coordinates torus mesh as part of the OpenCascade build pipeline.
 */
export function torusMesh(
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
export function formatLimit(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

export const FONT_ALIAS_NAMES: Record<string, string[]> = {
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

export const BUNDLED_FONT_PATH_BY_NAME: Record<string, string> = {
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

export const FONT_ASPECT_REGULAR = 0;

export abstract class OcctBridgeBase {
  protected readonly queryEvaluator: OcctQueryEvaluator;
  protected readonly shapeExporter: OcctShapeExporter;

  protected constructor(protected oc: OC) {
    this.queryEvaluator = new OcctQueryEvaluator(oc);
    this.shapeExporter = new OcctShapeExporter(oc);
  }

  // Program-level
  /**
   * Coordinates install assets as part of the OpenCascade build pipeline.
   */
  protected abstract installAssets(assets: CompileAssets): void;

  /**
   * Ensures fs dir for the current OpenCascade build.
   */
  protected abstract ensureFsDir(path: string): void; /**
   * Validates program assertions against the built shapes.
   */

  /**
   * Coordinates validate assertions as part of the OpenCascade build pipeline.
   */
  protected abstract validateAssertions(
    program: IRProgram,
    shapeMap: Map<string, OC>,
  ): ValidationResult[];

  /**
   * Builds program with validation for the current OpenCascade build.
   */
  protected abstract buildProgramWithValidation(
    program: IRProgram,
    drawingProgram?: DrawingProgram,
    trace?: OcctBuildTrace,
    autoColorOffset?: number,
    preparedComponents?: readonly PreparedComponentArtifact[],
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit?: number,
  ): {
    meshes: MeshData[];
    validations: ValidationResult[];
    drawings: DrawingResult[];
    joints: ResolvedJointData[];
    interaction?: InteractionSnapshot;
  };

  // Design validation
  /**
   * Coordinates built part meshes as part of the OpenCascade build pipeline.
   */
  protected abstract builtPartMeshes(
    part: BuiltPart,
    nextColor: () => string,
  ): MeshData[];

  /**
   * Coordinates material shape meshes as part of the OpenCascade build pipeline.
   */
  protected abstract materialShapeMeshes(
    part: BuiltPart,
    color: PartMeshColor,
  ): MeshData[];

  /**
   * Coordinates material shape mesh as part of the OpenCascade build pipeline.
   */
  protected abstract materialShapeMesh(
    part: BuiltPart,
    entry: BuiltMaterialShape,
    color: PartMeshColor,
  ): MeshData;

  /**
   * Extracts part mesh for the current OpenCascade build.
   */
  protected abstract extractPartMesh(
    part: BuiltPart,
    shape: OC,
  ): Omit<MeshData, 'partName' | 'color' | 'material'>;

  /**
   * Coordinates hardware visual meshes as part of the OpenCascade build pipeline.
   */
  protected abstract hardwareVisualMeshes(part: BuiltPart): MeshData[];

  /**
   * Coordinates debug blend meshes as part of the OpenCascade build pipeline.
   */
  protected abstract debugBlendMeshes(part: BuiltPart): MeshData[];

  /**
   * Builds groups with part labels for the current OpenCascade build.
   */
  protected abstract buildGroupsWithPartLabels(
    groups: PartGroup[],
    workplane: Workplane,
    trace?: OcctBuildTrace,
    preparedComponents?: readonly PreparedComponentArtifact[],
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit?: number,
  ): {
    parts: BuiltPart[];
    globalLabels: FaceLabelMap;
  };

  /**
   * Builds group for the current OpenCascade build.
   */
  protected abstract buildGroup(
    group: PartGroup,
    globalLabels: FaceLabelMap,
    workplane: Workplane,
    trace?: OcctBuildTrace,
    preparedComponents?: readonly PreparedComponentArtifact[],
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit?: number,
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
  };

  /** Applies operations in source order and flushes deferred modifiers. */
  protected abstract applyGroupOperations(
    group: PartGroup,
    state: GroupBuildState,
    trace: OcctBuildTrace | undefined,
    nativeBatches: NativeBooleanBatchRuntime | undefined,
    preparedComponents: readonly PreparedComponentArtifact[] | undefined,
  ): void;

  /** Applies one non-modifier operation, restoring prepared work when available. */
  protected abstract applyGroupOperationEntry(
    group: PartGroup,
    state: GroupBuildState,
    op: PartGroup['ops'][number],
    opIndex: number,
    trace: OcctBuildTrace | undefined,
    nativeBatches: NativeBooleanBatchRuntime | undefined,
    preparedComponents: readonly PreparedComponentArtifact[] | undefined,
  ): void;

  /** Runs one regular operation and records its success or failure trace. */
  protected abstract runGroupOperationWithTrace(
    group: PartGroup,
    state: GroupBuildState,
    op: PartGroup['ops'][number],
    opIndex: number,
    trace: OcctBuildTrace | undefined,
    nativeBatches: NativeBooleanBatchRuntime | undefined,
  ): void;

  /**
   * Applies group operation for the current OpenCascade build.
   */
  protected abstract applyGroupOperation(
    state: GroupBuildState,
    op: IROp,
  ): void;

  /**
   * Builds group state for operation handlers using the supplied shape and operation state.
   */
  protected abstract groupOperationHandlers(
    state: GroupBuildState,
  ): GroupOperationHandlers;

  /**
   * Builds solid primitive operation for the current OpenCascade build.
   */
  protected abstract buildSolidPrimitiveOperation(
    state: GroupBuildState,
    op: IRSolidPrimitive,
  ): void;

  /**
   * Builds shell group operation for the current OpenCascade build.
   */
  protected abstract buildShellGroupOperation(
    state: GroupBuildState,
    op: Extract<
      IROp,
      {
        kind: 'shell';
      }
    >,
  ): void;

  /**
   * Builds surface thicken operation for the current OpenCascade build.
   */
  protected abstract buildSurfaceThickenOperation(
    state: GroupBuildState,
    op: IRSurfaceThicken,
  ): void;

  /**
   * Builds thread group operation for the current OpenCascade build.
   */
  protected abstract buildThreadGroupOperation(
    state: GroupBuildState,
    op: Extract<
      IROp,
      {
        kind: 'thread';
      }
    >,
  ): void;

  /**
   * Builds heal operation for the current OpenCascade build.
   */
  protected abstract buildHealOperation(
    state: GroupBuildState,
    op: IRHeal,
  ): void;

  /**
   * Marks an already-built shape as a reusable source instead of render output.
   * One-line `ref name = <object-op>;` builds with the same pipeline as `obj`
   * so cuts, placements, labels, and part components all stay consistent. This
   * marker only changes visibility at the declaration site.
   */
  protected abstract declareShapeSource(
    state: GroupBuildState,
    name: string,
    span: SourceSpan,
  ): void;

  // Re-register a mutated imported/ref shape into both the group-local and the
  // shared label maps so later parts resolve the current topology.
  /**
   * Coordinates reregister shape as part of the OpenCascade build pipeline.
   */
  protected abstract reregisterShape(
    state: GroupBuildState,
    name: string,
    shape: OC,
  ): void;

  /**
   * Builds defeature operation for the current OpenCascade build.
   */
  protected abstract buildDefeatureOperation(
    state: GroupBuildState,
    op: IRDefeature,
  ): void;

  /**
   * Builds defeatured shape for the current OpenCascade build.
   */
  protected abstract buildDefeaturedShape(defeaturing: OC, op: IRDefeature): OC;

  /**
   * Adds defeature faces to remove for the current OpenCascade build.
   */
  protected abstract addDefeatureFacesToRemove(
    defeaturing: OC,
    shape: OC,
    threshold: number,
  ): number;

  /**
   * Checks whether the supplied value meets the defeature candidate face condition.
   */
  protected abstract isDefeatureCandidateFace(
    face: OC,
    threshold: number,
  ): boolean;

  /**
   * Builds hardware visual operation for the current OpenCascade build.
   */
  protected abstract buildHardwareVisualOperation(
    state: GroupBuildState,
    op: IRHardwareVisual,
  ): void;

  /**
   * Builds sketch operation for the current OpenCascade build.
   */
  protected abstract buildSketchOperation(
    state: GroupBuildState,
    op: IRSketch,
  ): void;

  /**
   * Builds extrude operation for the current OpenCascade build.
   */
  protected abstract buildExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): void;

  /**
   * Attempts to build wrapped extrude operation using the supplied shape and operation state.
   */
  protected abstract tryBuildWrappedExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean;

  /**
   * Builds standard extrude operation for the current OpenCascade build.
   */
  protected abstract buildStandardExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): void;

  /**
   * Coordinates position sketch face for extrude as part of the OpenCascade build pipeline.
   */
  protected abstract positionSketchFaceForExtrude(
    sketchFace: OC,
    ax2: OC,
    op: IRExtrude,
  ): OC;

  /**
   * Returns the face/depth pair used for additive part extrudes.
   * Part-scope additive bodies are eventually fused. When a placed extrude
   * starts exactly on a target face, OCCT sees tangent-only topology; a tiny
   * internal overlap makes the boolean robust without changing visible extents.
   */
  protected abstract partFuseExtrudeInput(
    state: GroupBuildState,
    op: IRExtrude,
    placedFace: OC,
    ax2: OC,
    depth?: number,
  ): {
    face: OC;
    depth: number;
    overlapped?: true;
  };

  /**
   * Determines whether the supplied value meets the overlap part extrude condition.
   */
  protected abstract shouldOverlapPartExtrude(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean;

  /**
   * Attempts to build exact profile region extrude operation using the supplied shape and
   * operation state.
   */
  protected abstract tryBuildExactProfileRegionExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean;

  /**
   * Disables fuse glue for the current OpenCascade build.
   */
  protected abstract disableFuseGlue(shape: OC): void;

  /**
   * Adds extruded body for the current OpenCascade build.
   */
  protected abstract addExtrudedBody(
    state: GroupBuildState,
    op: IRExtrude,
    shape: OC,
    ax2: OC,
  ): void;

  /**
   * Captures the original placement plane for a source body.
   * Fused additive features can lose their source bottom/top face. Keeping the
   * plane lets later selectors recover the visible seam at the placement site.
   */
  protected abstract sourceAttachmentPlane(ax2: OC): SourceAttachmentPlane;

  /**
   * Applies bool fuse for the current OpenCascade build.
   */
  protected abstract applyBoolFuse(
    a: OC,
    b: OC,
    span: SourceSpan,
    failureMessage?: string,
  ): OC;

  /**
   * Builds cut operation for the current OpenCascade build.
   */
  protected abstract buildCutOperation(state: GroupBuildState, op: IRCut): void;

  /** Prepares one ordinary sketch cutter without mutating its target body. */
  protected abstract prepareNativeCutOperation(
    state: GroupBuildState,
    op: IRCut,
  ): PreparedNativeCut;

  /** Replays one cut feature's aliases and labels against its chosen result. */
  protected abstract commitNativeCutOperation(
    state: GroupBuildState,
    prepared: PreparedNativeCut,
    result: OC,
  ): void;

  /** Replays all cut identities, then labels the shared final topology once. */
  protected abstract commitNativeCutBatch(
    state: GroupBuildState,
    cuts: readonly PreparedNativeCut[],
    result: OC,
  ): void;

  /**
   * Attempts to build wrap cut operation using the supplied shape and operation state.
   */
  protected abstract tryBuildWrapCutOperation(
    state: GroupBuildState,
    op: IRCut,
  ): boolean;

  /**
   * Applies deferred part cut for the current OpenCascade build.
   */
  protected abstract applyDeferredPartCut(
    state: GroupBuildState,
    op: IRCut,
    targetAlias: string,
    tool: OC,
    result: OC,
    ax2: OC,
  ): void;

  /**
   * Applies direct cut for the current OpenCascade build.
   */
  protected abstract applyDirectCut(
    state: GroupBuildState,
    op: IRCut,
    targetName: string,
    primaryOwner: string,
    tool: OC,
    result: OC,
  ): void;

  /**
   * Coordinates cut overlapping bodies as part of the OpenCascade build pipeline.
   */
  protected abstract cutOverlappingBodies(
    state: GroupBuildState,
    primaryOwner: string,
    tool: OC,
    span: SourceSpan,
  ): void;

  /**
   * Resolves sketch face and axis for the current OpenCascade build.
   */
  protected abstract resolveSketchFaceAndAxis(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
    span: SourceSpan,
    closedBodyNames?: string[],
  ): {
    sketchFace: OC;
    ax2: OC;
  };

  /**
   * Resolves sketch axis for the current OpenCascade build.
   */
  protected abstract resolveSketchAxis(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
  ): OC;

  /**
   * Builds exact profile region extrude for the current OpenCascade build.
   */
  protected abstract buildExactProfileRegionExtrude(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
    depth: number,
    symmetric: boolean,
    span: SourceSpan,
    closedBodyNames?: string[],
    overlapAdditive?: boolean,
  ):
    | (ProfileRegionExtrudeResult & {
        ax2: OC;
      })
    | null;

  /**
   * Builds exact profile region cut tool for the current OpenCascade build.
   */
  protected abstract buildExactProfileRegionCutTool(
    state: GroupBuildState,
    op: IRCut,
    ax2: OC,
    targetShape: OC,
  ): OC | null;

  /**
   * Builds sketch cut tool for the current OpenCascade build.
   */
  protected abstract buildSketchCutTool(
    state: GroupBuildState,
    op: IRCut,
    sketchFace: OC,
    ax2: OC,
    targetShape: OC,
  ): OC;

  /**
   * Builds selected sketch face for the current OpenCascade build.
   */
  protected abstract buildSelectedSketchFace(
    state: GroupBuildState,
    sketchName: string,
    closedBodyNames: string[],
    span: SourceSpan,
  ): OC;

  /**
   * Subtracts a copied solid body from the object owning `from`.
   * Sketch cuts generate their own prism tools. Solid cuts instead reuse an
   * existing body or temporary inline solid and place a copy on the target face
   * so predefined tools remain visible and inline tools stay temporary.
   */
  protected abstract buildSolidCutOperation(
    state: GroupBuildState,
    op: IRSolidCut,
  ): void;

  /**
   * Returns shape data for for solid cut target using the supplied shape and operation state.
   */
  protected abstract shapeForSolidCutTarget(
    state: GroupBuildState,
    targetName: string,
  ): OC | undefined;

  /**
   * Coordinates alias solid cut result as part of the OpenCascade build pipeline.
   */
  protected abstract aliasSolidCutResult(
    state: GroupBuildState,
    op: IRSolidCut,
    targetName: string,
    result: OC,
    regionShape: OC,
    attachmentPlane: SourceAttachmentPlane,
  ): void;

  /**
   * Builds solid cut tool source for the current OpenCascade build.
   */
  protected abstract buildSolidCutToolSource(
    state: GroupBuildState,
    op: IRSolidCut,
  ): SolidCutToolSource;

  /**
   * Preserves solid cut tool component for the current OpenCascade build.
   */
  protected abstract preserveSolidCutToolComponent(
    state: GroupBuildState,
    toolName: string,
  ): void;

  /**
   * Returns shape data for for solid cut tool using the supplied shape and operation state.
   */
  protected abstract shapeForSolidCutTool(
    state: GroupBuildState,
    toolName: string,
  ): OC | undefined;

  /**
   * Returns the authored placement axis for a predefined solid cut tool.
   * The bottom face label's normal points outward from the tool, which reverses
   * an extruded punch when placing it into a top cut. The source origin should
   * still be the tool bottom center, but the orientation must come from the
   * body frame that describes the direction the solid was authored to grow.
   */
  protected abstract sourceAxisForSolidCutTool(
    state: GroupBuildState,
    toolName: string,
  ): OC;

  /**
   * Builds inline solid tool shape for the current OpenCascade build.
   */
  protected abstract buildInlineSolidToolShape(
    state: GroupBuildState,
    op: Extract<
      IRSolidCut['tool'],
      {
        kind: 'operation';
      }
    >['operation'],
  ): {
    shape: OC;
    sourceAx2: OC;
    toolKind?: string;
  };

  /**
   * Builds inline extrude tool shape for the current OpenCascade build.
   */
  protected abstract buildInlineExtrudeToolShape(
    state: GroupBuildState,
    op: IRExtrude,
  ): {
    shape: OC;
    sourceAx2: OC;
  };

  /**
   * Builds an inline revolve cutter in the tool's local radial/axial frame.
   * A normal revolve body uses the sketch plane directly. For solid cut tools,
   * the tool's local positive Z is the cutting and revolve axis, so the sketch
   * face must first move into a plane containing that axis to avoid degenerate
   * fan geometry when the user writes `revolve(profile around z)`.
   */
  protected abstract buildInlineRevolveToolShape(
    state: GroupBuildState,
    op: IRRevolve,
  ): {
    shape: OC;
    sourceAx2: OC;
  };

  /**
   * Builds sketch data for face for inline tool using the supplied shape and operation state.
   */
  protected abstract sketchFaceForInlineTool(
    state: GroupBuildState,
    sketchName: string,
    span: SourceSpan,
  ): OC;

  /**
   * Builds sketch data for axis for inline tool using the supplied shape and operation state.
   */
  protected abstract sketchAxisForInlineTool(
    state: GroupBuildState,
    sketchName: string,
  ): OC;

  /**
   * Places and offsets a revolve tool profile in its radial/axial plane.
   * The profile face must be moved before revolve so sketch X is radial and
   * sketch Y is axial along the tool's local cut direction.
   */
  protected abstract positionInlineRevolveToolFace(
    sketchFace: OC,
    profileAx2: OC,
    radius: number | undefined,
  ): OC;

  /**
   * Translates inline revolve tool face for the current OpenCascade build.
   */
  protected abstract translateInlineRevolveToolFace(
    placedFace: OC,
    profileAx2: OC,
    radius: number | undefined,
  ): OC;

  /**
   * Coordinates revolve inline tool face as part of the OpenCascade build pipeline.
   */
  protected abstract revolveInlineToolFace(
    state: GroupBuildState,
    op: IRRevolve,
    placedFace: OC,
    sourceAx2: OC,
  ): OC;

  /**
   * Returns a placement axis whose normal points into the target solid.
   * Solid tools are authored with their local positive Z as their cutting
   * direction. Face labels point outward from the target, so top/side solid
   * cuts must flip that face frame when the body center is behind the normal.
   */
  protected abstract solidCutTargetAxis(targetAx2: OC, targetShape: OC): OC;

  /**
   * Builds radial extrude operation for the current OpenCascade build.
   */
  protected abstract buildRadialExtrudeOperation(
    state: GroupBuildState,
    op: IRRadialExtrude,
  ): void;

  /**
   * Adds a body using the source sketch axis as the face-frame basis.
   * Several sketch-derived solids need identical frame registration so face
   * labels resolve consistently after construction.
   */
  protected abstract addBodyFromSketchAxis(
    state: GroupBuildState,
    objName: string,
    sketchName: string,
    shape: OC,
    material: MaterialAppearance | null,
    span?: SourceSpan,
  ): void;

  /**
   * Builds radial cut operation for the current OpenCascade build.
   */
  protected abstract buildRadialCutOperation(
    state: GroupBuildState,
    op: IRRadialCut,
  ): void;

  /**
   * Builds radial solid for the current OpenCascade build.
   */
  protected abstract buildRadialSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
    cutTargetShape?: OC,
  ): OC;

  /**
   * Builds radial data for sketch wire using the supplied shape and operation state.
   */
  protected abstract radialSketchWire(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
  ): OC;

  /**
   * Builds radial data for source axis using the supplied shape and operation state.
   */
  protected abstract radialSourceAxis(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
  ): OC;

  /**
   * Rejects radial modifiers this OCCT path does not support.
   * Angle/length radial sweeps support station placement only; twist and taper
   * must keep the same explicit errors as before the extraction.
   */
  protected abstract validateRadialAngleLengthModifiers(
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
  ): void;

  /**
   * Builds radial data for axis vector using the supplied shape and operation state.
   */
  protected abstract radialAxisVector(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
  ): {
    point: Vec3;
    dir: Vec3;
  };

  /**
   * Builds radial data for axial sign using the supplied shape and operation state.
   */
  protected abstract radialAxialSign(
    op: IRRadialExtrude | IRRadialCut,
    axisVec: {
      point: Vec3;
      dir: Vec3;
    },
    cutTargetShape?: OC,
  ): number;

  /**
   * Builds radial data for stations using the supplied shape and operation state.
   */
  protected abstract radialStations(
    op: IRRadialExtrude | IRRadialCut,
    extent: Extract<
      (IRRadialExtrude | IRRadialCut)['extent'],
      {
        kind: 'angle-length';
      }
    >,
    span: SourceSpan,
  ): ReturnType<typeof buildRadialStations>;

  /**
   * Builds radial station wires for the current OpenCascade build.
   */
  protected abstract buildRadialStationWires(
    sketchWire: OC,
    ax2: OC,
    op: IRRadialExtrude | IRRadialCut,
    axisVec: {
      point: Vec3;
      dir: Vec3;
    },
    stations: ReturnType<typeof buildRadialStations>,
    axialSign: number,
  ): OC[];

  /**
   * Builds radial station wire for the current OpenCascade build.
   */
  protected abstract buildRadialStationWire(
    sketchWire: OC,
    ax2: OC,
    op: IRRadialExtrude | IRRadialCut,
    axisVec: {
      point: Vec3;
      dir: Vec3;
    },
    rotDeg: number,
    axialMm: number,
    axialSign: number,
  ): OC;

  /**
   * Builds the ruled loft through radial station wires.
   * Ruled mode keeps helical radial sweeps as one solid for stable mesh output
   * and color assignment.
   */
  protected abstract buildRadialLoftShape(wires: OC[], span: SourceSpan): OC;

  /**
   * Builds radial placement bridge solid for the current OpenCascade build.
   */
  protected abstract buildRadialPlacementBridgeSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
    span: SourceSpan,
    cutTargetShape?: OC,
  ): OC;

  /**
   * Builds radial data for placement guide path wire using the supplied shape and operation state.
   */
  protected abstract radialPlacementGuidePathWire(
    state: GroupBuildState,
    extent: Extract<
      (IRRadialExtrude | IRRadialCut)['extent'],
      {
        kind: 'placement-bridge';
      }
    >,
    span: SourceSpan,
  ): OC | null;

  /**
   * Builds radial data for placement profile axis using the supplied shape and operation state.
   */
  protected abstract radialPlacementProfileAxis(
    pathWire: OC,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
    cutTargetShape?: OC,
  ): OC;

  /**
   * Builds radial placement pipe solid for the current OpenCascade build.
   */
  protected abstract buildRadialPlacementPipeSolid(
    pathWire: OC,
    placedProfile: OC,
    span: SourceSpan,
  ): OC;

  /**
   * Builds auto radial placement bridge solid for the current OpenCascade build.
   */
  protected abstract buildAutoRadialPlacementBridgeSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    fromAx2: OC,
    cutTargetShape: OC | undefined,
    span: SourceSpan,
  ): OC;

  /**
   * Builds radial data for bridge curve scales using the supplied shape and operation state.
   */
  protected abstract radialBridgeCurveScales(
    curve: IRRadialExtrude['curve'],
  ): [number, number];

  /**
   * Coordinates bridge interior direction as part of the OpenCascade build pipeline.
   */
  protected abstract bridgeInteriorDirection(
    point: Vec3,
    normal: Vec3,
    targetShape: OC | undefined,
  ): Vec3;

  /**
   * Adds scaled vec for the current OpenCascade build.
   */
  protected abstract addScaledVec(point: Vec3, dir: Vec3, scale: number): Vec3;

  /**
   * Calculates distance for between using the supplied shape and operation state.
   */
  protected abstract distanceBetween(a: Vec3, b: Vec3): number;

  /**
   * Builds auto bridge bezier points for the current OpenCascade build.
   */
  protected abstract buildAutoBridgeBezierPoints(
    start: Vec3,
    startDir: Vec3,
    end: Vec3,
    endDir: Vec3,
    curve: IRRadialExtrude['curve'],
    targetShape: OC | undefined,
  ): {
    point: Vec3;
    tangent: Vec3;
    t: number;
  }[];

  /**
   * Coordinates bridge section x direction as part of the OpenCascade build pipeline.
   */
  protected abstract bridgeSectionXDirection(
    startX: Vec3,
    endX: Vec3,
    tangent: Vec3,
    t: number,
  ): Vec3;

  /**
   * Coordinates cubic bezier point as part of the OpenCascade build pipeline.
   */
  protected abstract cubicBezierPoint(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    t: number,
  ): Vec3;

  /**
   * Coordinates cubic bezier tangent as part of the OpenCascade build pipeline.
   */
  protected abstract cubicBezierTangent(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    t: number,
  ): Vec3 | null;

  /**
   * Builds point data for in bounds using the supplied shape and operation state.
   */
  protected abstract pointInBounds(
    point: Vec3,
    bounds: ReturnType<typeof readBounds>,
  ): boolean;

  /**
   * Reads a placement axis without taking ownership of the OCCT handle.
   * Some frame helpers intentionally delete the axis they read. Radial bridge
   * construction receives the live `from:` axis and must keep it valid for
   * later profile placement.
   */
  protected abstract readAx2PointAndDirection(ax2: OC): {
    point: Vec3;
    dir: Vec3;
  };

  /**
   * Builds axis data for sign toward shape using the supplied shape and operation state.
   */
  protected abstract axisSignTowardShape(
    point: Vec3,
    dir: Vec3,
    targetShape: OC,
  ): number;

  /**
   * Builds radial data for bridge cut profile axis using the supplied shape and operation state.
   */
  protected abstract radialBridgeCutProfileAxis(
    pathWire: OC,
    op: IRRadialCut,
    ax2: OC,
    targetShape: OC,
  ): OC;

  /**
   * Builds path data for start tangent using the supplied shape and operation state.
   */
  protected abstract pathStartTangent(pathWire: OC): Vec3 | null;

  /**
   * Creates axis system for the current OpenCascade build.
   */
  protected abstract makeAx2(point: Vec3, zDirVec: Vec3, xDirVec: Vec3): OC;

  /**
   * Builds revolve operation for the current OpenCascade build.
   */
  protected abstract buildRevolveOperation(
    state: GroupBuildState,
    op: IRRevolve,
  ): void;

  /**
   * Builds revolve shape for the current OpenCascade build.
   */
  protected abstract buildRevolveShape(
    state: GroupBuildState,
    op: IRRevolve,
  ): OC;

  /**
   * Translates along sketch x for the current OpenCascade build.
   */
  protected abstract translateAlongSketchX(
    face: OC,
    ax2: OC,
    radius: number,
  ): OC;

  /**
   * Builds loft operation for the current OpenCascade build.
   */
  protected abstract buildLoftOperation(
    state: GroupBuildState,
    op: IRLoft,
  ): void;

  /**
   * Builds loft shape for the current OpenCascade build.
   */
  protected abstract buildLoftShape(
    state: GroupBuildState,
    op: IRLoft,
  ): {
    shape: OC;
    sourceAx2: OC;
  };

  /**
   * Coordinates revolve axis vectors as part of the OpenCascade build pipeline.
   */
  protected abstract revolveAxisVectors(
    state: GroupBuildState,
    op: IRRevolve,
    ax2: OC,
  ): {
    point: Vec3;
    dir: Vec3;
  };

  /**
   * Coordinates revolve body frame as part of the OpenCascade build pipeline.
   */
  protected abstract revolveBodyFrame(
    state: GroupBuildState,
    op: IRRevolve,
    ax2: OC,
  ): FaceFrame;

  /**
   * Creates revolve axis from vec for the current OpenCascade build.
   */
  protected abstract makeRevolveAxisFromVec(axis: {
    point: Vec3;
    dir: Vec3;
  }): OC;

  /**
   * Coordinates position loft wire as part of the OpenCascade build pipeline.
   */
  protected abstract positionLoftWire(
    state: GroupBuildState,
    sketchName: string,
    index: number,
    op: IRLoft,
    wpAx2: OC,
  ): OC;

  /**
   * Applies thru sections loft for the current OpenCascade build.
   */
  protected abstract applyThruSectionsLoft(op: IRLoft, wires: OC[]): OC;

  /**
   * Applies guided loft for the current OpenCascade build.
   */
  protected abstract applyGuidedLoft(
    state: GroupBuildState,
    op: IRLoft,
    wpAx2: OC,
  ): OC;

  /**
   * Translates shape for the current OpenCascade build.
   */
  protected abstract translateShape(
    shape: OC,
    dx: number,
    dy: number,
    dz: number,
  ): OC;

  /**
   * Ensures cylindrical wrap target for the current OpenCascade build.
   */
  protected abstract ensureCylindricalWrapTarget(
    state: GroupBuildState,
    placement: IRPlacement | null,
    span: SourceSpan,
  ): void;

  /**
   * Checks whether the supplied value meets the cylinder face condition.
   */
  protected abstract isCylinderFace(face: OC): boolean;

  /**
   * Checks whether the supplied value meets the cylinder surface type condition.
   */
  protected abstract isCylinderSurfaceType(type: unknown): boolean;

  /**
   * Extracts cylinder radius for the current OpenCascade build.
   */
  protected abstract extractCylinderRadius(face: OC): number;

  /**
   * Resolves the shared cylindrical-wrap geometry (center, frame axes, radius,
   * and rect-derived extents) used by both wrap-shape and wrap-cut builders.
   */
  protected abstract resolveCylindricalWrapGeometry(
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
  } | null;

  /**
   * Wraps rectangle primitive using the supplied shape and operation state.
   */
  protected abstract wrapRectanglePrimitive(
    state: GroupBuildState,
    sketchName: string,
  ): Extract<
    IRPrimitive,
    {
      kind: 'rect';
    }
  > | null;

  /**
   * Coordinates first cylinder radius as part of the OpenCascade build pipeline.
   */
  protected abstract firstCylinderRadius(
    state: GroupBuildState,
    objName: string,
  ): number;

  /**
   * Returns shape data for bounds center using the supplied shape and operation state.
   */
  protected abstract shapeBoundsCenter(shape: OC): Vec3;

  /**
   * Builds cylindrical wrap shape for the current OpenCascade build.
   */
  protected abstract buildCylindricalWrapShape(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
    depth: number,
    span: SourceSpan,
  ): OC | null;

  /**
   * Builds cylindrical wrap cut tool for the current OpenCascade build.
   */
  protected abstract buildCylindricalWrapCutTool(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
    through: boolean,
    depth: number | null,
    span: SourceSpan,
  ): OC | null;

  /**
   * Builds cylindrical wrap solid for the current OpenCascade build.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract buildCylindricalWrapSolid(
    cylCenter: Vec3,
    cylAxisDir: Vec3,
    refXDir: Vec3,
    innerRadius: number,
    outerRadius: number,
    centerAngleDeg: number,
    axialSize: number,
    sweepAngleDeg: number,
    span: SourceSpan,
  ): OC;

  /**
   * Builds rotate operation for the current OpenCascade build.
   */
  protected abstract buildRotateOperation(
    state: GroupBuildState,
    op: IRRotate,
  ): void;

  /**
   * Applies an IR rotate op to a shape and returns the resolved axis.
   * Callers need the same axis for both the OCCT shape transform and the
   * source-frame update that keeps later face labels aligned.
   */
  protected abstract rotateShapeForOperation(
    state: GroupBuildState,
    op: IRRotate,
    shape: OC,
  ): {
    shape: OC;
    axis: {
      point: Vec3;
      dir: Vec3;
    };
  };

  /**
   * Rotates one source component inside an explicit part.
   * M39 defers explicit-part additive bodies as separate components until final
   * output. Source names still point at the part owner, so rotating via owner
   * lookup would rotate or collapse the whole part instead of the requested
   * placed feature.
   */
  protected abstract rotateDeferredPartComponent(
    state: GroupBuildState,
    op: IRRotate,
    component: string,
  ): void;

  /**
   * Coordinates rotation axis as part of the OpenCascade build pipeline.
   */
  protected abstract rotationAxis(
    state: GroupBuildState,
    op: IRRotate,
  ): {
    point: Vec3;
    dir: Vec3;
  };

  /**
   * Resolves the source shape, body frame, and material for a pattern/mirror
   * operation, throwing a contextual error when the object is unknown.
   */
  protected abstract resolvePatternSource(
    state: GroupBuildState,
    objName: string,
    span: SourceSpan,
    context: string,
  ): { shape: OC; frame: FaceFrame; material: MaterialAppearance | null };

  /**
   * Builds pattern linear operation for the current OpenCascade build.
   */
  protected abstract buildPatternLinearOperation(
    state: GroupBuildState,
    op: IRPatternLinear,
  ): void;

  /**
   * Builds pattern radial operation for the current OpenCascade build.
   */
  protected abstract buildPatternRadialOperation(
    state: GroupBuildState,
    op: IRPatternRadial,
  ): void;

  /**
   * Builds mirror operation for the current OpenCascade build.
   */
  protected abstract buildMirrorOperation(
    state: GroupBuildState,
    op: IRMirror,
  ): void;

  /**
   * Resolves mirror plane for the current OpenCascade build.
   */
  protected abstract resolveMirrorPlane(
    state: GroupBuildState,
    plane: IRMirrorPlane,
    objName: string,
  ): OC;

  /**
   * Builds transform operation for the current OpenCascade build.
   */
  protected abstract buildTransformOperation(
    state: GroupBuildState,
    op: IRTransform,
  ): void;

  /**
   * Coordinates owner for as part of the OpenCascade build pipeline.
   */
  protected abstract ownerFor(state: GroupBuildState, name: string): string;

  /**
   * Registers body aliases for the current OpenCascade build.
   */
  protected abstract registerBodyAliases(
    state: GroupBuildState,
    owner: string,
    shape: OC,
  ): void;

  /**
   * Registers every source name in a unified part against the current fused
   * solid.
   * M39 keeps one coherent part topology, but source-level refs such as
   * `base.top` and `boss.top` must continue to resolve after each fuse/cut.
   */
  protected abstract registerPartSolidAliases(
    state: GroupBuildState,
    shape: OC,
  ): void;

  /**
   * Registers one explicit-part alias against its current deferred component.
   * Before modifiers or output force a full fuse, source refs still need to
   * resolve against the latest component topology, including cuts.
   */
  protected abstract registerPartSolidAliasComponent(
    state: GroupBuildState,
    alias: string,
    shape: OC,
  ): void;

  /**
   * Registers part solid alias shape for the current OpenCascade build.
   */
  protected abstract registerPartSolidAliasShape(
    state: GroupBuildState,
    alias: string,
    shape: OC,
    ownerFrame: FaceFrame,
  ): void;

  /**
   * Adds body for the current OpenCascade build.
   */
  protected abstract addBody(
    state: GroupBuildState,
    name: string,
    shape: OC,
    frame: FaceFrame,
    material: MaterialAppearance | null,
    _span?: SourceSpan,
    attachmentPlane?: SourceAttachmentPlane,
  ): void;

  /**
   * Fuses explicitly named bodies and aliases every fused source to the result.
   * Explicit parts already fuse additive solids by default. This operation
   * remains useful for default-scope geometry and for making user intent clear
   * when a later operation needs several named bodies to share topology.
   */
  protected abstract buildFuseOperation(
    state: GroupBuildState,
    op: IRFuse,
  ): void;

  /** Captures a fixed-owner explicit fuse for one native OCCT reduction. */
  protected abstract prepareNativeFuseOperation(
    state: GroupBuildState,
    op: IRFuse,
  ): PreparedNativeFuse | undefined;

  /** Applies fused ownership and label aliases only after geometry succeeds. */
  protected abstract commitFusedOwners(
    state: GroupBuildState,
    primary: string,
    owners: readonly string[],
    fused: OC,
    aliases: FusedAliasSources,
  ): void;

  /**
   * Coordinates fuse owner shapes as part of the OpenCascade build pipeline.
   */
  protected abstract fuseOwnerShapes(
    state: GroupBuildState,
    owners: string[],
    op: IRFuse,
  ): OC;

  /**
   * Coordinates fused alias sources as part of the OpenCascade build pipeline.
   */
  protected abstract fusedAliasSources(
    state: GroupBuildState,
    fusedOwners: Set<string>,
  ): FusedAliasSources;

  /**
   * Removes duplicate owners for fuse using the supplied shape and operation state.
   */
  protected abstract uniqueOwnersForFuse(
    state: GroupBuildState,
    op: IRFuse,
  ): string[];

  /**
   * Registers fused body aliases for the current OpenCascade build.
   */
  protected abstract registerFusedBodyAliases(
    state: GroupBuildState,
    owner: string,
    shape: OC,
    sourceShapes: Map<string, OC>,
    attachmentPlanes?: Map<string, SourceAttachmentPlane>,
  ): void;

  /**
   * Adds a generated solid into the running part solid.
   * Fillets need to see one coherent topology across all additive features in
   * a part, so later additions are fused immediately instead of compounded at
   * final mesh time.
   */
  protected abstract addBodyToPartSolid(
    state: GroupBuildState,
    name: string,
    shape: OC,
    frame: FaceFrame,
    material: MaterialAppearance | null,
    attachmentPlane?: SourceAttachmentPlane,
  ): void;

  /**
   * Replaces body for the current OpenCascade build.
   */
  protected abstract replaceBody(
    state: GroupBuildState,
    name: string,
    shape: OC,
  ): void;

  /**
   * Coordinates alias body as part of the OpenCascade build pipeline.
   */
  protected abstract aliasBody(
    state: GroupBuildState,
    alias: string,
    target: string,
    edgeMode?: BodyEdgeMode,
  ): void;

  /**
   * Coordinates alias part solid body as part of the OpenCascade build pipeline.
   */
  protected abstract aliasPartSolidBody(
    state: GroupBuildState,
    alias: string,
    target: string,
  ): void;

  /**
   * Copies part solid alias shape for the current OpenCascade build.
   */
  protected abstract copyPartSolidAliasShape(
    state: GroupBuildState,
    alias: string,
    target: string,
  ): void;

  /**
   * Copies part solid alias attachment plane for the current OpenCascade build.
   */
  protected abstract copyPartSolidAliasAttachmentPlane(
    state: GroupBuildState,
    alias: string,
    target: string,
  ): void;

  /**
   * Applies modifiers with trace for the current OpenCascade build.
   */
  protected abstract flushModifiersWithTrace(
    state: GroupBuildState,
    partName: string,
    trace?: OcctBuildTrace,
  ): void;

  /**
   * Applies modifiers for the current OpenCascade build.
   */
  protected abstract flushModifiers(state: GroupBuildState): void;

  /**
   * Applies split part modifier phase for the current OpenCascade build.
   */
  protected abstract applySplitPartModifierPhase(
    state: GroupBuildState,
    phaseOps: ModifierOp[],
  ): void;

  /**
   * Applies flushed modifier phase for the current OpenCascade build.
   */
  protected abstract applyFlushedModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
  ): void;

  /**
   * Applies deferred part modifier phase for the current OpenCascade build.
   */
  protected abstract applyDeferredPartModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
  ): void;

  /**
   * Applies fused modifier phase for the current OpenCascade build.
   */
  protected abstract applyFusedModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
  ): void;

  /**
   * Replaces deferred part component for the current OpenCascade build.
   */
  protected abstract replaceDeferredPartComponent(
    state: GroupBuildState,
    name: string,
    shape: OC,
  ): void;

  /**
   * Finalizes group build for the current OpenCascade build.
   */
  protected abstract finalizeGroupBuild(
    group: PartGroup,
    state: GroupBuildState,
    isolatedBodyNames: Set<string>,
    workplane: Workplane,
  ): FinalizedGroupBuild;

  // Sketch building
  /**
   * Builds surface data for material shapes using the supplied shape and operation state.
   */
  protected abstract surfaceMaterialShapes(
    state: GroupBuildState,
  ): BuiltMaterialShape[];

  /**
   * Finalizes empty group for the current OpenCascade build.
   */
  protected abstract finalizeEmptyGroup(
    state: GroupBuildState,
    surfaceMaterialShapes: BuiltMaterialShape[],
  ): FinalizedGroupBuild;

  /**
   * Registers named part group for the current OpenCascade build.
   */
  protected abstract registerNamedPartGroup(
    group: PartGroup,
    state: GroupBuildState,
    shape: OC,
    workplane: Workplane,
  ): void;

  /**
   * Coordinates final body shapes as part of the OpenCascade build pipeline.
   */
  protected abstract finalBodyShapes(state: GroupBuildState): Map<string, OC>;

  /**
   * Builds sketch face for the current OpenCascade build.
   */
  protected abstract buildSketchFace(prim: IRPrimitive, span: SourceSpan): OC;

  /**
   * Checks whether the supplied value meets the composite sketch condition.
   */
  protected abstract isCompositeSketch(prim: IRPrimitive): boolean;

  /**
   * Builds face from wire for the current OpenCascade build.
   */
  protected abstract buildFaceFromWire(
    wire: OC,
    kind: string,
    span: SourceSpan,
  ): OC;

  /**
   * Coordinates position face as part of the OpenCascade build pipeline.
   */
  protected abstract positionFace(face: OC, ax2: OC): OC;

  /**
   * Translates sketch shape for the current OpenCascade build.
   */
  protected abstract translateSketchShape(shape: OC, x: number, y: number): OC;

  /**
   * Rotates `shape` about an axis. `copy` selects whether OCCT duplicates the
   * shape (true) or transforms it in place (false).
   */
  protected abstract applyRotation(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
    copy: boolean,
  ): OC;

  /**
   * Rotates shape copy for the current OpenCascade build.
   */
  protected abstract rotateShapeCopy(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
  ): OC;

  /**
   * Rotates shape for the current OpenCascade build.
   */
  protected abstract rotateShape(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
  ): OC;

  /**
   * Builds wire for the current OpenCascade build.
   */
  protected abstract buildWire(prim: IRPrimitive, span: SourceSpan): OC;

  /**
   * Coordinates wire primitive builders as part of the OpenCascade build pipeline.
   */
  protected abstract wirePrimitiveBuilders(): Partial<
    Record<IRPrimitive['kind'], (prim: IRPrimitive) => OC>
  >;

  /**
   * Coordinates unsupported wire primitive error as part of the OpenCascade build pipeline.
   */
  protected abstract unsupportedWirePrimitiveError(
    prim: IRPrimitive,
    span: SourceSpan,
  ): OcctError;

  /**
   * Builds profile wire for the current OpenCascade build.
   */
  protected abstract buildProfileWire(segments: IRProfileSegment[]): OC;

  /**
   * Builds rect for the current OpenCascade build.
   */
  protected abstract buildRect(w: number, h: number): OC;

  /**
   * Builds rect at for the current OpenCascade build.
   */
  protected abstract buildRectAt(
    w: number,
    h: number,
    cx: number,
    cy: number,
  ): OC;

  /**
   * Builds circle for the current OpenCascade build.
   */
  protected abstract buildCircle(radius: number): OC;

  /**
   * Builds round rect for the current OpenCascade build.
   */
  protected abstract buildRoundRect(w: number, h: number, r: number): OC;

  /**
   * Builds arc edge for the current OpenCascade build.
   */
  protected abstract buildArcEdge(
    cx: number,
    cy: number,
    r: number,
    a0deg: number,
    a1deg: number,
  ): OC;

  /**
   * Builds triangle for the current OpenCascade build.
   */
  protected abstract buildTriangle(base: number, height: number): OC;

  /**
   * Builds polygon for the current OpenCascade build.
   */
  protected abstract buildPolygon(points: [number, number][]): OC;

  /**
   * Builds closed polyline wire for the current OpenCascade build.
   */
  protected abstract buildClosedPolylineWire(
    points: readonly (readonly [number, number])[],
  ): OC;

  /**
   * Creates xy circle for the current OpenCascade build.
   */
  protected abstract makeXYCircle(
    cx: number,
    cy: number,
    radius: number,
  ): {
    origin: OC;
    zDir: OC;
    xDir: OC;
    ax2: OC;
    circ: OC;
  };

  /**
   * Builds word shape for the current OpenCascade build.
   */
  protected abstract buildWordShape(
    text: string,
    size: number,
    fontName: IRFontRef,
    align: 'center' | 'left' | 'right',
    span: SourceSpan,
  ): OC;

  /**
   * Coordinates font attempts as part of the OpenCascade build pipeline.
   */
  protected abstract fontAttempts(fontName: IRFontRef): {
    kind: 'name' | 'path';
    value: string;
    label: string;
  }[];

  /**
   * Coordinates perform b rep text as part of the OpenCascade build pipeline.
   */
  protected abstract performBRepText(
    text: string,
    font: OC,
    align: 'center' | 'left' | 'right',
  ): OC;

  /**
   * Coordinates oc utf8 string as part of the OpenCascade build pipeline.
   */
  protected abstract ocUtf8String(value: string): OC;

  /**
   * Builds empty word marker for the current OpenCascade build.
   */
  protected abstract buildEmptyWordMarker(size: number): OC;

  // Geometry operations
  /**
   * Applies extrude for the current OpenCascade build.
   */
  protected abstract applyExtrude(
    face: OC,
    ax2: OC,
    depth: number,
    symmetric: boolean,
    span: SourceSpan,
  ): OC;

  /**
   * Builds cut tool for the current OpenCascade build.
   */
  protected abstract buildCutTool(
    sketchFace: OC,
    ax2: OC,
    targetShape: OC,
    depth: number | null,
    span: SourceSpan,
  ): OC;

  /**
   * Coordinates cut depth toward shape as part of the OpenCascade build pipeline.
   */
  protected abstract cutDepthTowardShape(
    ax2: OC,
    targetShape: OC,
    depth: number,
  ): number;

  /**
   * Returns the center of a shape's bounding box.
   */
  protected abstract shapeCenter(shape: OC): Vec3;

  /**
   * Returns shape data for diagonal using the supplied shape and operation state.
   */
  protected abstract shapeDiagonal(shape: OC): number;

  /**
   * Applies bool cut for the current OpenCascade build.
   */
  protected abstract applyBoolCut(target: OC, tool: OC, span: SourceSpan): OC;

  /** Confirms the runtime still has the compiler-proven single target revision. */
  protected abstract canStartNativeBatch(
    state: GroupBuildState,
    targetName: string,
  ): boolean;

  /** Confirms that explicit fuses can use the native parallel builder. */
  protected abstract canStartNativeExplicitFuse(): boolean;

  /**
   * Coordinates native batch target shape as part of the OpenCascade build pipeline.
   */
  protected abstract nativeBatchTargetShape(
    state: GroupBuildState,
    targetName: string,
  ): OC | undefined;

  /**
   * Checks whether the supplied value meets the finalize deferred part as compound condition.
   */
  protected abstract canFinalizeDeferredPartAsCompound(
    state: GroupBuildState,
  ): boolean;

  /**
   * Coordinates final renderable shapes as part of the OpenCascade build pipeline.
   */
  protected abstract finalRenderableShapes(
    state: GroupBuildState,
  ): Map<string, OC>;

  /**
   * Applies part solid for the current OpenCascade build.
   */
  protected abstract flushPartSolid(
    state: GroupBuildState,
    span?: SourceSpan,
  ): OC | null;

  /**
   * Builds compound for the current OpenCascade build.
   */
  protected abstract buildCompound(shapes: OC[]): OC;

  /**
   * Applies modifier phase for the current OpenCascade build.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract applyModifierPhase(
    state: GroupBuildState,
    ops: ModifierOp[],
    labelMap: FaceLabelMap,
    ownerFor: (name: string) => string,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
  ): void;

  /**
   * Applies draft phase for the current OpenCascade build.
   */
  protected abstract applyDraftPhase(
    owner: string,
    ops: IRDraft[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
  ): void;

  /**
   * Applies blend modifier phase for the current OpenCascade build.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract applyBlendModifierPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    state: GroupBuildState,
    excludedEdges?: unknown[],
  ): EdgeSelection[];

  /**
   * Collects blend selections for phase for the current OpenCascade build.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract collectBlendSelectionsForPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    state: GroupBuildState,
    shape: OC,
    excludedEdges: unknown[],
  ): EdgeSelection[];

  /**
   * Routes eligible loft-cut edge blends through their original cutter.
   *
   * Why: the cut's closed rim can split into artificial edges and select the
   * wrong blend side; the source loft retains the exact closed contour.
   */
  protected abstract tryApplySolidCutToolBlend(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    state: GroupBuildState,
  ): boolean;

  /**
   * Expands blend selections for the current OpenCascade build.
   */
  protected abstract expandBlendSelections(
    kind: BlendModifierKind,
    owner: string,
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[];

  /**
   * Applies blend selections for phase for the current OpenCascade build.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract applyBlendSelectionsForPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    shape: OC,
    objName: string,
    expandedSelections: EdgeSelection[],
  ): boolean;

  /**
   * Retries blend selections for phase for the current OpenCascade build.
   */
  protected abstract retryBlendSelectionsForPhase(
    request: BlendRetryRequest,
    err: unknown,
  ): boolean;

  /**
   * Applies connected blend retry for the current OpenCascade build.
   */
  protected abstract applyConnectedBlendRetry(
    request: BlendRetryRequest,
    err: OcctError,
  ): boolean;

  /**
   * Converts a non-fatal blend failure into a validation result.
   * Fillet/chamfer radii can be locally invalid while the rest of the model is
   * still useful. Reporting them as validations keeps the mesh and later blend
   * operations available while preserving the source-mapped error.
   */
  protected abstract blendFailureValidation(error: OcctError): ValidationResult;

  /**
   * Emits opt-in preview meshes for blend edge selections.
   * OCCT can accept a blend and return a valid but geometrically wrong result.
   * Rendering the exact pre-blend edge loops makes selector errors visually
   * separable from fillet-builder failures.
   */
  protected abstract captureDebugBlendEdges(
    state: GroupBuildState,
    _kind: BlendModifierKind,
    selections: EdgeSelection[],
  ): void;

  /**
   * Coordinates debug closed planar edge mesh as part of the OpenCascade build pipeline.
   */
  protected abstract debugClosedPlanarEdgeMesh(
    edge: unknown,
  ): Omit<MeshData, 'partName' | 'color'> | null;

  /**
   * Checks whether the supplied value meets the skip consumed source blend condition.
   */
  protected abstract canSkipConsumedSourceBlend(
    owner: string,
    labelMap: FaceLabelMap,
    selections: EdgeSelection[],
  ): boolean;

  /**
   * Retries a failed blend by source target before graph connectivity.
   * A fused part has one body, but selectors such as `r.top.edges` and
   * `rr.top.edges` still describe independent source features. OCCT can reject
   * a large combined fillet set even when each feature fillets cleanly. If one
   * target still fails, record that target as a validation error and keep later
   * blend targets moving so one bad radius does not suppress unrelated details.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract tryBlendByTargetGroups(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    replaceName: string,
    recordValidation: (validation: ValidationResult) => void,
  ): boolean;

  /**
   * Applies a blend batch, then falls back to connected sub-batches if needed.
   * Fused part selectors can resolve to several disconnected edge islands for a
   * single source feature after later geometry splits an edge. OCCT may reject
   * the whole selector batch even though each island remains valid.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract applyBlendBatchWithConnectedRetry(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    span: SourceSpan,
    replaceCurrentShape: (shape: OC) => void,
    initialError?: OcctError,
  ): OC;

  /**
   * Applies connected blend batches after failure for the current OpenCascade build.
   */
  // fallow-ignore-next-line code-duplication
  protected abstract applyConnectedBlendBatchesAfterFailure(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    span: SourceSpan,
    replaceCurrentShape: (shape: OC) => void,
    err: OcctError,
  ): OC;

  /**
   * Builds group state for selections by target using the supplied shape and operation state.
   */
  protected abstract groupSelectionsByTarget(
    selections: EdgeSelection[],
  ): EdgeSelection[][];

  /**
   * Selects again target blend selections for the current OpenCascade build.
   */
  protected abstract reselectTargetBlendSelections(
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[];

  /**
   * Collects blend edge selections for the current OpenCascade build.
   */
  protected abstract collectBlendEdgeSelections(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    state: GroupBuildState,
    excludedEdges?: unknown[],
    ownerShape?: OC,
  ): EdgeSelection[];

  /**
   * Coordinates blend edges for operation as part of the OpenCascade build pipeline.
   */
  protected abstract blendEdgesForOperation(
    labelMap: FaceLabelMap,
    op: BlendModifierOp,
    sourceObjName: string,
    excludedEdges: unknown[],
    ownerShape?: OC,
  ): unknown[];

  /**
   * Coordinates blend edges for target as part of the OpenCascade build pipeline.
   */
  protected abstract blendEdgesForTarget(
    labelMap: FaceLabelMap,
    target: string,
    selection: import('@bushscad/ir').ResolvedSelectionTarget | undefined,
    ownerShape?: OC,
  ): unknown[];

  /**
   * Resolves edge data for belongs to source using the supplied shape and operation state.
   */
  protected abstract edgeBelongsToSource(
    edge: unknown,
    sourceObjName: string,
  ): boolean;

  /**
   * Adds blend edge selections for the current OpenCascade build.
   */
  protected abstract addBlendEdgeSelections(
    selections: EdgeSelection[],
    edges: unknown[],
    kind: BlendModifierKind,
    owner: string,
    op: BlendModifierOp,
    value: number,
  ): void;

  /**
   * Adds blend edge selection for the current OpenCascade build.
   */
  protected abstract addBlendEdgeSelection(
    selections: EdgeSelection[],
    edge: unknown,
    kind: BlendModifierKind,
    owner: string,
    op: BlendModifierOp,
    value: number,
  ): void;

  /**
   * Compares a broad selector candidate against an already-claimed edge.
   * Earlier feature-specific blends reserve their edges for later broad
   * selectors. Re-resolving those feature targets after a fillet can overmatch,
   * so the exclusion follows the concrete edge handle and its endpoints.
   */
  protected abstract edgesMatchForExclusion(
    claimed: unknown,
    candidate: unknown,
  ): boolean;

  /**
   * Expands selected fillet edges across tangent-connected neighbors.
   * Fused features often split circular or swept edges into multiple OCCT
   * edge handles. A user-facing fillet selector should wrap the smooth chain
   * instead of stopping at an artificial fuse seam.
   */
  protected abstract expandFilletTangentSelections(
    owner: string,
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[];

  /**
   * Expands tangent selection for the current OpenCascade build.
   */
  protected abstract expandTangentSelection(
    owner: string,
    current: EdgeSelection,
    candidates: unknown[],
    expanded: EdgeSelection[],
    queued: EdgeSelection[],
  ): void;

  /**
   * Determines whether the supplied value meets the propagate tangent edge condition.
   */
  protected abstract shouldPropagateTangentEdge(
    current: EdgeSelection,
    edge: unknown,
    expanded: EdgeSelection[],
  ): boolean;

  /**
   * Limits tangent expansion to edges that still belong to the target selector.
   * Fused shapes can contain tangent or coincident seams from unrelated source
   * features. Expansion should continue split edges for the same selector, not
   * implicitly add a boss/base seam to `flange.bottom.edges`.
   */
  protected abstract targetScopedTangentCandidates(
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): unknown[];

  /**
   * Coordinates edges are tangent connected as part of the OpenCascade build pipeline.
   */
  protected abstract edgesAreTangentConnected(a: unknown, b: unknown): boolean;

  /**
   * Coordinates edges touch as part of the OpenCascade build pipeline.
   */
  protected abstract edgesTouch(a: unknown, b: unknown): boolean;

  /**
   * Resolves edge data for direction using the supplied shape and operation state.
   */
  protected abstract edgeDirection(edge: unknown): Vec3 | null;

  /**
   * Performs a conservative pre-check for obviously impossible fillet radii.
   * OCCT can throw low-level exceptions for self-intersecting blends. When the
   * local limit is obvious from the target bounds, report a source-mapped
   * diagnostic before invoking the builder.
   */
  protected abstract rejectOversizedFillets(
    shape: OC,
    selections: EdgeSelection[],
  ): void;

  /**
   * Estimates fillet radius limit for the current OpenCascade build.
   */
  protected abstract estimateFilletRadiusLimit(shape: OC): number | null;

  /**
   * Applies blend batch for the current OpenCascade build.
   */
  protected abstract applyBlendBatch(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC;

  /**
   * Coordinates plan connected blend batches as part of the OpenCascade build pipeline.
   */
  protected abstract planConnectedBlendBatches(
    selections: EdgeSelection[],
  ): EdgeSelectionBatch[] | null;

  /**
   * Selects again connected blend batch for the current OpenCascade build.
   */
  protected abstract reselectConnectedBlendBatch(
    batch: EdgeSelectionBatch,
    labelMap: FaceLabelMap,
  ): EdgeSelection[];

  /**
   * Applies fillet batch for the current OpenCascade build.
   */
  protected abstract applyFilletBatch(
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC;

  /**
   * Applies chamfer batch for the current OpenCascade build.
   */
  protected abstract applyChamferBatch(
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC;

  /**
   * Builds neutral plane for the current OpenCascade build.
   */
  protected abstract buildNeutralPlane(oc: OC, shape: OC): OC;

  /**
   * Applies draft for the current OpenCascade build.
   */
  protected abstract applyDraft(
    shape: OC,
    faces: unknown[],
    angleDeg: number,
    neutralPlane: OC,
    span: SourceSpan,
  ): OC;

  // Mesh extraction
  /**
   * Extracts mesh for the current OpenCascade build.
   */
  protected abstract extractMesh(
    shape: OC,
  ): Omit<MeshData, 'partName' | 'color'>;

  /**
   * Builds name→shape and name→color lookup maps from built parts, indexing by
   * body name first and falling back to the part group name.
   */
  protected abstract collectShapeAndColorMaps(builtParts: BuiltPart[]): {
    shapeMap: Map<string, OC>;
    colorMap: Map<string, string>;
  };

  // Export
  /**
   * Coordinates export program as part of the OpenCascade build pipeline.
   */
  protected abstract exportProgram(
    program: IRProgram,
    format: ExportFormat,
    drawingProgram?: DrawingProgram,
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit?: number,
  ): {
    buffers: {
      name: string;
      data: ArrayBuffer;
    }[];
    drawings: DrawingResult[];
  };

  /**
   * Coordinates export shape as part of the OpenCascade build pipeline.
   */
  protected abstract exportShape(
    shape: OC,
    name: string,
    format: ExportFormat,
  ): {
    name: string;
    data: ArrayBuffer;
  };

  // Path and Sweep operations
  /**
   * Builds path operation for the current OpenCascade build.
   */
  protected abstract buildPathOperation(
    state: GroupBuildState,
    op: IRPath,
  ): void;

  /**
   * Stores a path wire built from a single OCCT edge.
   */
  protected abstract storeBuiltPathWire(
    state: GroupBuildState,
    name: string,
    edge: OC,
    failureMessage: string,
    span: SourceSpan,
  ): void;

  /**
   * Builds sweep solid for the current OpenCascade build.
   */
  protected abstract buildSweepSolid(
    state: GroupBuildState,
    sketchName: string,
    pathName: string,
    orientation: string,
    span: SourceSpan,
  ): OC;

  /**
   * Builds sweep operation for the current OpenCascade build.
   */
  protected abstract buildSweepOperation(
    state: GroupBuildState,
    op: IRSweep,
  ): void;

  /**
   * Builds sweep cut operation for the current OpenCascade build.
   */
  protected abstract buildSweepCutOperation(
    state: GroupBuildState,
    op: IRSweepCut,
  ): void;
}
