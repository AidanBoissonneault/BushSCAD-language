/**
 * @author Aidan Boissonneault
 * @file occt-shape-exporter.ts
 * @purpose Writes OpenCascade shapes to STEP and STL export buffers.
 * @last-edited October 6, 2026
 */

import type { ExportFormat } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { meshShapeWithOptions } from '../mesh/mesh-options.js';
import { readExportFile } from './export-files.js';

/**
 * Owns format-specific writing of built OpenCascade shapes.
 * The bridge delegates STEP and STL output here so serialization details stay
 * with the export responsibility rather than the build orchestrator.
 */
export class OcctShapeExporter {
  /** Creates an exporter bound to the initialized OpenCascade runtime. */
  constructor(private readonly oc: OC) {}

  /**
   * Serializes a shape as STEP or STL and returns its named file buffer.
   */
  exportShape(
    shape: OC,
    name: string,
    format: ExportFormat,
  ): { name: string; data: ArrayBuffer } {
    const oc = this.oc;
    if (format === 'step') {
      const fname = `/${name}.step`;
      const writer = new oc.STEPControl_Writer_1();
      const progress = new oc.Message_ProgressRange_1();
      if (typeof writer.Transfer_1 === 'function') {
        writer.Transfer_1(
          shape,
          oc.STEPControl_StepModelType.STEPControl_AsIs,
          1,
        );
      } else {
        writer.Transfer(
          shape,
          oc.STEPControl_StepModelType.STEPControl_AsIs,
          true,
          progress,
        );
      }
      writer.Write(fname);
      return readExportFile(oc, fname, `${name}.step`, progress, writer);
    }

    // Mesh before STL export so the native writer receives current triangles.
    meshShapeWithOptions(oc, shape);
    const fname = `/${name}.stl`;
    const writer =
      typeof oc.StlAPI_Writer_1 === 'function'
        ? new oc.StlAPI_Writer_1()
        : new oc.StlAPI_Writer();
    const progress = new oc.Message_ProgressRange_1();
    if (typeof writer.Write_1 === 'function') {
      writer.Write_1(shape, fname);
    } else {
      writer.Write(shape, fname, progress);
    }
    return readExportFile(oc, fname, `${name}.stl`, progress, writer);
  }
}
