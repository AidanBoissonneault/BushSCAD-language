/**
 * @author Aidan Boissonneault
 * @file geometry-query-sets.ts
 * @purpose Provides geometry query sets behavior for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

// Geometry query functions that require OCCT shapes for accurate evaluation.
// Wall thickness depends on cuts and voids that compile-time metrics cannot capture.
export const OCCT_DEFERRED = new Set([
  'distance',
  'clearance',
  'wall_thickness',
]);

// Geometry query functions evaluable from pre-computed metrics.
const COMPILE_TIME_QUERIES = new Set(['face_area', 'bounding_box', 'volume']);

// fit_ok() is expanded at eval time into a real IRAssert; it is not deferred to OCCT directly.
export const ALL_GEOMETRY_QUERY_FNS = new Set([
  ...COMPILE_TIME_QUERIES,
  ...OCCT_DEFERRED,
  'fit_ok',
]);
