/**
 * @author Aidan Boissonneault
 * @file sketchPreviewDetails.ts
 * @purpose Provides sketch preview details behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type {
  IRPrimitive,
  SketchDecl,
  SketchPreviewDetail,
  SketchPreviewModel,
  WrapSketchPrimitive,
} from '@bushscad/ir';
import {
  compactSketchNumber,
  profileSegmentsAreClosed,
  sketchPreviewPrimitiveBounds,
} from '@bushscad/ir';
import { detail } from './sketchPreviewDetail.js';
import { dimensionDetails } from './sketchPreviewDimensionDetails.js';
import { sketchPreviewEditability } from './sketchPreviewEditability.js';
import { buildSketchPreviewSourceDescriptor } from './sketchSourceMetadata.js';
import { sourceTextForExpression } from './sketchSourceText.js';

/**
 * Builds the profile data required by the current operation.
 */
function profileDetails(primitive: Extract<IRPrimitive, { kind: 'profile' }>) {
  const details: SketchPreviewDetail[] = [];

  for (const segment of primitive.segments) {
    if (segment.kind === 'line') {
      const length = Math.hypot(
        segment.to[0] - segment.from[0],
        segment.to[1] - segment.from[1],
      );
      details.push(
        detail(
          'segment',
          segment.name,
          `line ${compactSketchNumber(length)} mm${segment.plant ? ' default planted side' : ''}`,
        ),
      );
    } else if (segment.kind === 'arc') {
      details.push(
        detail(
          'segment',
          segment.name,
          `arc r ${compactSketchNumber(segment.radius)} mm ${
            segment.clockwise ? 'clockwise' : 'counterclockwise'
          }`,
        ),
      );
    } else {
      details.push(
        detail(
          'segment',
          segment.name,
          `ellipse ${compactSketchNumber(segment.radiusX * 2)} x ${compactSketchNumber(segment.radiusY * 2)} mm`,
        ),
      );
    }
  }

  return details;
}

/**
 * Returns whether the input meets the `profile closed` condition.
 */
function isProfileClosed(
  primitive: Extract<IRPrimitive, { kind: 'profile' }>,
): boolean {
  return (
    primitive.segments.length > 0 &&
    profileSegmentsAreClosed(primitive.segments)
  );
}

/**
 * Returns the source data required by the current operation.
 */
function sourceSpecificDetails(
  stmt: SketchDecl,
  primitive: IRPrimitive,
): SketchPreviewDetail[] {
  if (stmt.primitive.kind === 'inset' && primitive.kind === 'rect') {
    return [detail('status', 'Inset', 'resolved from placement context')];
  }
  return [];
}

/**
 * Builds the editor-facing preview model from evaluated IR.
 * The renderer should not inspect AST nodes or duplicate compile-time
 * expression evaluation; it receives concrete dimensions and display details.
 */
export function buildSketchPreviewModel(
  stmt: SketchDecl,
  primitive: IRPrimitive,
  instanceCount: number,
  componentPath: string[] = [],
  source = '',
): SketchPreviewModel {
  const bounds = sketchPreviewPrimitiveBounds(primitive);
  const profileClosed =
    primitive.kind === 'profile' ? isProfileClosed(primitive) : undefined;
  const details: SketchPreviewDetail[] = [
    ...dimensionDetails(primitive),
    ...sourceSpecificDetails(stmt, primitive),
  ];

  details.push(
    detail(
      'dimension',
      'Bounds',
      `${compactSketchNumber(bounds.width)} x ${compactSketchNumber(bounds.height)} mm`,
    ),
  );

  if (primitive.kind === 'profile') {
    details.push(
      detail('status', 'Profile', profileClosed ? 'closed' : 'open'),
      ...profileDetails(primitive),
    );
    const cs = primitive.constraintState;
    if (cs) {
      if (cs.status === 'fully-constrained') {
        details.push(detail('status', 'Constraints', 'fully constrained'));
      } else if (cs.status === 'underconstrained') {
        details.push(
          detail('status', 'Constraints', `under (${cs.dof} DOF free)`),
        );
      } else if (cs.status === 'no-convergence') {
        details.push(
          detail('status', 'Constraints', 'solver did not converge'),
        );
      }
    }
  }

  if (instanceCount > 1) {
    details.push(detail('status', 'Instances', String(instanceCount)));
  }

  const sourceDescriptor = source
    ? buildSketchPreviewSourceDescriptor(stmt, source, instanceCount)
    : { editability: sketchPreviewEditability(stmt, instanceCount) };

  return {
    name: stmt.name,
    line: stmt.span.line,
    col: stmt.span.col,
    filePath: stmt.span.file,
    componentPath,
    kind: primitive.kind,
    primitive,
    bounds,
    details,
    isClosed: profileClosed,
    instanceCount: instanceCount > 1 ? instanceCount : undefined,
    constraintState:
      primitive.kind === 'profile' ? primitive.constraintState : undefined,
    wrap: wrapPreviewMetadata(stmt, primitive, source),
    ...sourceDescriptor,
  };
}

/**
 * Wraps preview metadata around the selected target.
 */
function wrapPreviewMetadata(
  stmt: SketchDecl,
  primitive: IRPrimitive,
  source: string,
): SketchPreviewModel['wrap'] {
  if (stmt.primitive.kind !== 'wrapSketch' || primitive.kind !== 'profile') {
    return undefined;
  }
  if (!primitive.wrap) return undefined;
  return {
    ...primitive.wrap,
    source: wrapSourceMetadata(stmt.primitive, source),
  };
}

/**
 * Wraps source metadata around the selected target.
 */
function wrapSourceMetadata(
  primitive: WrapSketchPrimitive,
  source: string,
): NonNullable<SketchPreviewModel['wrap']>['source'] {
  if (!source) return undefined;
  return {
    pointsExpr: sourceTextForExpression(source, primitive.points).text,
    options: Object.fromEntries(
      primitive.options.map((option) => [
        option.name,
        sourceTextForExpression(source, option.value).text,
      ]),
    ),
  };
}
