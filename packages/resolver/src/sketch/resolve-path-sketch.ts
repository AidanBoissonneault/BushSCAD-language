/**
 * @author Aidan Boissonneault
 * @file resolve-path-sketch.ts
 * @purpose Resolves path sketch for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { PathEmbeddedPrimitive, SketchDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';
import { collectPathSegmentNames } from './path-segment-names.js';
import { resolvePathBodyExpressions } from './resolve-path-body-expressions.js';
import { resolveSketchPoint } from './resolve-points.js';
import { resolveSketchAnnotations } from './resolve-sketch-annotations.js';

/**
 * The pathSketch variant of SketchDecl['primitive'], used for primitive for path sketch.
 */
type PathSketchPrimitive = Extract<
  SketchDecl['primitive'],
  { kind: 'pathSketch' }
>;

/**
 * Resolves path sketch expressions and records named segment labels.
 * Path syntax has cursor-driven geometry plus closed-body declarations. Keeping
 * this separate prevents the main sketch resolver from mixing dispatch logic
 * with path-specific name and constraint validation.
 */
export function resolvePathSketch(
  primitive: PathSketchPrimitive,
  sketchName: string,
  scope: Scope,
  state: State,
): void {
  const names = collectPathSegmentNames(primitive.items);
  const endpointNames = new Set(
    [...names].flatMap((name) => [`${name}.start`, `${name}.end`]),
  );
  for (const item of primitive.items) resolvePathItem(item, scope, state);
  resolvePathBodyExpressions(primitive, names, scope, state);
  resolveSketchAnnotations(
    {
      constraints: primitive.constraints,
      dimensions: primitive.dimensions,
      segmentNames: names,
      pointNames: endpointNames,
      container: 'path',
    },
    scope,
    state,
  );
  state.profileSketchSegments.set(sketchName, names);
}

/**
 * Resolves path item against the current scope and reports unresolved references.
 */
function resolvePathItem(
  item: PathSketchPrimitive['items'][number],
  scope: Scope,
  state: State,
): void {
  if (item.kind === 'primitive') {
    resolvePathPrimitive(item.primitive, scope, state);
    return;
  }
  const segment = item.segment;
  if (segment.kind === 'line') {
    if (segment.start) resolveSketchPoint(segment.start, scope, state);
    resolveSketchPoint(segment.end, scope, state);
  } else if (segment.kind === 'arc') {
    if (segment.start) resolveSketchPoint(segment.start, scope, state);
    resolveSketchPoint(segment.end, scope, state);
    if (segment.radius) resolveExpr(segment.radius, scope, state);
  }
}

/**
 * Resolves path primitive against the current scope and reports unresolved references.
 */
function resolvePathPrimitive(
  primitive: PathEmbeddedPrimitive,
  scope: Scope,
  state: State,
): void {
  if (primitive.kind === 'sketchAt') {
    resolvePathPrimitive(primitive.primitive, scope, state);
    resolveExpr(primitive.x, scope, state);
    resolveExpr(primitive.y, scope, state);
    return;
  }
  if (primitive.kind === 'rect') {
    resolveExpr(primitive.width, scope, state);
    resolveExpr(primitive.height, scope, state);
    if (primitive.cornerRadius)
      resolveExpr(primitive.cornerRadius, scope, state);
    return;
  }
  if (primitive.kind === 'circle') {
    resolveExpr(primitive.diameter, scope, state);
    return;
  }
  resolveExpr(primitive.width, scope, state);
  resolveExpr(primitive.height, scope, state);
}
