/**
 * @author Aidan Boissonneault
 * @file sketchPrimitiveOptions.ts
 * @purpose Provides sketch primitive options behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { Expr, RepeatableSpatialRef } from './expressions.js';

/**
 * Accepted values for sketch origin are 'center' and 'corner'.
 */
export type SketchOrigin = 'center' | 'corner';

/** Canonical rectangle edges that may receive source-level aliases. */
export type RectSide = 'bottom' | 'right' | 'top' | 'left';

/** Optional source aliases keyed by the canonical rectangle edge they name. */
export type RectSideNames = Partial<Record<RectSide, string>>;

/** Shared placement options accepted by centered and corner-based primitives. */
export type SketchOriginOption = {
  origin?: SketchOrigin;
  placement?: SketchPlacement;
};

/** Placement information for sketches built on existing model faces. */
export type SketchPlacement = {
  mode: 'from' | 'on';
  face: RepeatableSpatialRef;
  angle?: Expr;
};
