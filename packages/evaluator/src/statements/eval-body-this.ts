/**
 * @author Aidan Boissonneault
 * @file eval-body-this.ts
 * @purpose Evaluates body this for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ComponentBody,
  ComponentStatement,
  FaceRef,
  CutOp,
  ExtrudeOp,
  HeatsetInsertOp,
  HoleOp,
  LoftOp,
  RadialCutOp,
  RadialExtrudeOp,
  RevolveOp,
  SketchInput,
  SolidPrimitiveOp,
  SolidCutOp,
  PosRef,
  RepeatableFaceRef,
  RepeatableSpatialRef,
  SweepCutOp,
  SweepOp,
  ThickenOp,
} from '@bushscad/ir';
import {
  expandRepeatableFaceRef,
  expandRepeatableSpatialRef,
} from '@bushscad/ir';
import { exprUsesThis, primitiveUsesThis } from '../sketch/eval-sketch-this.js';
import {
  pathInputUsesThis,
  surfaceInputUsesThis,
} from './eval-reference-this.js';

/** Detects whether a component body depends on the caller's `this.` context. */
export function bodyUsesThis(body: ComponentBody): boolean {
  return body.statements.some(componentStmtUsesThis);
}

/** Checks whether a face reference or its inline geometry uses caller context. */
function faceRefUsesCallerContext(ref: FaceRef): boolean {
  return (
    (ref.surfaceAngle ? exprUsesThis(ref.surfaceAngle) : false) ||
    (ref.inlineOperation
      ? objOpUsesThis(ref.inlineOperation as ObjectThisOp)
      : false)
  );
}

/** Checks all expanded face selectors for inline operations that use `this.`. */
function repeatableFaceRefUsesCallerContext(ref: RepeatableFaceRef): boolean {
  return expandRepeatableFaceRef(ref).some(faceRefUsesCallerContext);
}

/** Checks a placement and its inline reference geometry for caller context. */
function placementUsesCallerContext(ref: RepeatableSpatialRef): boolean {
  return expandRepeatableSpatialRef(ref).some((item) =>
    item.kind === 'pos'
      ? posRefUsesCallerContext(item)
      : faceRefUsesCallerContext(item),
  );
}

/** Checks a position reference and any inline operation used by its anchor. */
function posRefUsesCallerContext(ref: PosRef): boolean {
  return (
    (Array.isArray(ref.anchor)
      ? ref.anchor.some(exprUsesThis)
      : faceRefUsesCallerContext(ref.anchor)) ||
    [ref.x, ref.y, ref.radius, ref.angle, ref.offset].some((expression) =>
      expression ? exprUsesThis(expression) : false,
    )
  );
}

/**
 * Handles sketch input uses this in the statements flow.
 */
function sketchInputUsesThis(input: SketchInput): boolean {
  if (input.kind === 'sketchList') return input.items.some(sketchInputUsesThis);
  return input.kind === 'inlineSketch' && primitiveUsesThis(input.primitive);
}

const COMPONENT_STMT_THIS_CHECKS: Partial<
  Record<ComponentStatement['kind'], (stmt: ComponentStatement) => boolean>
