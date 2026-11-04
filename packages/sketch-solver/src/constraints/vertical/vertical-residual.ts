/** Resolves vertical constraints as horizontal coordinate equality. */
import { appendAxisAlignment } from '../axis-alignment.js';
import type { ResidualContext } from '../residual/context.js';

export function appendVerticalResidual({
  out,
  constraint,
  target,
  access,
}: ResidualContext): void {
  appendAxisAlignment(out, constraint, target, access, 0);
}
