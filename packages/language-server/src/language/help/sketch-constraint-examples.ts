/**
 * @author Aidan Boissonneault
 * @file sketch-constraint-examples.ts
 * @purpose Provides sketch constraint examples behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

/** Supplies named rectangle edges so constraint examples include their required targets. */
export function constraintExample(...entries: string[]): string {
  return `sketch plate = path(
  bottom = line((0, 0), (40, 0)), right = line(40, 20),
  top = line(0, 20), left = close(),
  ${entries.join(',\n  ')}
);`;
}
