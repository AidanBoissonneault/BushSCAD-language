/**
 * @author Aidan Boissonneault
 * @file sketchPreviewDimensionDetails.ts
 * @purpose Provides sketch preview dimension details behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, SketchPreviewDetail } from '@bushscad/ir';
import { compactSketchNumber } from '@bushscad/ir';
import { detail } from './sketchPreviewDetail.js';

/**
 * Defines the `DimensionDetailHandler` callback contract used by the sketch preview layer.
 */
type DimensionDetailHandler<Kind extends IRPrimitive['kind']> = (
  primitive: Extract<IRPrimitive, { kind: Kind }>,
) => SketchPreviewDetail[];

const dimensionDetailHandlers = {
  rect: rectDimensionDetails,
  roundrect: roundRectDimensionDetails,
  circle: circleDimensionDetails,
  ellipse: ellipseDimensionDetails,
  triangle: triangleDimensionDetails,
  polygon: polygonDimensionDetails,
  word: wordDimensionDetails,
  profile: () => [],
  sketchAt: sketchAtDimensionDetails,
  sketchBoolean: sketchBooleanDimensionDetails,
  sketchAlias: sketchAliasDimensionDetails,
  sketchRef: sketchRefDimensionDetails,
} satisfies {
  [Kind in IRPrimitive['kind']]: DimensionDetailHandler<Kind>;
};

/**
 * Builds the dimension data required by the current drawing.
 */
export function dimensionDetails(
  primitive: IRPrimitive,
): SketchPreviewDetail[] {
  const handler = dimensionDetailHandlers[primitive.kind] as (
    primitive: IRPrimitive,
  ) => SketchPreviewDetail[];
  return handler(primitive);
}

/**
 * Handles rect dimension details in the sketch preview flow.
 */
function rectDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'rect' }>,
): SketchPreviewDetail[] {
  return [
    sizeDetail('Width', primitive.width),
    sizeDetail('Height', primitive.height),
    ...optionalSizeDetail('Corner radius', primitive.cornerRadius),
    ...(primitive.plant
      ? [
          detail(
            'status',
            'Plant',
            `${primitive.plant} (default placement side)`,
          ),
        ]
      : []),
  ];
}

/**
 * Handles round rect dimension details in the sketch preview flow.
 */
function roundRectDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'roundrect' }>,
): SketchPreviewDetail[] {
  return [
    sizeDetail('Width', primitive.width),
    sizeDetail('Height', primitive.height),
    sizeDetail('Radius', primitive.radius),
  ];
}

/**
 * Creates circle geometry from its center and radius.
 */
function circleDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'circle' }>,
): SketchPreviewDetail[] {
  return [sizeDetail('Diameter', primitive.diameter)];
}

/**
 * Creates ellipse geometry from its center and radii.
 */
function ellipseDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'ellipse' }>,
): SketchPreviewDetail[] {
  return [
    sizeDetail('Width', primitive.width),
    sizeDetail('Height', primitive.height),
  ];
}

/**
 * Handles triangle dimension details in the sketch preview flow.
 */
function triangleDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'triangle' }>,
): SketchPreviewDetail[] {
  return [
    sizeDetail('Base', primitive.base),
    sizeDetail('Height', primitive.height),
  ];
}

/**
 * Handles polygon dimension details in the sketch preview flow.
 */
function polygonDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'polygon' }>,
): SketchPreviewDetail[] {
  return [
    detail('dimension', 'Points', String(primitive.points.length)),
    ...(primitive.plant
      ? [detail('status', 'Plant', 'default placement side')]
      : []),
  ];
}

/**
 * Handles word dimension details in the sketch preview flow.
 */
function wordDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'word' }>,
): SketchPreviewDetail[] {
  return [
    detail('text', 'Text', primitive.text),
    sizeDetail('Size', primitive.size),
    detail(
      'text',
      'Font',
      typeof primitive.font === 'string' ? primitive.font : primitive.font.name,
    ),
    detail('text', 'Align', primitive.align),
  ];
}

/**
 * Handles sketch at dimension details in the sketch preview flow.
 */
function sketchAtDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'sketchAt' }>,
): SketchPreviewDetail[] {
  return [
    detail(
      'dimension',
      'Offset',
      `${compactSketchNumber(primitive.x)}, ${compactSketchNumber(primitive.y)} mm`,
    ),
    ...dimensionDetails(primitive.primitive),
  ];
}

/**
 * Handles sketch boolean dimension details in the sketch preview flow.
 */
function sketchBooleanDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'sketchBoolean' }>,
): SketchPreviewDetail[] {
  return [
    detail('status', 'Boolean', primitive.op === 'add' ? 'add' : 'subtract'),
  ];
}

/**
 * Handles sketch alias dimension details in the sketch preview flow.
 */
function sketchAliasDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'sketchAlias' }>,
): SketchPreviewDetail[] {
  return [
    detail('status', 'Component', primitive.name),
    ...dimensionDetails(primitive.primitive),
  ];
}

/**
 * Handles sketch ref dimension details in the sketch preview flow.
 */
function sketchRefDimensionDetails(
  primitive: Extract<IRPrimitive, { kind: 'sketchRef' }>,
): SketchPreviewDetail[] {
  return [detail('status', 'Reference', primitive.name)];
}

/**
 * Handles size detail in the sketch preview flow.
 */
function sizeDetail(label: string, value: number): SketchPreviewDetail {
  return detail('dimension', label, `${compactSketchNumber(value)} mm`);
}

/**
 * Handles optional size detail in the sketch preview flow.
 */
function optionalSizeDetail(
  label: string,
  value: number | undefined,
): SketchPreviewDetail[] {
  return value === undefined ? [] : [sizeDetail(label, value)];
}
