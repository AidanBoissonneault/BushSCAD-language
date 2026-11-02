/**
 * @author Aidan Boissonneault
 * @file native-brep-transfer.ts
 * @purpose Provides native brep transfer behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import type { getBridge } from '@bushscad/compiler/node';
import type { GeometrySummary } from './occt-probe-protocol.js';

/**
 * The initialized OpenCascade bridge used by the probe to build, import, and export native
 * shapes.
 */
type Bridge = Awaited<ReturnType<typeof getBridge>>;
/**
 * Minimal native-shape handle used by the BREP transfer probe; exposes null checking and native
 * cleanup.
 */
type NativeShape = { IsNull: () => boolean; delete: () => void };
/**
 * OpenCascade bindings needed by the BREP transfer probe to create a box, assemble a compound,
 * and write or read native shapes.
 */
type NativeOc = {
  FS: {
    readFile: (path: string) => Uint8Array;
    writeFile: (path: string, data: Uint8Array) => void;
    unlink: (path: string) => void;
  };
  BRepPrimAPI_MakeBox_2: new (
    x: number,
    y: number,
    z: number,
  ) => { Shape: () => NativeShape; delete: () => void };
  TopoDS_Shape: new () => NativeShape;
  BRep_Builder: new () => { delete: () => void };
  Message_ProgressRange_1: new () => { delete: () => void };
  BRepTools: {
    Write_2: (shape: NativeShape, path: string, progress: unknown) => boolean;
    Read_2: (
      shape: NativeShape,
      path: string,
      builder: unknown,
      progress: unknown,
    ) => boolean;
  };
  Bnd_Box_1: new () => {
    Get: (...bounds: { current: number }[]) => void;
    delete: () => void;
  };
  BRepBndLib: {
    Add: (shape: NativeShape, box: unknown, useTriangulation: boolean) => void;
  };
};

/** Serializes one native OCCT cuboid into the runtime's lossless BRep format. */
export function exportNativeBrep(bridge: Bridge): string {
  const oc = nativeOc(bridge);
  const path = '/parallel-compilation-probe.brep';
  const maker = new oc.BRepPrimAPI_MakeBox_2(40, 40, 60);
  const shape = maker.Shape();
  const progress = new oc.Message_ProgressRange_1();
  try {
    if (!oc.BRepTools.Write_2(shape, path, progress))
      throw new Error('BRepTools.Write_2 failed.');
    return Buffer.from(oc.FS.readFile(path)).toString('base64');
  } finally {
    removeIfPresent(oc, path);
    progress.delete();
    shape.delete();
    maker.delete();
  }
}

/** Restores a BRep in another runtime and reports its exact geometric bounds. */
export function importNativeBrep(
  bridge: Bridge,
  dataBase64: string,
): GeometrySummary {
  const oc = nativeOc(bridge);
  const path = '/parallel-compilation-import.brep';
  oc.FS.writeFile(path, new Uint8Array(Buffer.from(dataBase64, 'base64')));
  const shape = new oc.TopoDS_Shape();
  const builder = new oc.BRep_Builder();
  const progress = new oc.Message_ProgressRange_1();
  try {
    if (!oc.BRepTools.Read_2(shape, path, builder, progress) || shape.IsNull())
      throw new Error('BRepTools.Read_2 failed.');
    return summarizeNativeShape(oc, shape);
  } finally {
    removeIfPresent(oc, path);
    progress.delete();
    builder.delete();
    shape.delete();
  }
}

/**
 * Handles summarize native shape in the scripts parallel compilation flow.
 */
function summarizeNativeShape(
  oc: NativeOc,
  shape: NativeShape,
): GeometrySummary {
  const box = new oc.Bnd_Box_1();
  const refs = Array.from({ length: 6 }, () => ({ current: 0 }));
  oc.BRepBndLib.Add(shape, box, false);
  box.Get(...refs);
  box.delete();
  return {
    meshCount: 1,
    triangleCount: 0,
    bounds: {
      min: [refs[0].current, refs[1].current, refs[2].current],
      max: [refs[3].current, refs[4].current, refs[5].current],
    },
  };
}

/**
 * Handles native oc in the scripts parallel compilation flow.
 */
function nativeOc(bridge: Bridge): NativeOc {
  const oc = (bridge as unknown as { oc?: NativeOc }).oc;
  if (!oc) throw new Error('Probe could not access the isolated OCCT runtime.');
  return oc;
}

/**
 * Removes if present from its owning collection.
 */
function removeIfPresent(oc: NativeOc, path: string): void {
  try {
    oc.FS.unlink(path);
  } catch {
    // A failed read/write can leave no virtual file to remove.
  }
}
