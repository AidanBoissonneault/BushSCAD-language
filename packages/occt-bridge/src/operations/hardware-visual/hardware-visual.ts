/** Implements the hardware visual behavior owned by the OCCT bridge. */

import { ImportedShapesBridge } from '../imported-shapes/imported-shapes.js';

import type { IRHardwareVisual } from '@bushscad/ir';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class HardwareVisualBridge extends ImportedShapesBridge {
  protected override buildHardwareVisualOperation(
    state: GroupBuildState,
    op: IRHardwareVisual,
  ): void {
    const ax2 = state.labelMap.resolveAxis(this.oc, op.placement) as OC;
    try {
      const shapes: OC[] = [];

      // Shaft / insert body: circle wire positioned at ax2, extruded inward (-depth)
      const shaftWire = this.buildCircle(op.diameterMm / 2);
      const shaftFace = this.buildFaceFromWire(shaftWire, 'circle', op.span);
      shaftWire.delete();
      const shaftPlaced = this.positionFace(shaftFace, ax2);
      shaftFace.delete();
      const shaftShape = this.applyExtrude(
        shaftPlaced,
        ax2,
        -op.heightMm,
        false,
        op.span,
      );
      shaftPlaced.delete();
      shapes.push(shaftShape);

      // Bolt head: larger circle at ax2, extruded outward (+depth above surface)
      if (op.hardwareKind === 'bolt' && op.headDiameterMm && op.headHeightMm) {
        const headWire = this.buildCircle(op.headDiameterMm / 2);
        const headFace = this.buildFaceFromWire(headWire, 'circle', op.span);
        headWire.delete();
        const headPlaced = this.positionFace(headFace, ax2);
        headFace.delete();
        const headShape = this.applyExtrude(
          headPlaced,
          ax2,
          op.headHeightMm,
          false,
          op.span,
        );
        headPlaced.delete();
        shapes.push(headShape);
      }

      const finalShape =
        shapes.length === 1 ? shapes[0] : this.buildCompound(shapes);

      const mesh = this.extractMesh(finalShape);
      state.hardwareVisuals.push({ op, mesh });
    } finally {
      (ax2 as OC).delete();
    }
  }
}
