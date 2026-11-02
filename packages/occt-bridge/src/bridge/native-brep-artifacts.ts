/**
 * @author Aidan Boissonneault
 * @file native-brep-artifacts.ts
 * @purpose Provides native brep artifacts behavior for the bridge in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from './bridge-types.js';

let nextArtifactFileId = 1;

/** Serializes one worker-owned shape into OCCT's lossless native BRep format. */
export function serializeNativeBrep(oc: OC, shape: OC): Uint8Array {
  const path = artifactPath('write');
  const progress = new oc.Message_ProgressRange_1();
  try {
    if (!oc.BRepTools.Write_2(shape, path, progress))
      throw new Error('BRepTools.Write_2 failed for prepared component.');
    return new Uint8Array(oc.FS.readFile(path));
  } finally {
    removeArtifactFile(oc, path);
    progress.delete?.();
  }
}

/** Restores a native BRep artifact into the receiving worker's OCCT runtime. */
export function deserializeNativeBrep(oc: OC, data: Uint8Array): OC {
  const path = artifactPath('read');
  oc.FS.writeFile(path, data);
  const shape = new oc.TopoDS_Shape();
  const builder = new oc.BRep_Builder();
  const progress = new oc.Message_ProgressRange_1();
  try {
    if (!oc.BRepTools.Read_2(shape, path, builder, progress) || shape.IsNull())
      throw new Error('BRepTools.Read_2 failed for prepared component.');
    return shape;
  } catch (error) {
    shape.delete?.();
    throw error;
  } finally {
    removeArtifactFile(oc, path);
    progress.delete?.();
    builder.delete?.();
  }
}

/**
 * Handles artifact path in the bridge flow.
 */
function artifactPath(direction: 'read' | 'write'): string {
  return `/parallel-component-${direction}-${nextArtifactFileId++}.brep`;
}

/**
 * Removes artifact file from its owning collection.
 */
function removeArtifactFile(oc: OC, path: string): void {
  try {
    oc.FS.unlink(path);
  } catch {
    // A failed read or write can leave no virtual file to remove.
  }
}
