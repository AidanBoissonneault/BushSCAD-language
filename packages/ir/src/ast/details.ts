/**
 * @author Aidan Boissonneault
 * @file details.ts
 * @purpose Provides details behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Expr, RepeatableFaceRef } from './expressions.js';

/** Post-object detail operations applied to existing geometry. */
export type DetailStatement =
  | FilletDetail
  | ChamferDetail
  | ShellDetail
  | DraftDetail
  | ThreadDetail;

/**
 * Fillet detail, including operation kind, target, radius, and span.
 */
export type FilletDetail = {
  kind: 'fillet';
  target: RepeatableFaceRef;
  radius: Expr;
  span: ASTSourceSpan;
};

/**
 * Chamfer detail, including operation kind, target, offset, and span.
 */
export type ChamferDetail = {
  kind: 'chamfer';
  target: RepeatableFaceRef;
  offset: Expr;
  span: ASTSourceSpan;
};

/**
 * Draft detail, including operation kind, target, angle, and span.
 */
export type DraftDetail = {
  kind: 'draft';
  target: RepeatableFaceRef;
  angle: Expr;
  span: ASTSourceSpan;
};

/**
 * Shell detail, including operation kind, target, thickness, open faces, and span.
 */
export type ShellDetail = {
  kind: 'shell';
  target: string;
  thickness: Expr;
  openFaces: string[];
  span: ASTSourceSpan;
};

/**
 * Thread detail, including operation kind, target, thread type, diameter, and pitch.
 */
export type ThreadDetail = {
  kind: 'thread';
  target: string;
  threadType: 'external' | 'internal';
  diameter: Expr;
  pitch: Expr;
  length: Expr | null;
  direction: ThreadDirection;
  angle: Expr | null;
  span: ASTSourceSpan;
};

/**
 * Accepted values for thread direction are 'regular', 'clockwise', and 'counter_clockwise'.
 */
export type ThreadDirection = 'regular' | 'clockwise' | 'counter_clockwise';
