/** Implements the program behavior owned by the OCCT bridge. */

import { BuildingBridge } from '../../mesh/building/building.js';

import type {
  IRProgram,
  ExportFormat,
  DrawingProgram,
  DrawingResult,
  NativeBooleanBatchPlan,
} from '@bushscad/ir';

import { buildDrawingResults } from '../../drawing/build-drawings.js';

import {
  exportNameForPartGroup,
  partitionByPart,
} from '../../core/program-utils.js';

import { deleteBuiltPartShapes } from '../../mesh/material-shapes.js';

import type { OC } from '../../bridge/bridge-types.js';

export abstract class ProgramBridge extends BuildingBridge {
  protected override exportProgram(
    program: IRProgram,
    format: ExportFormat,
    drawingProgram?: DrawingProgram,
    nativeBooleanPlan?: NativeBooleanBatchPlan,
    nativeBooleanConcurrencyLimit = 1,
  ): {
    buffers: { name: string; data: ArrayBuffer }[];
    drawings: DrawingResult[];
  } {
    const groups = partitionByPart(program.ops);
    const hasExplicitParts =
      program.parts.length > 0 ||
      groups.some((group) => group.name !== '__default__');
    const { parts: builtParts } = this.buildGroupsWithPartLabels(
      groups,
      program.workplane ?? 'XY',
      undefined,
      undefined,
      nativeBooleanPlan,
      nativeBooleanConcurrencyLimit,
    );
    try {
      const buffers = builtParts.map(({ group, shape }) => {
        const name = exportNameForPartGroup(group.name, hasExplicitParts);
        return this.exportShape(shape, name, format);
      });
      const { shapeMap, colorMap } = this.collectShapeAndColorMaps(builtParts);
      const drawings = [
        ...buildDrawingResults(this.oc, drawingProgram, shapeMap, colorMap),
      ];
      return { buffers, drawings };
    } finally {
      deleteBuiltPartShapes(builtParts);
    }
  }

  protected override exportShape(
    shape: OC,
    name: string,
    format: ExportFormat,
  ): { name: string; data: ArrayBuffer } {
    return this.shapeExporter.exportShape(shape, name, format);
  }
}
