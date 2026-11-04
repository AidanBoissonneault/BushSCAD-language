/** Resolves horizontal constraints as vertical coordinate equality. */
import { appendAxisAlignment } from '../axis-alignment.js';
import type { ResidualContext } from '../residual/context.js';

export function appendHorizontalResidual({
  out,
  constraint,
  target,
  access,
}: ResidualContext): void {
  appendAxisAlignment(out, constraint, target, access, 1);
}
