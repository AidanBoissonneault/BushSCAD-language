/**
 * @author Aidan Boissonneault
 * @file sketchSourceMetadata.ts
 * @purpose Provides sketch source metadata behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type {
  SketchDecl,
  SketchPreviewModel,
  SketchPreviewSourceMetadata,
} from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { sketchPreviewEditability } from './sketchPreviewEditability.js';
import {
  collectSketchSourceFields,
  collectSketchSourcePlacements,
} from './sketchSourceFields.js';
import { collectSketchSourceEntities } from './sketchSourceEntities.js';
import { findSketchPreviewTarget } from './sketchPreviewTarget.js';
import { previewRangeForSpan, sourceTextForSpan } from './sketchSourceText.js';

/**
 * Derives `SketchPreviewSourceDescriptor` from `Pick< SketchPreviewModel, 'editableRange' | 'source' |
 * 'editability' > & { name: string }` to preserve its type relationship in the sketch preview layer.
 */
export type SketchPreviewSourceDescriptor = Pick<
  SketchPreviewModel,
  'editableRange' | 'source' | 'editability'
> & { name: string };

/** Builds all AST-backed expression metadata for one evaluated preview. */
export function buildSketchPreviewSourceDescriptor(
  sketch: SketchDecl,
  source: string,
  instanceCount: number,
): SketchPreviewSourceDescriptor {
  return {
    name: sketch.name,
    editableRange: previewRangeForSpan(sketch.span),
    source: buildSourceMetadata(sketch, source),
    editability: sketchPreviewEditability(sketch, instanceCount),
  };
}

/** Finds source metadata without resolving or evaluating the document. */
export function findActiveSketchSourceDescriptor(
  source: string,
  filePath: string,
  line: number,
  col: number,
): SketchPreviewSourceDescriptor | null {
  const parsed = parse(source, filePath);
  if (parsed.errors.length > 0) return null;
  const sketch = findSketchPreviewTarget(parsed.ast, line, col);
  return sketch ? buildSketchPreviewSourceDescriptor(sketch, source, 1) : null;
}

/**
 * Builds source metadata from the supplied inputs.
 */
function buildSourceMetadata(
  sketch: SketchDecl,
  source: string,
): SketchPreviewSourceMetadata {
  const entities = collectSketchSourceEntities(sketch.primitive, source);
  return {
    declaration: sourceTextForSpan(source, sketch.span),
    primitiveKind: sketch.primitive.kind,
    fields: collectSketchSourceFields(sketch.primitive, source),
    points: entities.points,
    segments: entities.segments,
    placementOrigin: entities.placementOrigin,
    placements: collectSketchSourcePlacements(sketch, source),
    constraints: entities.constraints,
    dimensions: entities.dimensions,
    labels: entities.labels,
  };
}
