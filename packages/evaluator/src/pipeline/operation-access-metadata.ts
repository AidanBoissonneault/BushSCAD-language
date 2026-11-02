/**
 * @author Aidan Boissonneault
 * @file operation-access-metadata.ts
 * @purpose Provides operation access metadata behavior for the pipeline in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationCostClass,
  CompilationGraphNodeKind,
  CompilationPolarity,
  IROp,
} from '@bushscad/ir';

/**
 * Type used for operation static access.
 */
export type OperationStaticAccess = Readonly<{
  role: CompilationGraphNodeKind;
  polarity: CompilationPolarity;
  topologySensitive: boolean;
  orderSensitive: boolean;
  continuation: boolean;
  cacheSafe: boolean;
  recipeEligible: boolean;
  partEffect: boolean;
  estimatedCost: CompilationCostClass;
}>;

/**
 * Handles meta in the pipeline flow.
 */
const meta = (
  role: CompilationGraphNodeKind,
  polarity: CompilationPolarity,
  options: Partial<Omit<OperationStaticAccess, 'role' | 'polarity'>> = {},
): OperationStaticAccess => ({
  role,
  polarity,
  topologySensitive: false,
  orderSensitive: false,
  continuation: false,
  cacheSafe: false,
  recipeEligible: false,
  partEffect: false,
  estimatedCost: 'metadata',
  ...options,
});

/**
 * Handles recipe in the pipeline flow.
 */
const recipe = (
  role: CompilationGraphNodeKind,
  polarity: CompilationPolarity,
  options: Partial<Omit<OperationStaticAccess, 'role' | 'polarity'>> = {},
): OperationStaticAccess =>
  meta(role, polarity, {
    cacheSafe: true,
    recipeEligible: true,
    estimatedCost: 'medium',
    ...options,
  });

/**
 * Handles mutation in the pipeline flow.
 */
const mutation = (
  polarity: CompilationPolarity = 'neutral',
  options: Partial<Omit<OperationStaticAccess, 'role' | 'polarity'>> = {},
): OperationStaticAccess =>
  meta('operation', polarity, {
    topologySensitive: true,
    orderSensitive: true,
    continuation: true,
    partEffect: true,
    estimatedCost: 'heavy',
    ...options,
  });

const STATIC_ACCESS: Record<IROp['kind'], OperationStaticAccess> = {
  part: meta('part', 'neutral'),
  sketch: recipe('definition', 'neutral'),
  path: recipe('definition', 'neutral', { estimatedCost: 'light' }),
  solidPrimitive: recipe('instance', 'positive', { partEffect: true }),
  extrude: recipe('instance', 'positive', { partEffect: true }),
  cut: mutation('negative'),
  solid_cut: mutation('negative'),
  revolve: recipe('instance', 'positive', { partEffect: true }),
  radial_extrude: recipe('instance', 'positive', { partEffect: true }),
  radial_cut: mutation('negative'),
  loft: recipe('instance', 'positive', {
    partEffect: true,
    estimatedCost: 'heavy',
  }),
  sweep: recipe('instance', 'positive', {
    partEffect: true,
    estimatedCost: 'heavy',
  }),
  sweep_cut: mutation('negative'),
  fillet: mutation(),
  chamfer: mutation(),
  fuse: mutation('positive'),
  shell: mutation(),
  draft: mutation(),
  thread: mutation(),
  rotate: mutation(),
  patternLinear: mutation('positive', {
    topologySensitive: false,
    continuation: false,
  }),
  patternRadial: mutation('positive'),
  mirror: mutation('positive'),
  transform: mutation(),
  fit: meta('relationship', 'neutral', { cacheSafe: true }),
  assert: meta('relationship', 'neutral', {
    topologySensitive: true,
    orderSensitive: true,
    continuation: true,
  }),
  hardware_visual: recipe('instance', 'neutral', {
    topologySensitive: true,
    continuation: true,
    partEffect: true,
  }),
  joint: meta('relationship', 'neutral', {
    topologySensitive: true,
    orderSensitive: true,
    continuation: true,
  }),
  importShape: recipe('definition', 'neutral', { estimatedCost: 'heavy' }),
  heal: mutation(),
  defeature: mutation(),
  ref: meta('definition', 'neutral', { cacheSafe: true }),
  declareShape: meta('definition', 'neutral', {
    orderSensitive: true,
    continuation: true,
  }),
  alignShape: mutation('positive'),
  flange: mutation('positive'),
  flat_pattern: meta('output', 'neutral', {
    cacheSafe: true,
    orderSensitive: true,
  }),
  surface: recipe('definition', 'neutral', {
    topologySensitive: true,
    continuation: true,
    partEffect: true,
  }),
  surfaceOffset: recipe('definition', 'neutral', { partEffect: true }),
  surfaceThicken: recipe('instance', 'positive', {
    partEffect: true,
    estimatedCost: 'heavy',
  }),
};

/** Returns the exhaustive static scheduling policy for an operation kind. */
export function staticOperationAccess(
  kind: IROp['kind'],
): OperationStaticAccess {
  return STATIC_ACCESS[kind];
}
