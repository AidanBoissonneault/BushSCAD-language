/**
 * @author Aidan Boissonneault
 * @file primitive-conventions.ts
 * @purpose Provides primitive conventions behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

export const bottomPlacement =
  'Local X/Y are centered; height grows along local +Z from the bottom placement plane. An optional final @face.center argument moves and orients the primitive.';
export const primitiveUnits =
  'Use base_unit = mm for direct primitives: their current evaluator passes normalized numeric dimensions directly to the geometry bridge.';
