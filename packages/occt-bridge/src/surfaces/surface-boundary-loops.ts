/**
 * @author Aidan Boissonneault
 * @file surface-boundary-loops.ts
 * @purpose Provides surface boundary loops behavior for the surfaces in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { occtError } from '../core/occt-errors.js';

/** Builds one planar face from a selector that resolves to a single wire. */
export function makeFaceFromEdges(oc: OC, edges: OC[], span: SourceSpan): OC {
  if (edges.length === 0) {
    throw occtError('fill: boundary selector resolved to no edges', span);
  }
  const wireMaker = new oc.BRepBuilderAPI_MakeWire_1();
  for (const edge of edges) wireMaker.Add_1(edge);
  if (!wireMaker.IsDone())
    throw occtError(
      'fill: selected edges are open, disconnected, self-intersecting, or form multiple ambiguous loops',
      span,
    );
  const wire = wireMaker.Wire();
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
  if (!faceMaker.IsDone())
    throw occtError(
      'fill: selected edge loop is not a closed, planar, non-self-intersecting boundary',
      span,
    );
  const face = faceMaker.Face();
  faceMaker.delete?.();
  wireMaker.delete?.();
  return face;
}

/**
 * Rebuilds a face from every wire selected by `.edges`.
 * Returning the original face hides whether the edge selector was honored.
 * Starting with the OCCT outer wire and adding each inner wire preserves holes
 * while keeping `.edges` on an explicit edge-loop construction path.
 */
export function makeFaceFromFaceLoops(oc: OC, face: OC, span: SourceSpan): OC {
  const outerWire = oc.BRepTools.OuterWire(face);
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(outerWire, false);
  const explorer = new oc.TopExp_Explorer_2(
    face,
    oc.TopAbs_ShapeEnum.TopAbs_WIRE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; explorer.More(); explorer.Next()) {
    const wire = oc.TopoDS.Wire_1(explorer.Current());
    if (!wire.IsSame?.(outerWire)) faceMaker.Add(wire);
    wire.delete?.();
  }
  explorer.delete?.();
  outerWire.delete?.();
  if (!faceMaker.IsDone())
    throw occtError('fill: selected face loops could not form a face', span);
  const rebuilt = faceMaker.Face();
  faceMaker.delete?.();
  return rebuilt;
}
