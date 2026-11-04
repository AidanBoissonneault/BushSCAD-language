/** Implements the 2d behavior owned by the OCCT bridge. */

import { FacesBridge } from '../../sketch/faces/faces.js';

import { arcPoint, pointsDiffer } from '../../profiles/profile-utils.js';

import { makeXYCircleHandles } from '../../profiles/xy-circle.js';

import type { OC } from '../../bridge/bridge-types.js';

export abstract class PlanarShapeBridge extends FacesBridge {
  protected override buildRect(w: number, h: number): OC {
    return this.buildRectAt(w, h, 0, 0);
  }

  protected override buildRectAt(
    w: number,
    h: number,
    cx: number,
    cy: number,
  ): OC {
    const hw = w / 2,
      hh = h / 2;
    return this.buildClosedPolylineWire([
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ]);
  }

  protected override buildCircle(radius: number): OC {
    const oc = this.oc;
    const { origin, zDir, xDir, ax2, circ } = this.makeXYCircle(0, 0, radius);
    const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ).Edge();
    const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
    [origin, zDir, xDir, ax2, circ, edge].forEach((o: OC) => o.delete());
    return wire;
  }

  protected override buildRoundRect(w: number, h: number, r: number): OC {
    const oc = this.oc;
    const hw = w / 2,
      hh = h / 2;
    const radius = Math.min(Math.max(r, 0), hw, hh);
    if (radius <= 1e-9) return this.buildRect(w, h);

    // Corner centers: [cx, cy, startAngle, endAngle (CCW)]
    const corners: [number, number, number, number][] = [
      [-hw + radius, -hh + radius, 180, 270], // bottom-left
      [hw - radius, -hh + radius, 270, 360], // bottom-right
      [hw - radius, hh - radius, 0, 90], // top-right
      [-hw + radius, hh - radius, 90, 180], // top-left
    ];
    const wb = new oc.BRepBuilderAPI_MakeWire_1();
    const edges: OC[] = [];

    for (let i = 0; i < 4; i++) {
      const [cx, cy, a0, a1] = corners[i];
      const [ncx, ncy, nextA0] = corners[(i + 1) % 4];

      // Arc at corner i
      const arcEdge = this.buildArcEdge(cx, cy, radius, a0, a1);
      wb.Add_1(arcEdge);
      edges.push(arcEdge);

      // Straight edge to next corner arc start
      const exit = arcPoint(cx, cy, radius, a1);
      const entry = arcPoint(ncx, ncy, radius, nextA0);
      if (pointsDiffer(exit, entry)) {
        const exitPt = new oc.gp_Pnt_3(...exit);
        const entryPt = new oc.gp_Pnt_3(...entry);
        const linEdge = new oc.BRepBuilderAPI_MakeEdge_3(
          exitPt,
          entryPt,
        ).Edge();
        wb.Add_1(linEdge);
        edges.push(linEdge);
        [exitPt, entryPt].forEach((o: OC) => o.delete());
      }
    }

    const wire = wb.Wire();
    edges.forEach((o: OC) => o.delete());
    wb.delete();
    return wire;
  }

  protected override buildArcEdge(
    cx: number,
    cy: number,
    r: number,
    a0deg: number,
    a1deg: number,
  ): OC {
    const oc = this.oc;
    const { origin, zDir, xDir, ax2, circ } = this.makeXYCircle(cx, cy, r);
    const a0 = (a0deg * Math.PI) / 180;
    const a1 = (a1deg * Math.PI) / 180;
    const edge = new oc.BRepBuilderAPI_MakeEdge_9(circ, a0, a1).Edge();
    [origin, zDir, xDir, ax2, circ].forEach((o: OC) => o.delete());
    return edge;
  }

  protected override buildTriangle(base: number, height: number): OC {
    return this.buildClosedPolylineWire([
      [-base / 2, 0],
      [base / 2, 0],
      [0, height],
    ]);
  }

  protected override buildPolygon(points: [number, number][]): OC {
    return this.buildClosedPolylineWire(points);
  }

  protected override buildClosedPolylineWire(
    points: readonly (readonly [number, number])[],
  ): OC {
    const oc = this.oc;
    const wb = new oc.BRepBuilderAPI_MakeWire_1();
    const pointHandles = points.map(([x, y]) => new oc.gp_Pnt_3(x, y, 0));
    const edgeHandles: OC[] = [];
    for (let i = 0; i < pointHandles.length; i++) {
      const edge = new oc.BRepBuilderAPI_MakeEdge_3(
        pointHandles[i],
        pointHandles[(i + 1) % pointHandles.length],
      ).Edge();
      wb.Add_1(edge);
      edgeHandles.push(edge);
    }
    const wire = wb.Wire();
    [...pointHandles, ...edgeHandles].forEach((o: OC) => o.delete());
    wb.delete();
    return wire;
  }

  protected override makeXYCircle(
    cx: number,
    cy: number,
    radius: number,
  ): { origin: OC; zDir: OC; xDir: OC; ax2: OC; circ: OC } {
    return makeXYCircleHandles(this.oc, cx, cy, radius);
  }
}
