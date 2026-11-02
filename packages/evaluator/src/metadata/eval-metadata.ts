/**
 * @author Aidan Boissonneault
 * @file eval-metadata.ts
 * @purpose Evaluates metadata for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ComponentBody,
  MaterialAppearance,
  MetadataAssignment,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError, childCtx } from '../core/eval-context.js';
import { evalEnvDecl, evalExpr } from '../expressions/eval-expressions.js';
import { resolveInlineMaterial } from '../geometry/eval-op-emission.js';
import { evalVarValue } from '../references/eval-selector-vars.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Metadata for evaluated part, including color and material.
 */
type EvaluatedPartMetadata = {
  color: string | null;
  material: MaterialAppearance | null;
};

/**
 * Evaluates direct metadata assignments in a part body before geometry emits.
 *
 * Part and object metadata should apply regardless of whether the assignment
 * appears before or after the object declaration. A pre-scan gives geometry
 * emission one stable set of defaults and per-object overrides.
 */
export function evaluatePartMetadata(
  body: ComponentBody,
  ctx: EvalCtx,
): EvaluatedPartMetadata {
  const metadataCtx = metadataPreludeCtx(body, ctx);
  const metadata: EvaluatedPartMetadata = { color: null, material: null };

  for (const stmt of body.statements) {
    if (stmt.kind !== 'metadata') continue;
    applyMetadataAssignment(stmt, ctx, metadataCtx, metadata);
  }

  return metadata;
}

/**
 * Builds a metadata evaluation context with direct var/env declarations loaded.
 *
 * Metadata can use local variables while still being applied before objects are
 * emitted. Only value declarations are evaluated; geometry statements are not.
 */
function metadataPreludeCtx(body: ComponentBody, ctx: EvalCtx): EvalCtx {
  const metadataCtx = childCtx(ctx);
  for (const stmt of body.statements) {
    if (stmt.kind === 'var') {
      metadataCtx.values.set(stmt.name, evalVarValue(stmt.value, metadataCtx));
    } else if (stmt.kind === 'env' && !metadataCtx.values.has(stmt.name)) {
      metadataCtx.values.set(stmt.name, evalEnvDecl(stmt, metadataCtx));
    }
  }
  return metadataCtx;
}

/**
 * Applies metadata assignment to the supplied state or geometry.
 */
function applyMetadataAssignment(
  stmt: MetadataAssignment,
  ctx: EvalCtx,
  metadataCtx: EvalCtx,
  metadata: EvaluatedPartMetadata,
): void {
  if (stmt.property === 'color') {
    applyColorMetadata(stmt, ctx, metadataCtx, metadata);
    return;
  }
  applyMaterialMetadata(stmt, ctx, metadataCtx, metadata);
}

/**
 * Applies color metadata to the supplied state or geometry.
 */
function applyColorMetadata(
  stmt: MetadataAssignment,
  ctx: EvalCtx,
  metadataCtx: EvalCtx,
  metadata: EvaluatedPartMetadata,
): void {
  const value = evalColorMetadata(stmt, ctx, metadataCtx);
  if (value === null) return;
  if (stmt.target.kind === 'part') metadata.color = value;
  else ctx.objectColorOverrides.set(stmt.target.name, value);
}

/**
 * Applies material metadata to the supplied state or geometry.
 */
function applyMaterialMetadata(
  stmt: MetadataAssignment,
  ctx: EvalCtx,
  metadataCtx: EvalCtx,
  metadata: EvaluatedPartMetadata,
): void {
  const value = resolveInlineMaterial(
    evalExpr(stmt.value, metadataCtx),
    ctx,
    stmt.span,
  );
  if (value === null) return;
  if (stmt.target.kind === 'part') metadata.material = value;
  else ctx.objectMaterialOverrides.set(stmt.target.name, value);
}

/**
 * Evaluates color metadata with the current evaluation context.
 */
function evalColorMetadata(
  stmt: MetadataAssignment,
  ctx: EvalCtx,
  metadataCtx: EvalCtx,
): string | null {
  const value = evalExpr(stmt.value, metadataCtx);
  if (typeof value !== 'string' || !HEX_COLOR_RE.test(value)) {
    addError(
      ctx,
      `color metadata expects a #rrggbb hex color string`,
      stmt.value.span,
    );
    return null;
  }
  return value;
}
