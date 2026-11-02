/**
 * @author Aidan Boissonneault
 * @file bridge-types.ts
 * @purpose Provides bridge types behavior for the bridge in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  IRChamfer,
  IRDraft,
  IRFillet,
  IRFit,
  IRHardwareVisual,
  InteractionSnapshot,
  IRPrimitive,
  MaterialAppearance,
  MeshData,
  OcctTraceEvent,
  OcctError,
  ResolvedSelectionTarget,
  ResolvedJointData,
  SourceSpan,
  ValidationResult,
  Workplane,
  DrawingResult,
  PreparedComponentArtifact,
} from '@bushscad/ir';
import type { FaceLabelMap, FaceFrame } from '../topology/face-labels.js';
import type { Vec3 } from '../core/geometry-utils.js';
import type { PartGroup } from '../core/program-utils.js';
import type { SourceAttachmentPlane } from '../topology/source-edge-recovery.js';
import type { OcctBuildTrace } from '../operations/build-trace.js';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OC = any;

/**
 * Modifier op accepts IRFillet, IRChamfer, and IRDraft.
 */
export type ModifierOp = IRFillet | IRChamfer | IRDraft;
/**
 * Blend modifier op accepts IRFillet and IRChamfer.
 */
export type BlendModifierOp = IRFillet | IRChamfer;
/**
 * Derives `BlendModifierKind` from `BlendModifierOp['kind']` to preserve its type relationship in the
 * bridge layer.
 */
export type BlendModifierKind = BlendModifierOp['kind'];

/**
 * Modifier body group, including owner and ops.
 */
export interface ModifierBodyGroup {
  owner: string;
  ops: ModifierOp[];
}

/**
 * Selection of edge, including edge, display value, target, span, and selection.
 */
export interface EdgeSelection {
  edge: unknown;
  value: number;
  target: string;
  span: SourceSpan;
  selection?: ResolvedSelectionTarget;
}

/**
 * Selection of connected edge, including vertex keys and edge key.
 */
export interface ConnectedEdgeSelection extends EdgeSelection {
  vertexKeys: [string, string];
  edgeKey: string;
}

/**
 * Edge selection batch, including selections.
 */
export interface EdgeSelectionBatch {
  selections: ConnectedEdgeSelection[];
}

/**
 * Metadata for solid cut alias, including target name, target shape, tool shape, result shape,
 * and tool kind.
 */
export interface SolidCutAliasMetadata {
  targetName: string;
  targetShape: OC;
  toolShape: OC;
  resultShape: OC;
  toolKind?: string;
}

/**
 * Result of build is tagged by ok: 'true' carries meshes, validations, drawings and 'false'
 * carries error.
 */
export type BuildResult =
  | {
      ok: true;
      meshes: MeshData[];
      validations: ValidationResult[];
      drawings: DrawingResult[];
      joints: ResolvedJointData[];
      interaction?: InteractionSnapshot;
      occtTraceEvents?: OcctTraceEvent[];
    }
  | { ok: false; error: OcctError; occtTraceEvents?: OcctTraceEvent[] };

/**
 * Result of export is tagged by ok: 'true' carries buffers, drawings and 'false' carries error.
 */
export type ExportResult =
  | {
      ok: true;
      buffers: { name: string; data: ArrayBuffer }[];
      drawings: DrawingResult[];
    }
  | { ok: false; error: OcctError };

/**
 * Result of prepare component is tagged by ok: 'true' carries artifact and 'false' carries
 * error.
 */
export type PrepareComponentResult =
  | { ok: true; artifact: PreparedComponentArtifact }
  | { ok: false; error: OcctError };

/**
 * Built material shape, including shape, material, body name, and is open surface.
 */
export type BuiltMaterialShape = {
  shape: OC;
  material: MaterialAppearance | null;
  bodyName?: string; // set when this shape maps to exactly one named body
  isOpenSurface?: boolean;
};

/**
 * Built part, including group, shape, label map, material shapes, and validations.
 */
export type BuiltPart = {
  group: PartGroup;
  shape: OC;
  labelMap: FaceLabelMap;
  materialShapes: BuiltMaterialShape[];
  validations: ValidationResult[];
  joints: ResolvedJointData[];
  interactionSelectionCounts: Map<string, number>;
  interactionSelectionValues: Map<string, readonly string[]>;
  // Fully-resolved body name → OCCT shape map (aliases included). Valid until deleteBuiltPartShapes runs.
  bodyShapes: Map<string, OC>;
  hardwareVisuals: Array<{
    op: IRHardwareVisual;
    mesh: Omit<MeshData, 'partName' | 'color'>;
  }>;
  debugBlendEdgeMeshes: Array<{
    target: string;
    mesh: Omit<MeshData, 'partName' | 'color'>;
  }>;
};

/**
 * Accepted values for body edge mode are 'outer', 'inner', and 'all'.
 */
export type BodyEdgeMode = 'outer' | 'inner' | 'all';

/**
 * State for group build, including trace, interaction selection counts, interaction selection
 * values, label map, and global labels.
 */
export type GroupBuildState = {
  trace?: OcctBuildTrace;
  interactionSelectionCounts: Map<string, number>;
  interactionSelectionValues: Map<string, readonly string[]>;
  labelMap: FaceLabelMap;
  // Shared across all part groups — imported/ref shapes register here so a
  // `place` in a later part can resolve a shape declared at top level.
  globalLabels: FaceLabelMap;
  // Names of shapes that are declarations only (imported shapes, refs). They
  // are not rendered in the group that declares them — only their placed
  // copies render, in the group where the `place` happens.
  declaredShapeNames: Set<string>;
  defaultWorkplane: Workplane;
  sketchPrimitives: Map<string, IRPrimitive>;
  sketchFaces: Map<string, OC>;
  sketchWires: Map<string, OC>;
  sketchAxes: Map<string, OC>;
  surfaceBoundSketches: Map<string, import('@bushscad/ir').IRPlacement>;
  pathWires: Map<string, OC>;
  surfaceShapes: Map<string, OC>;
  surfaceNormals: Map<string, Vec3>;
  surfaceMaterials: Map<string, MaterialAppearance | null>;
  bodyShapes: Map<string, OC>;
  bodyMaterials: Map<string, MaterialAppearance | null>;
  bodyOwners: Map<string, string>;
  bodyEdgeModes: Map<string, BodyEdgeMode>;
  bodyFrames: Map<string, FaceFrame>;
  bodyAttachmentPlanes: Map<string, SourceAttachmentPlane>;
  partSolidOwner: string | null;
  partSolid: OC | null;
  partSolidAliases: Set<string>;
  partSolidComponents: Map<string, OC>;
  partSolidAliasComponents: Map<string, string>;
  partSolidAliasShapes: Map<string, OC>;
  partSolidAliasAttachmentPlanes: Map<string, SourceAttachmentPlane>;
  solidCutAliases: Map<string, SolidCutAliasMetadata>;
  preservedPartComponents: Set<string>;
  pendingModifiers: ModifierOp[];
  modifierValidations: ValidationResult[];
  fitMetadata: Map<string, IRFit>; // fitName → IRFit, for provenance reporting
  hardwareVisuals: Array<{
    op: IRHardwareVisual;
    mesh: Omit<MeshData, 'partName' | 'color'>;
  }>;
  debugBlendEdgeMeshes: Array<{
    target: string;
    mesh: Omit<MeshData, 'partName' | 'color'>;
  }>;
};
