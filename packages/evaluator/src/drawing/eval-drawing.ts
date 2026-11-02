/**
 * @author Aidan Boissonneault
 * @file eval-drawing.ts
 * @purpose Evaluates drawing for the drawing in evaluator package.
 * @last-edited October 6, 2026
 */

import type { DrawingDecl } from '@bushscad/ir';
import type { DrawingOutputIR, DrawingDimensionIR } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';

/**
 * Resolves `partName.bodyName` drawing refs to built IR body names.
 * Part body evaluation currently emits direct body names for simple members,
 * while loop/component bodies can still record mangled names in snapshots.
 */
function resolveObjName(name: string, ctx: EvalCtx): string {
  const dot = name.indexOf('.');
  if (dot === -1) return name;
  const partName = name.slice(0, dot);
  const bodyName = name.slice(dot + 1);
  const snap = ctx.partsSnapshot.get(partName);
  if (!snap) return name;
  return snap.names.get(bodyName) ?? bodyName;
}

/**
 * Evaluates drawing declaration with the current evaluation context.
 */
export function evalDrawingDecl(
  decl: DrawingDecl,
  ctx: EvalCtx,
): DrawingOutputIR {
  const span = {
    file: decl.span.file,
    line: decl.span.line,
    col: decl.span.col,
    endLine: decl.span.endLine,
    endCol: decl.span.endCol,
  };

  const viewObjName = resolveObjName(decl.view.objName, ctx);

  const dimensions: DrawingDimensionIR[] = [];
  for (const dim of decl.dimensions) {
    if (dim.ref.kind === 'obj_extent') {
      dimensions.push({
        kind: 'obj_extent',
        objName: resolveObjName(dim.ref.objName, ctx),
        axis: dim.ref.axis,
      });
    } else {
      dimensions.push({
        kind: 'point_to_face',
        fromObjName: resolveObjName(dim.ref.fromObjName, ctx),
        fromFace: dim.ref.fromFace,
        toObjName: resolveObjName(dim.ref.toObjName, ctx),
        toFace: dim.ref.toFace,
      });
    }
  }

  return {
    name: decl.name,
    view: {
      objName: viewObjName,
      face: decl.view.face,
      scale: decl.view.scale ?? 1,
    },
    dimensions,
    exportDxfPath: decl.exportDxfPath,
    exportSvgPath: decl.exportSvgPath,
    span,
  };
}
