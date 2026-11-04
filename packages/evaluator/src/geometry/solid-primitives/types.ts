import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';
import type { ArgBag } from '../eval-solid-primitive-values.js';

/** Contract for normalizing one source solid-primitive call into concrete IR. */
export type PrimitiveNormalizer = (
  operation: SolidPrimitiveOp,
  args: ArgBag,
  ctx: EvalCtx,
) => IRSolidPrimitiveShape;
