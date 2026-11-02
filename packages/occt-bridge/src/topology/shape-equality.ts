/**
 * @author Aidan Boissonneault
 * @file shape-equality.ts
 * @purpose Provides shape equality behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

/**
 * Checks whether the supplied topo shape values are equivalent.
 */
export function sameTopoShape(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return (
    shapePredicate(a, 'IsSame', b) ||
    shapePredicate(a, 'IsEqual', b) ||
    shapePredicate(b, 'IsSame', a) ||
    shapePredicate(b, 'IsEqual', a)
  );
}

/**
 * Returns the shape data required by the current operation.
 */
function shapePredicate(
  shape: unknown,
  method: 'IsSame' | 'IsEqual',
  other: unknown,
): boolean {
  if (!shape || (typeof shape !== 'object' && typeof shape !== 'function')) {
    return false;
  }
  const fn = (shape as Record<string, unknown>)[method];
  if (typeof fn !== 'function') return false;
  try {
    return Boolean(fn.call(shape, other));
  } catch {
    return false;
  }
}
