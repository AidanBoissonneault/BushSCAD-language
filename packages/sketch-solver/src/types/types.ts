/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the types in sketch solver package.
 * @last-edited October 6, 2026
 */

/**
 * Input/output types for the 2D sketch constraint solver.
 *
 * Each named point contributes 2 DOF (x, y). Fixed points are locked.
 * Each constraint adds one or more scalar equations f(x) = 0.
 * The solver runs Newton-Raphson to minimize the constraint residual.
 */

export type SolverPoint = {
  name: string;
  x: number;
  y: number;
  fixed?: boolean;
};

/**
 * Segment endpoint ref is tagged by kind: 'point' carries name and 'coords' carries x, y.
 */
export type SegmentEndpointRef =
  | { kind: 'point'; name: string }
  | { kind: 'coords'; x: number; y: number };

/**
 * Solver line segment, including operation kind, name, from, to, and fixed.
 */
export type SolverLineSegment = {
  kind: 'line';
  name: string;
  from: SegmentEndpointRef;
  to: SegmentEndpointRef;
  /** Locks both named endpoints so this segment drives attached geometry. */
  fixed?: boolean;
  plant?: boolean;
};

/**
 * Solver arc segment, including operation kind, name, from, to, and radius.
 */
export type SolverArcSegment = {
  kind: 'arc';
  name: string;
  from: SegmentEndpointRef;
  to: SegmentEndpointRef;
  radius: number;
  clockwise: boolean;
  /** Locks named endpoints and radius so this arc drives attached geometry. */
  fixed?: boolean;
};

/**
 * Solver segment accepts SolverLineSegment and SolverArcSegment.
 */
export type SolverSegment = SolverLineSegment | SolverArcSegment;

/**
 * Accepted values for constraint kind are 'horizontal', 'vertical', 'parallel', 'perpendicular',
 * 'tangent', 'equal', 'symmetric', 'fixed', 'coincident', 'midpoint', 'length', 'distance',
 * 'angle', 'radius', and 'diameter'.
 */
export type ConstraintKind =
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'tangent'
  | 'equal'
  | 'symmetric'
  | 'fixed'
  | 'coincident'
  | 'midpoint'
  | 'length'
  | 'distance'
  | 'angle'
  | 'radius'
  | 'diameter';

/**
 * Solver constraint, including identifier, operation kind, target, ref, and display value.
 */
export type SolverConstraint = {
  /** Stable source/editor identity used in conflict reports. */
  id?: string;
  kind: ConstraintKind;
  /** Primary target — segment name or point name depending on constraint kind */
  target: string;
  /** Secondary target for binary constraints, including point-pair horizontal/vertical alignment. */
  ref?: string;
  /** Resolved dimensional value; angle constraints are expressed in degrees. */
  value?: number | SolverScalarExpression;
  /** Preserved side for signed origin-axis distance dimensions */
  axisSign?: 1 | -1;
  /** Cartesian component measured by a point-to-point distance constraint. */
  axis?: 'x' | 'y';
  /** Source location for error reporting */
  spanLine: number;
  spanCol: number;
};

/**
 * Accepted values for solver dimension kind are 'length', 'distance', 'angle', 'radius', and
 * 'diameter'.
 */
export type SolverDimensionKind =
  | 'length'
  | 'distance'
  | 'angle'
  | 'radius'
  | 'diameter';

/** Geometry measurement addressable from another driving expression. */
export type SolverDimension = {
  name: string;
  dimension: SolverDimensionKind;
  target: string;
  ref?: string;
  /** Cartesian component measured by a point-to-point distance dimension. */
  axis?: 'x' | 'y';
};

/** Numeric expression whose dimension leaves are measured during each solve iteration. */
export type SolverScalarExpression =
  | { kind: 'constant'; value: number }
  | { kind: 'dimension'; name: string }
  | { kind: 'negate'; operand: SolverScalarExpression }
  | {
      kind: 'binary';
      op: '+' | '-' | '*' | '/' | '%';
      left: SolverScalarExpression;
      right: SolverScalarExpression;
    };

/**
 * Input for solve, including point geometry, segments, constraints, and dimensions.
 */
export type SolveInput = {
  points: SolverPoint[];
  segments: SolverSegment[];
  constraints: SolverConstraint[];
  dimensions?: SolverDimension[];
};

/**
 * Solve result ok, including success flag, point geometry, and radii.
 */
export type SolveResultOk = {
  ok: true;
  points: Map<string, [number, number]>;
  radii: Map<string, number>;
};

/**
 * Solve result underconstrained, including success flag, operation kind, dof, free names, and
 * point geometry.
 */
export type SolveResultUnderconstrained = {
  ok: false;
  kind: 'underconstrained';
  dof: number;
  freeNames: string[];
  points: Map<string, [number, number]>;
  radii: Map<string, number>;
};

/**
 * Solve result overconstrained, including success flag, operation kind, conflicting, and invalid
 * expressions.
 */
export type SolveResultOverconstrained = {
  ok: false;
  kind: 'overconstrained';
  conflicting: string[];
  invalidExpressions?: string[];
};

/**
 * Solve result no convergence, including success flag, operation kind, residual, point geometry,
 * and radii.
 */
export type SolveResultNoConvergence = {
  ok: false;
  kind: 'no-convergence';
  residual: number;
  points: Map<string, [number, number]>;
  radii: Map<string, number>;
};

/**
 * Result of solve accepts SolveResultOk, SolveResultUnderconstrained,
 * SolveResultOverconstrained, and SolveResultNoConvergence.
 */
export type SolveResult =
  | SolveResultOk
  | SolveResultUnderconstrained
  | SolveResultOverconstrained
  | SolveResultNoConvergence;
