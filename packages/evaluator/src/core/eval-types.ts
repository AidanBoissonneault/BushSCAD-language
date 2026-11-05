/**
 * @author Aidan Boissonneault
 * @file eval-types.ts
 * @purpose Evaluates types for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRPlacement,
  IRFontRef,
  IRFit,
  MaterialAppearance,
  MaterialContext,
  CompileError,
  IROp,
  IRPrimitive,
  IRFillet,
  IRChamfer,
  IRDraft,
  SourceSpan,
  // AST types
  ComponentBody,
  FnDecl,
  AutoExpr,
  Workplane,
} from '@bushscad/ir';

/**
 * Result of evaluate, including program, drawings, and errors.
 */
export type EvaluateResult = {
  program: import('@bushscad/ir').IRProgram;
  drawings: import('@bushscad/ir').DrawingProgram;
  errors: CompileError[];
};

/**
 * Env override value accepts number, string, boolean, and EnvOverrideValue[].
 */
export type EnvOverrideValue = number | string | boolean | EnvOverrideValue[];

/**
 * Options for evaluate, including env, materials, and show hardware visuals.
 */
export type EvaluateOptions = {
  env?: Record<string, EnvOverrideValue>;
  materials?: MaterialContext;
  showHardwareVisuals?: boolean;
  /** Source locations whose loop bindings are needed by conditional cache breakpoints. */
  cacheContextSpans?: readonly Pick<SourceSpan, 'file' | 'line'>[];
};

/**
 * Interaction invocation trace, including name, span, link span, and output names.
 */
export type InteractionInvocationTrace = {
  name: string;
  span: SourceSpan;
  linkSpan: SourceSpan;
  outputNames: string[];
};

// Value types

/** Represents any value that can appear in an evaluator environment. */
// IRPlacement is included so @ expressions can be stored as values in lists
export type EvalValue =
  | number
  | string
  | boolean
  | EvalValue[]
  | readonly [number, number]
  | IRPlacement
  | FaceRefValue
  | Exclude<IRFontRef, string>;

/**
 * Face ref value, including operation kind and display label.
 */
export type FaceRefValue = {
  kind: 'faceRefValue';
  label: string;
};

/**
 * Measurements for face, including width, height, area, normal, and center.
 */
export interface FaceMetrics {
  width: number;
  height: number;
  area: number;
  normal: string;
  center: IRPlacement;
}

/**
 * Accepted values for anchor face dir are 'top', 'bottom', 'front', 'back', 'left', and 'right'.
 */
export type AnchorFaceDir =
  'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/**
 * Measurements for solid, including width, height, and depth.
 */
export interface SolidMetrics {
  width: number;
  height: number;
  depth: number;
}

/**
 * Type used for metadata for anchor.
 */
export type AnchorMetadata = NonNullable<IRPlacement['anchor']>;

/**
 * Derives `PlantAnchorInfo` from `AnchorMetadata & { faceName?: string; }` to preserve its type
 * relationship in the core layer.
 */
export type PlantAnchorInfo = AnchorMetadata & {
  faceName?: string;
};

// Part snapshot

/** Snapshot of a part's resolved name/tag maps, kept for external member access. */
export type PartSnapshot = {
  names: Map<string, string>;
  tags: Map<string, FaceRefValue>;
};

/** Static declaration-name facts memoized for the lifetime of one evaluation. */
export type BodyNameFacts = {
  localNames: readonly string[];
  objectNames: readonly string[];
};

// Eval context

