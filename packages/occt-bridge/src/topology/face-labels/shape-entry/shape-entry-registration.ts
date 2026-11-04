/** Owns registered shape entry metadata for the OCCT topology layer. */
import {
  type ShapeEntry,
  type FaceFrame,
  type SourceShapeEntry,
} from '../types.js';
import {
  classifyFaces,
  captureSourceShapeEntry,
  getBounds,
} from '../selection/selection-resolution.js';
import { readBounds } from '../../../core/geometry-utils.js';
import { type SourceAttachmentPlane } from '../../source-edge-recovery.js';
import type { OC } from '../../face-placement-transform.js';

/**
 * Handles registered shape entry in the topology flow.
 */
export function registeredShapeEntry(
  oc: OC,
  name: string,
  shape: unknown,
  edgeMode: ShapeEntry['edgeMode'],
  frame: FaceFrame,
  regionShape?: unknown,
  attachmentPlane?: SourceAttachmentPlane,
): ShapeEntry {
  const source = sourceShapeEntry(
    oc,
    regionShape,
    edgeMode,
    frame,
    attachmentPlane,
  );
  return {
    shape,
    faces: classifyFaces(oc, shape, frame, regionShape),
    edgeMode,
    frame,
    ...registeredRegionMetadata(oc, name, regionShape, frame),
    ...(source ? { source } : {}),
    ...(attachmentPlane ? { attachmentPlane } : {}),
  };
}

/**
 * Returns the source data required by the current operation.
 */
function sourceShapeEntry(
  oc: OC,
  regionShape: unknown,
  edgeMode: ShapeEntry['edgeMode'],
  frame: FaceFrame,
  attachmentPlane?: SourceAttachmentPlane,
): SourceShapeEntry | undefined {
  return regionShape
    ? captureSourceShapeEntry(oc, regionShape, edgeMode, frame, attachmentPlane)
    : undefined;
}

/**
 * Handles registered region metadata in the topology flow.
 */
function registeredRegionMetadata(
  oc: OC,
  name: string,
  regionShape: unknown,
  frame: FaceFrame,
): Partial<ShapeEntry> {
  if (!regionShape) return {};
  return {
    regionBounds: readBounds(oc, regionShape),
    regionLocalBounds: getBounds(oc, regionShape, frame),
    regionName: name,
    ...regionToolMetadata(regionShape),
    ...regionTagMetadata(regionShape),
  };
}

/**
 * Handles region tool metadata in the topology flow.
 */
function regionToolMetadata(regionShape: unknown): Partial<ShapeEntry> {
  const regionToolKind = (regionShape as { _solidCutToolKind?: string })
    ._solidCutToolKind;
  return regionToolKind ? { regionToolKind } : {};
}

/**
 * Handles region tag metadata in the topology flow.
 */
function regionTagMetadata(regionShape: unknown): Partial<ShapeEntry> {
  const regionTag = (regionShape as { _region?: unknown })._region;
  return regionTag ? { regionTag } : {};
}