> = {
  var: (stmt) => (stmt.kind === 'var' ? exprUsesThis(stmt.value) : false),
  sketch: (stmt) => (stmt.kind === 'sketch' ? sketchStmtUsesThis(stmt) : false),
  surface: (stmt) =>
    stmt.kind === 'surface' ? surfaceStmtUsesThis(stmt) : false,
  obj: (stmt) =>
    stmt.kind === 'obj'
      ? objOpUsesThis(stmt.operation) ||
        stmt.anchors.some((anchor) => placementUsesCallerContext(anchor.point))
      : false,
  anonymousObj: (stmt) =>
    stmt.kind === 'anonymousObj' ? objOpUsesThis(stmt.operation) : false,
  refObj: (stmt) =>
    stmt.kind === 'refObj' ? objOpUsesThis(stmt.operation) : false,
  fn: (stmt) => (stmt.kind === 'fn' ? bodyUsesThis(stmt.body) : false),
  return: (stmt) => (stmt.kind === 'return' ? bodyUsesThis(stmt.body) : false),
  callStmt: (stmt) =>
    stmt.kind === 'callStmt' ? callStmtUsesThis(stmt) : false,
  for: (stmt) => (stmt.kind === 'for' ? bodyUsesThis(stmt.body) : false),
  if: (stmt) => (stmt.kind === 'if' ? ifStmtUsesThis(stmt) : false),
  place: (stmt) => (stmt.kind === 'place' ? placeStmtUsesThis(stmt) : false),
  rotate: (stmt) => (stmt.kind === 'rotate' ? rotateStmtUsesThis(stmt) : false),
  metadata: (stmt) =>
    stmt.kind === 'metadata'
      ? stmt.property === 'material' && exprUsesThis(stmt.value)
      : false,
  fillet: (stmt) =>
    stmt.kind === 'fillet'
      ? repeatableFaceRefUsesCallerContext(stmt.target) ||
        exprUsesThis(stmt.radius)
      : false,
  chamfer: (stmt) =>
    stmt.kind === 'chamfer'
      ? repeatableFaceRefUsesCallerContext(stmt.target) ||
        exprUsesThis(stmt.offset)
      : false,
  draft: (stmt) =>
    stmt.kind === 'draft'
      ? repeatableFaceRefUsesCallerContext(stmt.target) ||
        exprUsesThis(stmt.angle)
      : false,
  shell: (stmt) =>
    stmt.kind === 'shell' ? exprUsesThis(stmt.thickness) : false,
  plane: (stmt) =>
    stmt.kind === 'plane'
      ? exprUsesThis(stmt.offset) || placementUsesCallerContext(stmt.from)
      : false,
};

/**
 * Builds the component data required by the current operation.
 */
function componentStmtUsesThis(stmt: ComponentStatement): boolean {
  return COMPONENT_STMT_THIS_CHECKS[stmt.kind]?.(stmt) ?? false;
}

/**
 * Handles sketch stmt uses this in the statements flow.
 */
function sketchStmtUsesThis(
  stmt: Extract<ComponentStatement, { kind: 'sketch' }>,
): boolean {
  return (
    primitiveUsesThis(stmt.primitive) ||
    (stmt.placement
      ? placementUsesCallerContext(stmt.placement.face) ||
        optionalExprUsesThis(stmt.placement.angle)
      : false)
  );
}

/**
 * Handles surface stmt uses this in the statements flow.
 */
function surfaceStmtUsesThis(
  stmt: Extract<ComponentStatement, { kind: 'surface' }>,
): boolean {
  return stmt.operation.kind === 'offset_surface'
    ? surfaceInputUsesThis(stmt.operation.surface) ||
        exprUsesThis(stmt.operation.distance)
    : repeatableFaceRefUsesCallerContext(stmt.operation.boundary);
}

/**
 * Handles call stmt uses this in the statements flow.
 */
function callStmtUsesThis(
  stmt: Extract<ComponentStatement, { kind: 'callStmt' }>,
): boolean {
  return (
    stmt.call.args.some(exprUsesThis) ||
    stmt.call.namedArgs.some((arg) => exprUsesThis(arg.value))
  );
}

/**
 * Handles if stmt uses this in the statements flow.
 */
function ifStmtUsesThis(
  stmt: Extract<ComponentStatement, { kind: 'if' }>,
): boolean {
  return (
    exprUsesThis(stmt.condition) ||
    bodyUsesThis(stmt.then) ||
    (stmt.else ? bodyUsesThis(stmt.else) : false)
  );
}

/**
 * Rotates stmt uses this around the requested axis.
 */
function rotateStmtUsesThis(
  stmt: Extract<ComponentStatement, { kind: 'rotate' }>,
): boolean {
  return (
    exprUsesThis(stmt.angle) ||
    (typeof stmt.around === 'string'
      ? false
      : faceRefUsesCallerContext(stmt.around))
  );
}

