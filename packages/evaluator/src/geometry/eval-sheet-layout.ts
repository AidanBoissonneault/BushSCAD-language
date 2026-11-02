/**
 * @author Aidan Boissonneault
 * @file eval-sheet-layout.ts
 * @purpose Evaluates sheet layout for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRFlatPattern,
  IRPartBoundary,
  MaterialAppearance,
  RectPrimitive,
  SheetDecl,
} from '@bushscad/ir';

import type { EvalCtx } from '../core/eval-types.js';
import { toSpan } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { emitSketchOp } from './eval-op-emission.js';
import { buildFlatPattern } from './eval-sheet-geometry.js';
import type { RectDims, ResolvedFlange } from './eval-sheet-geometry.js';
import { resolveFlange, type ResolveCtx } from './eval-sheet-flanges.js';

/**
 * Sheet layout, including rect dims, panel sketch, and flanges by panel.
 */
type SheetLayout = {
  rectDims: Map<string, RectDims>;
  panelSketch: Map<string, string>;
  flangesByPanel: Map<string, ResolvedFlange[]>;
};

/**
 * Defines the `SheetPanelEmitter` callback contract used by the geometry layer.
 */
type SheetPanelEmitter = (
  panel: string,
  sketchName: string,
  material: MaterialAppearance | null,
) => void;

/**
 * Emits the IR part boundary that starts a sheet body.
 *
 * The evaluator keeps this separate from panel geometry so sheet declaration
 * orchestration can stay linear.
 */
export function emitSheetPartBoundary(stmt: SheetDecl, ctx: EvalCtx): void {
  ctx.ops.push({
    kind: 'part',
    name: stmt.name,
    color: null,
    span: toSpan(stmt.span),
  } satisfies IRPartBoundary);
}

/**
 * Collects sheet layout from the supplied values.
 */
export function collectSheetLayout(stmt: SheetDecl, ctx: EvalCtx): SheetLayout {
  const layout: SheetLayout = {
    rectDims: new Map(),
    panelSketch: new Map(),
    flangesByPanel: new Map(),
  };
  collectSheetBaseSketches(stmt, ctx, layout);
  collectSheetPanels(stmt, layout);
  return layout;
}

/**
 * Resolves sheet flanges using the geometry rules.
 */
export function resolveSheetFlanges(
  stmt: SheetDecl,
  ctx: EvalCtx,
  resolveCtx: ResolveCtx,
): void {
  for (const s of stmt.body) {
    if (s.kind !== 'flange') continue;
    const resolved = resolveFlange(s, ctx, resolveCtx);
    if (resolved) resolveCtx.flangesByPanel.get(s.edgeObj)?.push(resolved);
  }
}

/**
 * Emits sheet panels into the current output.
 */
export function emitSheetPanels(
  layout: SheetLayout,
  material: MaterialAppearance | null,
  emitPanel: SheetPanelEmitter,
): void {
  for (const [panel, sketchName] of layout.panelSketch) {
    emitPanel(panel, sketchName, material);
  }
}

/**
 * Emits flat pattern exports into the current output.
 */
export function emitFlatPatternExports(
  stmt: SheetDecl,
  ctx: EvalCtx,
  layout: SheetLayout,
): void {
  for (const s of stmt.body) {
    if (s.kind !== 'flatPatternExport') continue;
    ctx.ops.push({
      kind: 'flat_pattern',
      name: stmt.name,
      format: 'dxf',
      path: s.path,
      segments: buildFlatPattern(
        layout.panelSketch,
        layout.rectDims,
        layout.flangesByPanel,
      ),
      span: toSpan(s.span),
    } satisfies IRFlatPattern);
  }
}

/**
 * Collects sheet base sketches from the supplied values.
 */
function collectSheetBaseSketches(
  stmt: SheetDecl,
  ctx: EvalCtx,
  layout: SheetLayout,
): void {
  for (const s of stmt.body) {
    if (s.kind === 'var') {
      ctx.values.set(s.name, evalNum(s.value, ctx));
    } else if (s.kind === 'sketch') {
      if (s.primitive.kind === 'rect') {
        const prim = s.primitive as RectPrimitive;
        layout.rectDims.set(s.name, {
          width: evalNum(prim.width, ctx),
          height: evalNum(prim.height, ctx),
        });
      } else {
        emitSketchOp(s, ctx, s.name);
      }
    }
  }
}

/**
 * Collects sheet panels from the supplied values.
 */
function collectSheetPanels(stmt: SheetDecl, layout: SheetLayout): void {
  for (const s of stmt.body) {
    if (s.kind === 'sheetObj') {
      layout.panelSketch.set(s.name, s.sketch);
      layout.flangesByPanel.set(s.name, []);
    }
  }
}
