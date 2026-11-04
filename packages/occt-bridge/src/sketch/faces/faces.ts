/** Implements the faces behavior owned by the OCCT bridge. */

import { ChamferBridge } from '../../operations/chamfer/chamfer.js';

import type {
  IRPrimitive,
  IRProfileSegment,
  OcctError,
  SourceSpan,
} from '@bushscad/ir';

import { profileSegmentsAreClosed } from '@bushscad/ir';

import { type Vec3 } from '../../core/geometry-utils.js';

import {
  buildProfileFaceForPrimitive,
  buildProfileWireFromSegments,
} from '../../profiles/profile-faces.js';

import { buildXYEllipseWire } from '../../profiles/xy-ellipse.js';

import { occtError } from '../../core/occt-errors.js';

import { transformToAxis } from '../../primitives/solid-primitive-geometry.js';

import { applyStableBoolFuse } from '../../operations/boolean-operations.js';

import type { OC } from '../../bridge/bridge-types.js';

export abstract class FacesBridge extends ChamferBridge {
  protected override buildSketchFace(prim: IRPrimitive, span: SourceSpan): OC {
    if (prim.kind === 'sketchAlias') {
      return this.buildSketchFace(prim.primitive, span);
    }
    if (prim.kind === 'word')
      return this.buildWordShape(
        prim.text,
        prim.size,
        prim.font,
        prim.align,
        span,
      );
    if (prim.kind === 'sketchAt') {
      const face = this.buildSketchFace(prim.primitive, span);
      return this.translateSketchShape(face, prim.x, prim.y);
    }
    if (prim.kind === 'sketchBoolean') {
      const left = this.buildSketchFace(prim.left, span);
      const right = this.buildSketchFace(prim.right, span);
      return prim.op === 'add'
        ? applyStableBoolFuse(this.oc, left, right, span, 'Sketch union failed')
        : this.applyBoolCut(left, right, span);
    }
    if (prim.kind === 'sketchRef') {
      throw occtError(`Unresolved sketch reference '${prim.name}'`, span);
    }
    // Composite wrappers recurse here, so closed profiles still need their
    // multi-loop face builder rather than one disconnected wire.
    if (prim.kind === 'profile' && profileSegmentsAreClosed(prim.segments)) {
      return buildProfileFaceForPrimitive(this.oc, prim, span);
    }

    const wire = this.buildWire(prim, span);
    return this.buildFaceFromWire(wire, prim.kind, span);
  }

  protected override isCompositeSketch(prim: IRPrimitive): boolean {
    if (prim.kind === 'sketchAlias') {
      return this.isCompositeSketch(prim.primitive);
    }
    return prim.kind === 'sketchAt' || prim.kind === 'sketchBoolean';
  }

  protected override buildFaceFromWire(
    wire: OC,
    kind: string,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
    if (!faceMaker.IsDone())
      throw occtError(`Face build failed for ${kind}`, span);
    const face = faceMaker.Face();
    faceMaker.delete();
    return face;
  }

  protected override positionFace(face: OC, ax2: OC): OC {
    return transformToAxis(this.oc, face, ax2);
  }

  protected override translateSketchShape(shape: OC, x: number, y: number): OC {
    const oc = this.oc;
    const trsf = new oc.gp_Trsf_1();
    const vec = new oc.gp_Vec_4(x, y, 0);
    trsf.SetTranslation_1(vec);
    const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
    vec.delete();
    trsf.delete();
    return moved;
  }

  protected override applyRotation(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
    copy: boolean,
  ): OC {
    const oc = this.oc;
    const trsf = new oc.gp_Trsf_1();
    const pnt = new oc.gp_Pnt_3(point[0], point[1], point[2]);
    const axisDir = new oc.gp_Dir_4(dir[0], dir[1], dir[2]);
    const axis = new oc.gp_Ax1_2(pnt, axisDir);
    const setRotation = trsf.SetRotation_1 ?? trsf.SetRotation;
    if (typeof setRotation !== 'function') {
      throw new Error('gp_Trsf rotation API is unavailable');
    }
    setRotation.call(trsf, axis, (angleDeg * Math.PI) / 180);
    const rotated = new oc.BRepBuilderAPI_Transform_2(
      shape,
      trsf,
      copy,
    ).Shape();
    axis.delete?.();
    axisDir.delete();
    pnt.delete();
    trsf.delete();
    return rotated;
  }

  protected override rotateShapeCopy(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
  ): OC {
    return this.applyRotation(shape, point, dir, angleDeg, true);
  }

  protected override rotateShape(
    shape: OC,
    point: Vec3,
    dir: Vec3,
    angleDeg: number,
  ): OC {
    return this.applyRotation(shape, point, dir, angleDeg, false);
  }

  protected override buildWire(prim: IRPrimitive, span: SourceSpan): OC {
    if (prim.kind === 'sketchAlias') {
      return this.buildWire(prim.primitive, span);
    }
    const builder = this.wirePrimitiveBuilders()[prim.kind];
    if (builder) return builder(prim);
    throw this.unsupportedWirePrimitiveError(prim, span);
  }

  protected override wirePrimitiveBuilders(): Partial<
    Record<IRPrimitive['kind'], (prim: IRPrimitive) => OC>
  > {
    return {
      rect: (prim) => {
        const rect = prim as Extract<IRPrimitive, { kind: 'rect' }>;
        return this.buildRect(rect.width, rect.height);
      },
      circle: (prim) => {
        const circle = prim as Extract<IRPrimitive, { kind: 'circle' }>;
        return this.buildCircle(circle.diameter / 2);
      },
      ellipse: (prim) => {
        const ellipse = prim as Extract<IRPrimitive, { kind: 'ellipse' }>;
        return buildXYEllipseWire(this.oc, ellipse.width, ellipse.height);
      },
      roundrect: (prim) => {
        const roundrect = prim as Extract<IRPrimitive, { kind: 'roundrect' }>;
        return this.buildRoundRect(
          roundrect.width,
          roundrect.height,
          roundrect.radius,
        );
      },
      triangle: (prim) => {
        const triangle = prim as Extract<IRPrimitive, { kind: 'triangle' }>;
        return this.buildTriangle(triangle.base, triangle.height);
      },
      polygon: (prim) => {
        const polygon = prim as Extract<IRPrimitive, { kind: 'polygon' }>;
        return this.buildPolygon(polygon.points);
      },
      profile: (prim) => {
        const profile = prim as Extract<IRPrimitive, { kind: 'profile' }>;
        return this.buildProfileWire(profile.segments);
      },
    };
  }

  protected override unsupportedWirePrimitiveError(
    prim: IRPrimitive,
    span: SourceSpan,
  ): OcctError {
    if (prim.kind === 'word') {
      return occtError('Word sketch must be built as a compound shape', span);
    }
    if (prim.kind === 'sketchRef') {
      return occtError(`Unresolved sketch reference '${prim.name}'`, span);
    }
    return occtError(
      'Composite sketch does not expose a single source wire',
      span,
    );
  }

  protected override buildProfileWire(segments: IRProfileSegment[]): OC {
    return buildProfileWireFromSegments(this.oc, segments);
  }
}