/**
 * Object this op accepts ExtrudeOp, CutOp, SolidCutOp, RevolveOp, RadialExtrudeOp, RadialCutOp,
 * LoftOp, HoleOp, HeatsetInsertOp, SweepOp, SweepCutOp, ThickenOp, and SolidPrimitiveOp.
 */
type ObjectThisOp =
  | ExtrudeOp
  | CutOp
  | SolidCutOp
  | RevolveOp
  | RadialExtrudeOp
  | RadialCutOp
  | LoftOp
  | HoleOp
  | HeatsetInsertOp
  | SweepOp
  | SweepCutOp
  | ThickenOp
  | SolidPrimitiveOp;

const OBJECT_OP_THIS_CHECKS: Record<
  ObjectThisOp['kind'],
  (op: ObjectThisOp) => boolean
> = {
  extrude: (op) => (op.kind === 'extrude' ? extrudeOpUsesThis(op) : false),
  cut: (op) => (op.kind === 'cut' ? cutLikeOpUsesThis(op) : false),
  solid_cut: (op) => (op.kind === 'solid_cut' ? solidCutOpUsesThis(op) : false),
  revolve: (op) => (op.kind === 'revolve' ? revolveOpUsesThis(op) : false),
  radial_extrude: (op) =>
    op.kind === 'radial_extrude' ? radialOpUsesThis(op) : false,
  radial_cut: (op) => (op.kind === 'radial_cut' ? radialOpUsesThis(op) : false),
  loft: (op) => (op.kind === 'loft' ? loftOpUsesThis(op) : false),
  hole: (op) => (op.kind === 'hole' ? hardwareOpUsesThis(op) : false),
  heatset_insert: (op) =>
    op.kind === 'heatset_insert' ? hardwareOpUsesThis(op) : false,
  sweep: (op) => (op.kind === 'sweep' ? sweepOpUsesThis(op) : false),
  sweep_cut: (op) => (op.kind === 'sweep_cut' ? sweepCutOpUsesThis(op) : false),
  thicken: (op) => (op.kind === 'thicken' ? thickenOpUsesThis(op) : false),
  solidPrimitive: (op) =>
    op.kind === 'solidPrimitive' ? solidPrimitiveUsesThis(op) : false,
};

/**
 * Handles obj op uses this in the statements flow.
 */
function objOpUsesThis(op: ObjectThisOp): boolean {
  return OBJECT_OP_THIS_CHECKS[op.kind](op);
}

/**
 * Handles extrude op uses this in the statements flow.
 */
function extrudeOpUsesThis(op: ExtrudeOp): boolean {
  return (
    sketchInputUsesThis(op.sketch) ||
    exprUsesThis(op.depth) ||
    optionalPlacementUsesThis(op.from)
  );
}

/**
 * Handles cut like op uses this in the statements flow.
 */
function cutLikeOpUsesThis(op: CutOp): boolean {
  return (
    sketchInputUsesThis(op.sketch) ||
    optionalExprUsesThis(op.depth) ||
    optionalPlacementUsesThis(op.from)
  );
}

/**
 * Handles revolve op uses this in the statements flow.
 */
function revolveOpUsesThis(op: RevolveOp): boolean {
  return (
    sketchInputUsesThis(op.sketch) ||
    exprUsesThis(op.angle) ||
    (typeof op.around === 'string'
      ? false
      : faceRefUsesCallerContext(op.around))
  );
}

/**
 * Handles loft op uses this in the statements flow.
 */
function loftOpUsesThis(op: LoftOp): boolean {
  return (
    op.sketches.some(sketchInputUsesThis) ||
    (op.guide ? sketchInputUsesThis(op.guide) : false) ||
    exprUsesThis(op.height)
  );
}

/**
 * Handles hardware op uses this in the statements flow.
 */
function hardwareOpUsesThis(op: HoleOp | HeatsetInsertOp): boolean {
  return optionalExprUsesThis(op.depth) || optionalPlacementUsesThis(op.from);
}

/**
 * Handles solid cut op uses this in the statements flow.
 */
