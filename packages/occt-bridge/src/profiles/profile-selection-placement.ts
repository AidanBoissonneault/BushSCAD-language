/**
 * @author Aidan Boissonneault
 * @file profile-selection-placement.ts
 * @purpose Provides profile selection placement behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import {
  profileSelectionSource,
  type IRPrimitive,
  type IRProfileSelectionSource,
  type SourceSpan,
} from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { occtError } from '../core/occt-errors.js';
import { buildProfileFaceForPrimitive } from './profile-faces.js';
import { profileNeedsExactRegionSolid } from './profile-region-solids.js';

/**
 * Defines the `LocalFaceTranslator` callback contract used by the profiles layer.
 */
type LocalFaceTranslator = (face: OC, x: number, y: number) => OC;

/**
 * Resolves a translated profile only when its body selection needs exact solids.
 * Exact-region construction consumes the inner profile, but its caller must
 * retain the accumulated local translation for every loop face it builds.
 */
export function exactRegionProfileSelectionSource(
  primitive: IRPrimitive | undefined,
  selectedNames?: string[],
): IRProfileSelectionSource | null {
  const source = profileSelectionSource(primitive);
  return source && profileNeedsExactRegionSolid(source.profile, selectedNames)
    ? source
    : null;
}

/** Returns a local-face transform that preserves accumulated sketch placement. */
export function profileSelectionLocalFaceTransform(
  source: IRProfileSelectionSource,
  translate: LocalFaceTranslator,
): ((face: OC) => OC) | undefined {
  if (source.x === 0 && source.y === 0) return undefined;
  return (face) => translate(face, source.x, source.y);
}

/**
 * Builds a selected profile face and reapplies its local sketch translation.
 * The full sketch face is already translated when registered, while a selected
 * face is rebuilt from the inner profile and therefore needs the same wrapper.
 */
export function buildPlacedSelectedProfileFace(options: {
  oc: OC;
  primitive: IRPrimitive | undefined;
  sketchName: string;
  selectedNames: string[];
  span: SourceSpan;
  translate: LocalFaceTranslator;
}): OC {
  const source = profileSelectionSource(options.primitive);
  if (!source) {
    throw occtError(
      `Sketch '${options.sketchName}' does not contain selectable closed bodies`,
      options.span,
    );
  }
  const face = buildProfileFaceForPrimitive(
    options.oc,
    source.profile,
    options.span,
    options.selectedNames,
  );
  const transform = profileSelectionLocalFaceTransform(
    source,
    options.translate,
  );
  if (!transform) return face;
  const translated = transform(face);
  if (translated !== face) face.delete?.();
  return translated;
}
