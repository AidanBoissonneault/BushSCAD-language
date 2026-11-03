import type { IRConstraintState } from '@bushscad/ir';

/**
 * Formats the open/closed state and constraint solver status for a profile.
 */
export function profileStatusText(
  isClosed: boolean | undefined,
  state: IRConstraintState | undefined,
): string {
  const base = isClosed ? 'closed profile' : 'open profile';
  if (!state) return base;
  if (state.status === 'fully-constrained') {
    return `${base} · fully constrained`;
  }
  if (state.status === 'underconstrained') {
    return `${base} · under (${state.dof} DOF free)`;
  }
  if (state.status === 'no-convergence') return `${base} · constraint error`;
  return base;
}
