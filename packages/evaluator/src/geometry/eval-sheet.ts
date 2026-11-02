/**
 * @author Aidan Boissonneault
 * @file eval-sheet.ts
 * @purpose Evaluates sheet for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRExtrude,
  IRFlange,
  IRPrimitive,
  IRSketch,
  MaterialAppearance,
  SheetDecl,
} from '@bushscad/ir';

import { findMaterialByName, normalizeMaterialKey } from '@bushscad/ir';

import type { EvalCtx } from '../core/eval-types.js';

import { addError, toSpan } from '../core/eval-context.js';

import { evalExpr, evalNum } from '../expressions/eval-expressions.js';

import type {
  EdgeName,
  RectDims,
  ResolvedFlange,
} from './eval-sheet-geometry.js';
import { buildFlangeProfile, edgeFrame } from './eval-sheet-geometry.js';
import {
  collectSheetLayout,
  emitFlatPatternExports,
  emitSheetPanels,
  emitSheetPartBoundary,
  resolveSheetFlanges,
} from './eval-sheet-layout.js';

const DEFAULT_BEND_RADIUS = 1;

const DEFAULT_K_FACTOR = 0.44;

/**
 * Evaluates a `sheet` block (M33). Flanges fold up out of the base rectangle:
 * the base panel shrinks by each flange's flat length, and the flange occupies
 * the consumed strip. The flat pattern is the original (un-reduced) rectangle.
 */
export function evalSheetDecl(stmt: SheetDecl, ctx: EvalCtx): void {
  const thickness = evalNum(stmt.thickness, ctx);
  if (thickness <= 0) {
    addError(
      ctx,
      `sheet '${stmt.name}': thickness must be positive`,
      stmt.span,
    );
    return;
  }
  const defaultRadius = stmt.bendRadius
    ? evalNum(stmt.bendRadius, ctx)
    : DEFAULT_BEND_RADIUS;
  const kFactor = stmt.kFactor ? evalNum(stmt.kFactor, ctx) : DEFAULT_K_FACTOR;
  const material = resolveSheetMaterial(stmt, ctx);

  emitSheetPartBoundary(stmt, ctx);

  const layout = collectSheetLayout(stmt, ctx);

  // Resolve every flange first so panels can be reduced before extrusion.
  resolveSheetFlanges(stmt, ctx, {
    thickness,
    defaultRadius,
    kFactor,
    ...layout,
  });

  // Emit base panels (reduced by their flanges) and flange geometry.
  emitSheetPanels(layout, material, (panel, sketchName, panelMaterial) => {
    emitPanelAndFlanges(panel, sketchName, ctx, {
      thickness,
      material: panelMaterial,
      rectDims: layout.rectDims,
      flangesByPanel: layout.flangesByPanel,
      span: stmt.span,
    });
  });

  // Flat-pattern export — the developed pattern is the original rectangle.
  emitFlatPatternExports(stmt, ctx, layout);
}

/** Resolves `material:` against the catalog, with a fuzzy contains-match fallback. */
function resolveSheetMaterial(
  stmt: SheetDecl,
  ctx: EvalCtx,
): MaterialAppearance | null {
  if (!stmt.material) return null;
  const value = evalExpr(stmt.material, ctx);
  if (typeof value !== 'string') {
    addError(ctx, `sheet 'material:' expects a string`, stmt.span);
    return null;
  }
  const exact = findMaterialByName(ctx.materialContext.catalog, value);
  if (exact) return exact;
  const key = normalizeMaterialKey(value);
  const partial = ctx.materialContext.catalog.find((m) =>
    normalizeMaterialKey(m.name).includes(key),
  );
  if (!partial) {
    addError(ctx, `Unknown sheet material '${value}'`, stmt.span);
    return null;
  }
  return partial;
}

/**
 * Panel ctx, including thickness, material, rect dims, flanges by panel, and span.
 */
type PanelCtx = {
  thickness: number;
  material: MaterialAppearance | null;
  rectDims: Map<string, RectDims>;
  flangesByPanel: Map<string, ResolvedFlange[]>;
  span: import('@bushscad/ir').ASTSourceSpan;
};

/**
 * Emits panel and flanges into the current output.
 */
function emitPanelAndFlanges(
  panel: string,
  sketchName: string,
  ctx: EvalCtx,
  pc: PanelCtx,
): void {
  const t = pc.thickness;
  const flanges = pc.flangesByPanel.get(panel) ?? [];
  const dims = pc.rectDims.get(sketchName);

  // Non-rect panels (no flanges) extrude their original sketch unchanged.
  if (dims === undefined) {
    ctx.names.set(panel, panel);
    ctx.ops.push(extrudeOp(panel, sketchName, t, pc.material, pc.span));
    return;
  }

  /**
   * Handles consumed in the geometry flow.
   */
  const consumed = (e: EdgeName): number =>
    flanges.filter((f) => f.edge === e).reduce((a, f) => a + f.length, 0);
  const cF = consumed('front'),
    cB = consumed('back');
  const cL = consumed('left'),
    cR = consumed('right');
  const reducedW = dims.width - cL - cR;
  const reducedH = dims.height - cF - cB;
  if (reducedW <= 0 || reducedH <= 0) {
    addError(ctx, `flanges consume the entire '${panel}' panel`, pc.span);
    return;
  }

  // Reduced base rectangle, centered to keep the original rect's footprint.
  const cx = (cL - cR) / 2;
  const cy = (cF - cB) / 2;
  const hw = reducedW / 2;
  const hh = reducedH / 2;
  const panelSketchName = `${panel}__panel`;
  const polygon: IRPrimitive = {
    kind: 'polygon',
    points: [
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ],
  };
  ctx.ops.push({
    kind: 'sketch',
    name: panelSketchName,
    primitive: polygon,
    placement: null,
    span: toSpan(pc.span),
  } satisfies IRSketch);
  ctx.names.set(panel, panel);
  ctx.ops.push(extrudeOp(panel, panelSketchName, t, pc.material, pc.span));

  for (const f of flanges) {
    const frame = edgeFrame(
      f.edge,
      { width: reducedW, height: reducedH },
      cx,
      cy,
    );
    ctx.ops.push({
      kind: 'flange',
      objName: panel,
      edgeName: f.edge,
      profile: buildFlangeProfile(
        t,
        f.radius,
        f.angleDeg,
        f.wallLength,
        f.stmt.direction,
      ),
      origin: frame.origin,
      edgeDir: frame.edgeDir,
      outwardDir: frame.outwardDir,
      edgeLength: frame.edgeLength,
      span: toSpan(f.stmt.span),
    } satisfies IRFlange);
  }
}

/**
 * Handles extrude op in the geometry flow.
 */
function extrudeOp(
  objName: string,
  sketchName: string,
  depth: number,
  material: MaterialAppearance | null,
  span: import('@bushscad/ir').ASTSourceSpan,
): IRExtrude {
  return {
    kind: 'extrude',
    objName,
    sketchName,
    depth,
    from: null,
    symmetric: false,
    wrap: false,
    material,
    span: toSpan(span),
  };
}
