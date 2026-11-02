/**
 * @author Aidan Boissonneault
 * @file uniqueNames.ts
 * @purpose Provides unique names behavior for the shared in IR package.
 * @last-edited October 6, 2026
 */

/**
 * Returns a stable suffix-based name that is absent from the supplied set.
 * Multiple compiler layers need to preserve user-facing names where possible
 * while still accepting repeated sketch edge names from separate shapes.
 */
export function uniqueNameWithSuffix(
  base: string,
  used: ReadonlySet<string>,
): string {
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}_${index}`;
    if (!used.has(candidate)) return candidate;
  }
}
