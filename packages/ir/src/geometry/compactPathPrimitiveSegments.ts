/**
 * @author Aidan Boissonneault
 * @file compactPathPrimitiveSegments.ts
 * @purpose Provides compact path primitive segments behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type {
  PathItem,
  RectSide,
  RectSideNames,
} from '../ast/sketchPrimitives.js';
import type {
  IREllipsePrimitive,
  IRProfileSegment,
  IRRectPrimitive,
} from '../sketch/sketchIr.js';
import { ellipsePoint } from './ellipseGeometry.js';
import { rectangleSideEndpoints } from '../sketch/rectangleSides.js';
import { uniqueNameWithSuffix } from '../shared/uniqueNames.js';

const RECTANGLE_SIDES: RectSide[] = ['bottom', 'right', 'top', 'left'];

/** Minimal recursive shape needed to derive stable embedded-path edge names. */
export type CompactPathPrimitiveNaming =
  | { kind: 'rect'; sideNames?: RectSideNames }
  | { kind: 'circle' }
  | { kind: 'ellipse' }
  | { kind: 'sketchAt'; primitive: CompactPathPrimitiveNaming };

/** Evaluated compact shape that can be flattened into profile segments. */
export type EvaluatedCompactPathPrimitive =
  | IRRectPrimitive
  | { kind: 'circle'; diameter: number }
  | IREllipsePrimitive
  | {
      kind: 'sketchAt';
      primitive: EvaluatedCompactPathPrimitive;
      x: number;
      y: number;
    };

/**
 * Returns the editor-canonical segment names for one mixed-path primitive.
 * Resolver validation, evaluator lowering, and visual reimport must agree on
 * names even though only evaluation has concrete dimensions.
 */
export function compactPathPrimitiveSegmentBases(
  primitive: CompactPathPrimitiveNaming,
  shapeIndex: number,
): string[] {
  const base = unwrapPlacement(primitive);
  if (base.kind === 'circle') {
    const prefix = `circle_${shapeIndex}`;
    return [
      `${prefix}_q1`,
      `${prefix}_q2`,
      `${prefix}_q3`,
      `${prefix}_q4`,
      `${prefix}_radius`,
    ];
  }
  if (base.kind === 'ellipse') return [`ellipse_${shapeIndex}`];
  return RECTANGLE_SIDES.map(
    (side) =>
      base.sideNames?.[side] ??
      (shapeIndex === 1 ? side : `rect_${shapeIndex}_${side}`),
  );
}

/**
 * Allocates the exact evaluated segment names for each source-ordered item.
 * Source metadata and resolver validation need per-item names, including
 * anonymous cursor segments and collision suffixes, before evaluation runs.
 */
export function compactPathItemSegmentNames(items: PathItem[]): string[][] {
  const used = new Set<string>();
  let generatedCount = 0;
  let shapeIndex = 0;
  return items.map((item) => {
    const bases =
      item.kind === 'segment'
        ? [item.name ?? `segment_${++generatedCount}`]
        : compactPathPrimitiveSegmentBases(item.primitive, ++shapeIndex);
    return bases.map((base) => {
      const name = uniqueNameWithSuffix(base, used);
      used.add(name);
      return name;
    });
  });
}

/**
 * Flattens a compact rectangle, circle, or ellipse into profile topology.
 * A mixed `path(...)` must retain construction geometry in one flat profile,
 * while compact primitives still reimport as the same editable segment groups
 * produced by the visual editor. The caller supplies collision-safe names.
 */
export function compactPathPrimitiveSegments(
  primitive: EvaluatedCompactPathPrimitive,
  shapeIndex: number,
  nameFor: (base: string) => string = (base) => base,
): IRProfileSegment[] | null {
  const placed = evaluatedBaseAndOffset(primitive);
  const names = compactPathPrimitiveSegmentBases(placed.primitive, shapeIndex);
  if (placed.primitive.kind === 'rect') {
    if ((placed.primitive.cornerRadius ?? 0) !== 0) return null;
    return rectangleSegments(placed.primitive, names, placed.x, placed.y).map(
      (segment) => ({ ...segment, name: nameFor(segment.name) }),
    );
  }
  if (placed.primitive.kind === 'ellipse') {
    return [
      ellipseSegment(placed.primitive, nameFor(names[0]), placed.x, placed.y),
    ];
  }
  return circleSegments(
    placed.primitive.diameter,
    names,
    placed.x,
    placed.y,
  ).map((segment) => ({ ...segment, name: nameFor(segment.name) }));
}

/**
 * Creates ellipse geometry from its center and radii.
 */
function ellipseSegment(
  primitive: IREllipsePrimitive,
  name: string,
  x: number,
  y: number,
): IRProfileSegment {
  const center: [number, number] = [x, y];
  const radiusX = primitive.width / 2;
  const radiusY = primitive.height / 2;
  const seam = ellipsePoint(center, radiusX, radiusY, 0);
  return {
    kind: 'ellipse',
    name,
    center,
    radiusX,
    radiusY,
    from: seam,
    to: seam,
    startAngle: 0,
    endAngle: Math.PI * 2,
    clockwise: false,
    full: true,
  };
}

/**
 * Creates rectangle geometry from the supplied dimensions.
 */
function rectangleSegments(
  primitive: IRRectPrimitive,
  names: string[],
  x: number,
  y: number,
): IRProfileSegment[] {
  return RECTANGLE_SIDES.map((side, index) => {
    const [from, to] = rectangleSideEndpoints(
      primitive.width,
      primitive.height,
      side,
    );
    return {
      kind: 'line',
      name: names[index],
      from: translate(from, x, y),
      to: translate(to, x, y),
      plant: primitive.plant === side || undefined,
    };
  });
}

/**
 * Creates circle geometry from its center and radius.
 */
function circleSegments(
  diameter: number,
  names: string[],
  x: number,
  y: number,
): IRProfileSegment[] {
  const radius = diameter / 2;
  const center: [number, number] = [x, y];
  const points: [number, number][] = [
    [x + radius, y],
    [x, y + radius],
    [x - radius, y],
    [x, y - radius],
  ];
  const arcs: IRProfileSegment[] = points.map((from, index) => ({
    kind: 'arc',
    name: names[index],
    from,
    to: points[(index + 1) % points.length],
    radius,
    clockwise: false,
  }));
  return [
    ...arcs,
    {
      kind: 'line',
      name: names[4],
      from: center,
      to: points[0],
      construction: true,
    },
  ];
}

/**
 * Handles unwrap placement in the geometry flow.
 */
function unwrapPlacement(
  primitive: CompactPathPrimitiveNaming,
): Exclude<CompactPathPrimitiveNaming, { kind: 'sketchAt' }> {
  return primitive.kind === 'sketchAt'
    ? unwrapPlacement(primitive.primitive)
    : primitive;
}

/**
 * Handles evaluated base and offset in the geometry flow.
 */
function evaluatedBaseAndOffset(primitive: EvaluatedCompactPathPrimitive): {
  primitive:
    | IRRectPrimitive
    | { kind: 'circle'; diameter: number }
    | IREllipsePrimitive;
  x: number;
  y: number;
} {
  if (primitive.kind !== 'sketchAt') return { primitive, x: 0, y: 0 };
  const nested = evaluatedBaseAndOffset(primitive.primitive);
  return {
    primitive: nested.primitive,
    x: nested.x + primitive.x,
    y: nested.y + primitive.y,
  };
}

/**
 * Translates by the supplied offset.
 */
function translate(
  point: [number, number],
  x: number,
  y: number,
): [number, number] {
  return [point[0] + x, point[1] + y];
}
