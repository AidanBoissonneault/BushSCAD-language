import type { ASTSourceSpan } from '../sourceSpan.js';
import type { SketchPrimitive } from '../sketchPrimitives.js';
import type { SurfaceOperation } from '../surface.js';
import type { PathPrimitive } from './path/primitive.js';

/**
 * Input for sketch is tagged by kind: 'namedSketch' carries name, 'namedSketchBody' carries
 * sketch name, body name, 'sketchBodyList' carries sketch name, body names, 'inlineSketch'
 * carries primitive, and 'sketchList' carries items.
 */
export type SketchInput =
  | { kind: 'namedSketch'; name: string; span: ASTSourceSpan }
  | {
      kind: 'namedSketchBody';
      sketchName: string;
      bodyName: string;
      span: ASTSourceSpan;
    }
  | {
      kind: 'sketchBodyList';
      sketchName: string;
      bodyNames: string[];
      span: ASTSourceSpan;
    }
  | { kind: 'inlineSketch'; primitive: SketchPrimitive; span: ASTSourceSpan }
  | { kind: 'sketchList'; items: SketchInput[]; span: ASTSourceSpan };

/**
 * Input for path is tagged by kind: 'namedPath' carries name and 'inlinePath' carries primitive.
 */
export type PathInput =
  | { kind: 'namedPath'; name: string; span: ASTSourceSpan }
  | { kind: 'inlinePath'; primitive: PathPrimitive; span: ASTSourceSpan };

/**
 * Input for surface is tagged by kind: 'namedSurface' carries name and 'inlineSurface' carries
 * operation.
 */
export type SurfaceInput =
  | { kind: 'namedSurface'; name: string; span: ASTSourceSpan }
  | { kind: 'inlineSurface'; operation: SurfaceOperation; span: ASTSourceSpan };

/**
 * Target for through accepts { kind: 'namedThrough'; name: string; span: ASTSou, { kind:
 * 'inferredThrough'; span: ASTSourceSpan }, and null.
 */
export type ThroughTarget =
  | { kind: 'namedThrough'; name: string; span: ASTSourceSpan }
  | { kind: 'inferredThrough'; span: ASTSourceSpan }
  | null;