function solidCutOpUsesThis(op: SolidCutOp): boolean {
  const toolUsesThis =
    op.tool.kind === 'operation' ? objOpUsesThis(op.tool.operation) : false;
  return toolUsesThis || placementUsesCallerContext(op.from);
}

/**
 * Handles sweep op uses this in the statements flow.
 */
function sweepOpUsesThis(op: SweepOp): boolean {
  return sketchInputUsesThis(op.sketch) || pathInputUsesThis(op.path);
}

/**
 * Handles sweep cut op uses this in the statements flow.
 */
function sweepCutOpUsesThis(op: SweepCutOp): boolean {
  return (
    sketchInputUsesThis(op.sketch) ||
    pathInputUsesThis(op.path) ||
    optionalExprUsesThis(op.depth) ||
    optionalPlacementUsesThis(op.from)
  );
}

/**
 * Handles thicken op uses this in the statements flow.
 */
function thickenOpUsesThis(op: ThickenOp): boolean {
  return surfaceInputUsesThis(op.surface) || exprUsesThis(op.thickness);
}

/**
 * Handles solid primitive uses this in the statements flow.
 */
function solidPrimitiveUsesThis(op: SolidPrimitiveOp): boolean {
  return (
    op.args.some((arg) => exprUsesThis(arg.value)) ||
    optionalPlacementUsesThis(op.placement)
  );
}

/**
 * Handles radial op uses this in the statements flow.
 */
function radialOpUsesThis(op: RadialExtrudeOp | RadialCutOp): boolean {
  return (
    sketchInputUsesThis(op.sketch) ||
    radialExtentUsesThis(op) ||
    radialAxisUsesThis(op) ||
    [op.start, op.twist, op.taper, op.radius].some(optionalExprUsesThis) ||
    optionalPlacementUsesThis(op.from)
  );
}

/**
 * Handles radial extent uses this in the statements flow.
 */
function radialExtentUsesThis(op: RadialExtrudeOp | RadialCutOp): boolean {
  if (op.extent.kind === 'angle-length') {
    return exprUsesThis(op.extent.angle) || exprUsesThis(op.extent.length);
  }
  if (op.extent.kind === 'between') {
    return (
      placementUsesCallerContext(op.extent.a) ||
      placementUsesCallerContext(op.extent.b)
    );
  }
  return (
    placementUsesCallerContext(op.extent.from) ||
    placementUsesCallerContext(op.extent.to)
  );
}

/**
 * Handles radial axis uses this in the statements flow.
 */
function radialAxisUsesThis(op: RadialExtrudeOp | RadialCutOp): boolean {
  return !op.axis || typeof op.axis === 'string'
    ? false
    : faceRefUsesCallerContext(op.axis);
}

/**
 * Handles place stmt uses this in the statements flow.
 */
function placeStmtUsesThis(
  stmt: Extract<ComponentStatement, { kind: 'place' }>,
): boolean {
  return (
    (stmt.target ? placementUsesCallerContext(stmt.target) : false) ||
    (stmt.sourceAnchor
      ? placementUsesCallerContext(stmt.sourceAnchor)
      : false) ||
    stmt.args.some(exprUsesThis) ||
    stmt.namedArgs.some((arg) => exprUsesThis(arg.value)) ||
    (stmt.rotate
      ? stmt.rotate.kind === 'default'
        ? exprUsesThis(stmt.rotate.angle)
        : [stmt.rotate.x, stmt.rotate.y, stmt.rotate.z].some((e) =>
            e ? exprUsesThis(e) : false,
          )
      : false)
  );
}

/**
 * Handles optional expr uses this in the statements flow.
 */
function optionalExprUsesThis(
  expr: Parameters<typeof exprUsesThis>[0] | null | undefined,
): boolean {
  return expr ? exprUsesThis(expr) : false;
}

/**
 * Handles optional placement uses this in the statements flow.
 */
function optionalPlacementUsesThis(
  placement: RepeatableSpatialRef | null | undefined,
): boolean {
  return placement ? placementUsesCallerContext(placement) : false;
}
