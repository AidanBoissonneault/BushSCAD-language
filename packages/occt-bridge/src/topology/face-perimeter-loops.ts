/**
 * @author Aidan Boissonneault
 * @file face-perimeter-loops.ts
 * @purpose Groups sampled face edges into perimeter loops for topology selection.
 * @last-edited October 6, 2026
 */

/**
 * point2 represented by readonly [number, number].
 */

type Point2 = readonly [number, number];

/**
 * Projected face edge, including edge and point geometry.
 */
type ProjectedFaceEdge = {
  edge: unknown;
  points: Point2[];
};

/**
 * Loop, including edges, point geometry, area, and test point.
 */
type Loop = {
  edges: unknown[];
  points: Point2[];
  area: number;
  testPoint: Point2;
};

const POINT_TOLERANCE = 1e-4;

/**
 * Selects the outer boundary loops from sampled face edges.
 * Full circular edges have identical endpoints, so bbox/end-point perimeter
 * tests miss them. Sampling preserves curved loop area and lets `.perimeter`
 * resolve circle and arc boundaries as actual CAD edges.
 */
export function selectSampledOuterLoopEdges(
  edges: ProjectedFaceEdge[],
): unknown[] {
  const loops = buildLoops(edges);
  return loops
    .filter((loop) => !isInsideLargerLoop(loop, loops))
    .flatMap((loop) => loop.edges);
}

/**
 * Builds loops from the supplied inputs.
 */
function buildLoops(edges: ProjectedFaceEdge[]): Loop[] {
  const remaining = loopCandidates(edges);
  const loops: Loop[] = [];
  const used = new Set<number>();

  for (let i = 0; i < remaining.length; i++) {
    if (used.has(i)) continue;
    const loop = traceLoop(remaining, used, i);
    if (loop) loops.push(loop);
  }
  return loops;
}

/**
 * Handles loop candidates in the topology flow.
 */
function loopCandidates(
  edges: ProjectedFaceEdge[],
): Array<{ edge: unknown; points: Point2[] }> {
  return edges
    .map((edge) => ({ edge: edge.edge, points: cleanPoints(edge.points) }))
    .filter((edge) => edge.points.length >= 2);
}

/**
 * Handles trace loop in the topology flow.
 */
function traceLoop(
  edges: Array<{ edge: unknown; points: Point2[] }>,
  used: Set<number>,
  index: number,
): Loop | null {
  used.add(index);
  const loopEdges = [edges[index].edge];
  const loopPoints = [...edges[index].points];
  extendLoop(edges, used, loopEdges, loopPoints);
  return loopPoints.length >= 3 && isClosed(loopPoints)
    ? makeLoop(loopEdges, loopPoints)
    : null;
}

/**
 * Handles extend loop in the topology flow.
 */
function extendLoop(
  edges: Array<{ edge: unknown; points: Point2[] }>,
  used: Set<number>,
  loopEdges: unknown[],
  loopPoints: Point2[],
): void {
  while (!isClosed(loopPoints)) {
    const next = findNextEdge(edges, used, lastPoint(loopPoints));
    if (!next) return;
    used.add(next.index);
    loopEdges.push(next.edge.edge);
    loopPoints.push(...next.points.slice(1));
  }
}

/**
 * Returns next edge from the supplied input.
 */
function findNextEdge(
  edges: Array<{ edge: unknown; points: Point2[] }>,
  used: Set<number>,
  point: Point2,
): {
  index: number;
  edge: { edge: unknown; points: Point2[] };
  points: Point2[];
} | null {
  for (let index = 0; index < edges.length; index++) {
    if (used.has(index)) continue;
    const edge = edges[index];
    const points = orientEdgePoints(edge.points, point);
    if (points) return { index, edge, points };
  }
  return null;
}

/**
 * Handles orient edge points in the topology flow.
 */
function orientEdgePoints(points: Point2[], point: Point2): Point2[] | null {
  if (samePoint(point, points[0])) return points;
  return samePoint(point, lastPoint(points)) ? [...points].reverse() : null;
}

/**
 * Constructs loop from the supplied values.
 */
function makeLoop(edges: unknown[], points: Point2[]): Loop {
  const area = polygonArea(points);
  return {
    edges,
    points,
    area,
    testPoint: averagePoint(points),
  };
}

/**
 * Returns whether the input meets the `inside larger loop` condition.
 */
function isInsideLargerLoop(loop: Loop, loops: Loop[]): boolean {
  const area = Math.abs(loop.area);
  return loops.some(
    (candidate) =>
      candidate !== loop &&
      Math.abs(candidate.area) > area + POINT_TOLERANCE &&
      pointInPolygon(loop.testPoint, candidate.points),
  );
}

/**
 * Handles clean points in the topology flow.
 */
function cleanPoints(points: Point2[]): Point2[] {
  return preserveClosingPoint(removeConsecutiveDuplicates(points));
}

/**
 * Removes consecutive duplicates from its owning collection.
 */
function removeConsecutiveDuplicates(points: Point2[]): Point2[] {
  const clean: Point2[] = [];
  for (const point of points) {
    if (clean.length === 0 || !samePoint(point, lastPoint(clean))) {
      clean.push(point);
    }
  }
  return clean;
}

/**
 * Handles preserve closing point in the topology flow.
 */
function preserveClosingPoint(points: Point2[]): Point2[] {
  if (points.length > 2 && samePoint(points[0], lastPoint(points))) {
    return [...points.slice(0, -1), points[0]];
  }
  return points;
}

/**
 * Handles polygon area in the topology flow.
 */
function polygonArea(points: Point2[]): number {
  let area = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    area += points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1];
  }
  return area / 2;
}

/**
 * Handles average point in the topology flow.
 */
function averagePoint(points: Point2[]): Point2 {
  const count = Math.max(1, points.length - 1);
  const usable = points.slice(0, count);
  return [
    usable.reduce((sum, point) => sum + point[0], 0) / count,
    usable.reduce((sum, point) => sum + point[1], 0) / count,
  ];
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointInPolygon(point: Point2, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Returns whether the input meets the `closed` condition.
 */
function isClosed(points: Point2[]): boolean {
  return points.length > 2 && samePoint(points[0], lastPoint(points));
}

/**
 * Checks whether the supplied point values are equivalent.
 */
function samePoint(a: Point2, b: Point2): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= POINT_TOLERANCE;
}

/**
 * Handles last point in the topology flow.
 */
function lastPoint<T>(items: T[]): T {
  return items[items.length - 1];
}
