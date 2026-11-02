/**
 * @author Aidan Boissonneault
 * @file eval-path-constraints.ts
 * @purpose Evaluates path constraints for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  ConstraintDecl,
  IRArcSegment,
  IRLineSegment,
  IRProfileSegment,
  SketchDimensionDecl,
} from '@bushscad/ir';
import type { SolverPoint, SolverSegment } from '@bushscad/sketch-solver';
import type { EvalCtx } from '../core/eval-types.js';
import { solveSketchConstraints } from './eval-sketch-constraints.js';

/**
 * State for path constraint, including point geometry, aliases, and fixed segment names.
 */
type PathConstraintState = {
  points: Map<string, [number, number]>;
  aliases: Map<string, string>;
  fixedSegmentNames: Set<string>;
};

/**
 * Solves constraints attached to `path(...)` sketches.
 * Cursor-inferred endpoints are mapped to stable names before solving so
 * constraints and dimensions can refer to the same geometric point.
 */
export function solvePathConstraints(
  segments: IRProfileSegment[],
  constraints: ConstraintDecl[],
  dimensions: SketchDimensionDecl[],
  span: ASTSourceSpan,
  ctx: EvalCtx,
  state: PathConstraintState,
): {
  segments: IRProfileSegment[];
  constraintState?: import('@bushscad/ir').IRConstraintState;
} {
  const solved = solveSketchConstraints(
    solverPoints(state),
    solverSegments(segments, state.aliases, state.fixedSegmentNames),
    constraints,
    dimensions,
    span,
    ctx,
    state.aliases,
  );
  return {
    segments: applySolvedGeometry(
      segments,
      solved.points,
      solved.radii,
      state.aliases,
    ),
    constraintState: solved.constraintState,
  };
}

/**
 * Handles solver points in the sketch flow.
 */
function solverPoints(state: PathConstraintState): SolverPoint[] {
  return [...state.points].map(([name, [x, y]]) => ({ name, x, y }));
}

/**
 * Handles solver segments in the sketch flow.
 */
function solverSegments(
  segments: IRProfileSegment[],
  aliases: Map<string, string>,
  fixedSegmentNames: Set<string>,
): SolverSegment[] {
  return segments.flatMap((segment) =>
    segment.kind === 'ellipse'
      ? []
      : segment.kind === 'line'
        ? {
            kind: 'line',
            name: segment.name,
            from: pointRef(segment.name, 'start', aliases),
            to: pointRef(segment.name, 'end', aliases),
            fixed: fixedSegmentNames.has(segment.name) || undefined,
            plant: segment.plant,
          }
        : {
            kind: 'arc',
            name: segment.name,
            from: pointRef(segment.name, 'start', aliases),
            to: pointRef(segment.name, 'end', aliases),
            radius: segment.radius,
            clockwise: segment.clockwise,
            fixed: fixedSegmentNames.has(segment.name) || undefined,
          },
  );
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointRef(
  segmentName: string,
  endpoint: 'start' | 'end',
  aliases: Map<string, string>,
): { kind: 'point'; name: string } {
  const name = `${segmentName}.${endpoint}`;
  return { kind: 'point', name: aliases.get(name) ?? name };
}

/**
 * Applies solved geometry to the supplied state or geometry.
 */
function applySolvedGeometry(
  segments: IRProfileSegment[],
  solved: Map<string, [number, number]> | null,
  radii: Map<string, number> | null,
  aliases: Map<string, string>,
): IRProfileSegment[] {
  if (!solved && !radii) return segments;
  return segments.map((segment) => {
    const from = solvedEndpoint(
      solved,
      aliases,
      segment.name,
      'start',
      segment.from,
    );
    const to = solvedEndpoint(solved, aliases, segment.name, 'end', segment.to);
    if (segment.kind === 'ellipse') return segment;
    return segment.kind === 'line'
      ? ({ ...segment, from, to } satisfies IRLineSegment)
      : ({
          ...segment,
          from,
          to,
          radius: radii?.get(segment.name) ?? segment.radius,
        } satisfies IRArcSegment);
  });
}

/**
 * Handles solved endpoint in the sketch flow.
 */
function solvedEndpoint(
  solved: Map<string, [number, number]> | null,
  aliases: Map<string, string>,
  segmentName: string,
  endpoint: 'start' | 'end',
  fallback: [number, number],
): [number, number] {
  const name = `${segmentName}.${endpoint}`;
  return solved?.get(aliases.get(name) ?? name) ?? fallback;
}
