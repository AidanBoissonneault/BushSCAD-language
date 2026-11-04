/** Implements the wrap behavior owned by the OCCT bridge. */

import { LoftBridge } from '../loft/loft.js';

import type { IRPrimitive, IRPlacement, SourceSpan } from '@bushscad/ir';

import { parseFaceRef } from '../../core/program-utils.js';

import { readBounds, type Vec3 } from '../../core/geometry-utils.js';

import { workplaneFrame } from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class WrapBridge extends LoftBridge {
  protected override ensureCylindricalWrapTarget(
    state: GroupBuildState,
    placement: IRPlacement | null,
    span: SourceSpan,
  ): void {
    if (!placement)
      throw occtError('wrap:true requires a face placement', span);
    const parsed = parseFaceRef(placement.faceRef);
    if (!parsed.curved) {
      throw occtError('wrap:true requires a cylindrical .curved target', span);
    }
    const faces = state.labelMap.getAllFaceHandles(parsed.objName);
    if (faces.length === 0) {
      throw occtError(`Unknown object '${parsed.objName}' for wrap`, span);
    }
    if (!faces.some((face) => this.isCylinderFace(face))) {
      throw occtError('wrap:true target is not cylindrical', span);
    }
  }

  protected override isCylinderFace(face: OC): boolean {
    try {
      const BRepAdaptorSurface =
        this.oc.BRepAdaptor_Surface_2 ?? this.oc.BRepAdaptor_Surface;
      const adaptor = new BRepAdaptorSurface(face, true);
      const type = adaptor.GetType();
      adaptor.delete?.();
      return this.isCylinderSurfaceType(type);
    } catch {
      return false;
    }
  }

  protected override isCylinderSurfaceType(type: unknown): boolean {
    return (
      type === this.oc.GeomAbs_SurfaceType?.GeomAbs_Cylinder ||
      type === this.oc.GeomAbs_Cylinder ||
      type === 1 ||
      String(type).toLowerCase().includes('cylinder')
    );
  }

  protected override extractCylinderRadius(face: OC): number {
    try {
      const BRepAdaptorSurface =
        this.oc.BRepAdaptor_Surface_2 ?? this.oc.BRepAdaptor_Surface;
      const adaptor = new BRepAdaptorSurface(face, true);
      const type = adaptor.GetType();
      if (!this.isCylinderSurfaceType(type)) {
        adaptor.delete?.();
        return 0;
      }
      const cyl = adaptor.Cylinder();
      const r = cyl.Radius();
      cyl.delete?.();
      adaptor.delete?.();
      return r;
    } catch {
      return 0;
    }
  }

  protected override resolveCylindricalWrapGeometry(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
  ): {
    cylCenter: Vec3;
    cylAxisDir: Vec3;
    refXDir: Vec3;
    cylRadius: number;
    axialSize: number;
    sweepAngleDeg: number;
    centerAngleDeg: number;
  } | null {
    const prim = this.wrapRectanglePrimitive(state, sketchName);
    if (!prim) return null;

    const parsed = parseFaceRef(placement.faceRef);
    const cylRadius = this.firstCylinderRadius(state, parsed.objName);
    if (cylRadius <= 0) return null;
    const cylShape = state.labelMap.getShape(parsed.objName);
    if (!cylShape) return null;
    const cylCenter = this.shapeBoundsCenter(cylShape);

    const frame =
      state.bodyFrames.get(parsed.objName) ??
      workplaneFrame(state.defaultWorkplane);

    // rect width = axial extent (sketch X = cylinder axis), height = circumferential extent
    const axialSize = prim.width;
    const circumSize = prim.height;
    const sweepAngleDeg = (circumSize / cylRadius) * (180 / Math.PI);
    const centerAngleDeg = placement.surfaceAngleDeg ?? placement.angleDeg ?? 0;

    return {
      cylCenter,
      // axis = frame.z (extrude direction), angle-0 reference = frame.x
      cylAxisDir: frame.z,
      refXDir: frame.x,
      cylRadius,
      axialSize,
      sweepAngleDeg,
      centerAngleDeg,
    };
  }

  protected override wrapRectanglePrimitive(
    state: GroupBuildState,
    sketchName: string,
  ): Extract<IRPrimitive, { kind: 'rect' }> | null {
    const prim = state.sketchPrimitives.get(sketchName);
    return prim?.kind === 'rect' ? prim : null;
  }

  protected override firstCylinderRadius(
    state: GroupBuildState,
    objName: string,
  ): number {
    for (const face of state.labelMap.getAllFaceHandles(objName)) {
      const radius = this.extractCylinderRadius(face);
      if (radius > 0) return radius;
    }
    return 0;
  }

  protected override shapeBoundsCenter(shape: OC): Vec3 {
    const bounds = readBounds(this.oc, shape);
    return [
      (bounds.xMin.current + bounds.xMax.current) / 2,
      (bounds.yMin.current + bounds.yMax.current) / 2,
      (bounds.zMin.current + bounds.zMax.current) / 2,
    ];
  }

  protected override buildCylindricalWrapShape(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
    depth: number,
    span: SourceSpan,
  ): OC | null {
    const geo = this.resolveCylindricalWrapGeometry(
      state,
      sketchName,
      placement,
    );
    if (!geo) return null;

    return this.buildCylindricalWrapSolid(
      geo.cylCenter,
      geo.cylAxisDir,
      geo.refXDir,
      geo.cylRadius,
      geo.cylRadius + depth,
      geo.centerAngleDeg,
      geo.axialSize,
      geo.sweepAngleDeg,
      span,
    );
  }

  protected override buildCylindricalWrapCutTool(
    state: GroupBuildState,
    sketchName: string,
    placement: IRPlacement,
    through: boolean,
    depth: number | null,
    span: SourceSpan,
  ): OC | null {
    const geo = this.resolveCylindricalWrapGeometry(
      state,
      sketchName,
      placement,
    );
    if (!geo) return null;

    const {
      cylCenter,
      cylAxisDir,
      refXDir,
      cylRadius,
      axialSize,
      sweepAngleDeg,
      centerAngleDeg,
    } = geo;

    // Outer extends slightly past surface; inner is the cut floor
    const outerR = cylRadius + 1;
    const cutDepth = through ? cylRadius + 1 : (depth ?? cylRadius);
    const innerR = Math.max(cylRadius - cutDepth, 0.001);

    return this.buildCylindricalWrapSolid(
      cylCenter,
      cylAxisDir,
      refXDir,
      innerR,
      outerR,
      centerAngleDeg,
      axialSize,
      sweepAngleDeg,
      span,
    );
  }

  protected override buildCylindricalWrapSolid(
    cylCenter: Vec3,
    cylAxisDir: Vec3,
    refXDir: Vec3,
    innerRadius: number,
    outerRadius: number,
    centerAngleDeg: number,
    axialSize: number,
    sweepAngleDeg: number,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const h = axialSize;
    const Ri = innerRadius;
    const Ro = outerRadius;
    const clampedSweep = Math.max(
      0.1,
      Math.min(Math.abs(sweepAngleDeg), 359.9),
    );
    const sweepRad = (clampedSweep * Math.PI) / 180;

    // Rectangular profile in canonical XZ half-plane (axis=Z, ref=X):
    // radially Ri→Ro, axially -h/2→+h/2
    const pts: [number, number, number][] = [
      [Ri, 0, -h / 2],
      [Ro, 0, -h / 2],
      [Ro, 0, h / 2],
      [Ri, 0, h / 2],
    ];

    const wb = new oc.BRepBuilderAPI_MakeWire_1();
    const ptHandles = pts.map(([x, y, z]) => new oc.gp_Pnt_3(x, y, z));
    const edgeHandles: OC[] = [];
    for (let i = 0; i < 4; i++) {
      const e = new oc.BRepBuilderAPI_MakeEdge_3(
        ptHandles[i],
        ptHandles[(i + 1) % 4],
      ).Edge();
      wb.Add_1(e);
      edgeHandles.push(e);
    }
    const profileWire = wb.Wire();
    [...ptHandles, ...edgeHandles].forEach((o: OC) => {
      try {
        o?.delete?.();
      } catch {
        /* empty */
      }
    });
    wb.delete();

    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(profileWire, false);
    if (!faceMaker.IsDone()) throw occtError('Wrap: profile face failed', span);
    const profileFace = faceMaker.Face();
    faceMaker.delete();
    profileWire.delete();

    // Revolve profile around canonical Z by sweepRad
    const zOrig = new oc.gp_Pnt_3(0, 0, 0);
    const zDirObj = new oc.gp_Dir_4(0, 0, 1);
    const revolveAx1 = new oc.gp_Ax1_2(zOrig, zDirObj);
    const revol = new oc.BRepPrimAPI_MakeRevol_1(
      profileFace,
      revolveAx1,
      sweepRad,
      false,
    );
    if (!revol.IsDone()) throw occtError('Wrap: revolve failed', span);
    let shape = revol.Shape();
    profileFace.delete();
    zOrig.delete();
    zDirObj.delete();
    revolveAx1.delete();
    revol.delete();

    // Rotate shape in canonical space so it is centered at centerAngleDeg
    const startAngleDeg = centerAngleDeg - clampedSweep / 2;
    if (Math.abs(startAngleDeg) > 0.001) {
      shape = this.rotateShape(shape, [0, 0, 0], [0, 0, 1], startAngleDeg);
    }

    // SetDisplacement from canonical (origin=[0,0,0], Z=[0,0,1], X=[1,0,0])
    // to actual cylinder frame (origin=cylCenter, Z=cylAxisDir, X=refXDir)
    const [cx, cy, cz] = cylCenter;
    const [dax, day, daz] = cylAxisDir;
    const [rx, ry, rz] = refXDir;

    const srcOrig = new oc.gp_Pnt_3(0, 0, 0);
    const srcZ = new oc.gp_Dir_4(0, 0, 1);
    const srcX = new oc.gp_Dir_4(1, 0, 0);
    const srcAx3 = new oc.gp_Ax3_3(srcOrig, srcZ, srcX);

    const trgOrig = new oc.gp_Pnt_3(cx, cy, cz);
    const trgZ = new oc.gp_Dir_4(dax, day, daz);
    const trgX = new oc.gp_Dir_4(rx, ry, rz);
    const trgAx3 = new oc.gp_Ax3_3(trgOrig, trgZ, trgX);

    const trsf = new oc.gp_Trsf_1();
    trsf.SetDisplacement(srcAx3, trgAx3);
    const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
    shape.delete?.();
    [srcOrig, srcZ, srcX, srcAx3, trgOrig, trgZ, trgX, trgAx3, trsf].forEach(
      (o: OC) => {
        try {
          o?.delete?.();
        } catch {
          /* empty */
        }
      },
    );

    return moved;
  }
}
