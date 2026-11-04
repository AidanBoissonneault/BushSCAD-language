import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  evalArg,
  faceList,
  pointList,
} from '../../eval-solid-primitive-values.js';

/** Normalizes point and face lists for polyhedron(). */
export function normalizePolyhedron(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<IRSolidPrimitiveShape, { primitive: 'polyhedron' }> {
  return {
    primitive: 'polyhedron',
    points: pointList(evalArg(args, ctx, ['points'], 0), span, ctx),
    faces: faceList(evalArg(args, ctx, ['faces', 'triangles'], 1), span, ctx),
  };
}
