/**
 * @author Aidan Boissonneault
 * @file time.ts
 * @purpose Provides time behavior for the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

/**
 * Returns a high-resolution timestamp when the runtime provides one, otherwise
 * falling back to the system clock.
 */
export function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