/** Execution context threaded through all evaluator functions. Mutable per-scope. */
export interface EvalCtx {
  workplane: Workplane;
  bodyNameFacts: WeakMap<ComponentBody, BodyNameFacts>;
  values: Map<string, EvalValue>;
  names: Map<string, string>; // AST sketch/obj name → IR name (mangled in loops)
  components: Map<string, ComponentBody>;
  functions: Map<string, FnDecl>;
  sketches: Map<string, IRPrimitive>;
  sketchComponentMembers: Set<string>;
  sketchPlacements: Map<string, IRPlacement | null>;
  sketchExplicitPlacements: Map<string, boolean>;
  surfaceBoundSketches: Map<string, IRPlacement>;
  surfaceBoundSketchUses: Map<string, number>;
  faceMetrics: Map<string, FaceMetrics>;
  solidMetrics: Map<string, SolidMetrics>;
  plantAnchors: Map<string, PlantAnchorInfo>;
  spatialAliases: Map<string, IRPlacement>;
  tags: Map<string, FaceRefValue>;
  placedInstanceRoots: Map<string, string>;
  thisContext: FaceMetrics | null;
  autoContext: { x?: number; y?: number } | null; // transient parent-face `auto` value
  autoAxis: 'x' | 'y' | null; // axis the current `auto` resolves against
  autoGroups: Map<AutoExpr, number> | null; // within-loop: `auto` node → group index
  autoValues: number[] | null; // within-loop: per-group value, this iteration
  activePlacement: IRPlacement | null;
  activeColor: string | null;
  activeMaterial: MaterialAppearance | null;
  objectColorOverrides: Map<string, string>;
  objectMaterialOverrides: Map<string, MaterialAppearance>;
  activePartName: string | null;
  partsSnapshot: Map<string, PartSnapshot>;
  materialScopes: string[];
  materialContext: MaterialContext;
  baseUnitMm: number;
  envOverrides: Map<string, EnvOverrideValue>;
  ops: IROp[];
  interactionInvocations: InteractionInvocationTrace[];
  errors: CompileError[];
  counter: { n: number };
  holeRecipes: Map<string, HoleStep[]>;
  cutThreads: Map<string, ThreadTargetInfo>;
  refBases: Map<string, string>; // ref name → IR shape name (for ref-extends placement)
  activeProcessProfile: string | null; // e.g. 'std.printing.fdm', set by 'use' eval
  fitDecls: Map<string, IRFit>; // fitName → resolved IRFit, for fit_ok() lookup
  emitHardwareVisuals: boolean; // controlled by EvaluateOptions.showHardwareVisuals
  cacheContextSpans: ReadonlySet<string>;
}

/** Deferred modifier ops (fillets, chamfers, drafts) collected during body evaluation. */
export type Deferred = (IRFillet | IRChamfer | IRDraft)[];

// Type guards

/**
 * Returns whether the input meets the `IR placement` condition.
 */
export function isIRPlacement(v: EvalValue | undefined): v is IRPlacement {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    !('0' in (v as object)) &&
    'faceRef' in (v as object)
  );
}

/**
 * Returns whether the input meets the `face ref value` condition.
 */
export function isFaceRefValue(v: EvalValue | undefined): v is FaceRefValue {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    'kind' in (v as object) &&
    (v as { kind?: unknown }).kind === 'faceRefValue'
  );
}

/**
 * Returns whether the input meets the `point tuple` condition.
 */
export function isPointTuple(
  v: EvalValue | undefined,
): v is readonly [number, number] {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number'
  );
}

/**
 * Handles value type in the core flow.
 */
export function valueType(v: EvalValue): string {
  if (isFaceRefValue(v)) return 'face reference';
  return Array.isArray(v) ? 'list' : typeof v;
}

/**
 * Returns whether the input meets the `IR font asset ref` condition.
 */
export function isIRFontAssetRef(
  v: EvalValue | undefined,
): v is Exclude<IRFontRef, string> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    'kind' in (v as object) &&
    (v as { kind?: unknown }).kind === 'fontAsset'
  );
}

// Hole recipe (for pattern unrolling)

/** One sketch+cut step within a hole operation, stored so patterns can repeat it. */
export type HoleStep = {
  sketchIrName: string;
  objIrName: string;
  diameterMm: number;
  through: boolean;
  throughTarget: string | null;
  depthMm: number | null;
  placement: IRPlacement;
  span: SourceSpan;
};

/** Placement and axial depth retained so internal thread geometry follows the cut. */
type ThreadTargetInfo = {
  placement: IRPlacement;
  depthMm: number | null;
};

// Utility types

/**
 * Parsed anchor label, including obj name, face, named face, sub ref, and corner arg.
 */
export type ParsedAnchorLabel = {
  objName: string;
  face?: AnchorFaceDir;
  namedFace?: string;
  subRef?: 'center' | 'corner' | 'edge';
  cornerArg?: string;
  edgeArg?: string;
};
