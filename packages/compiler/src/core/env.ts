/**
 * @author Aidan Boissonneault
 * @file env.ts
 * @purpose Provides env behavior for the core in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  ComponentBody,
  EnvDecl,
  Expr,
  Literal,
  SourceSpan,
  TopLevelStatement,
} from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import type {
  EnvManifestEntry,
  EnvManifestResult,
  EnvValue,
  EnvValueType,
  RawEnvOverrides,
} from '../types/types.js';

/**
 * Converts a literal kind into the public env manifest type.
 */
function envTypeForLiteral(lit: Literal): EnvValueType {
  if (lit.kind === 'bool') return 'boolean';
  return lit.kind;
}

/**
 * Handles literal to env value in the core flow.
 */
function literalToEnvValue(lit: Literal): EnvValue {
  switch (lit.kind) {
    case 'number':
      return lit.value;
    case 'string':
      return lit.value;
    case 'bool':
      return lit.value;
    case 'list':
      return lit.items.map(exprToEnvValue);
  }
}

/**
 * Handles expr to env value in the core flow.
 */
function exprToEnvValue(expr: Expr): EnvValue {
  switch (expr.kind) {
    case 'number':
      return expr.value;
    case 'string':
      return expr.value;
    case 'bool':
      return expr.value;
    case 'list':
      return expr.items.map(exprToEnvValue);
    default:
      return 0;
  }
}

/**
 * Adds env declaration to its owning collection.
 */
function addEnvDecl(
  manifest: Map<string, EnvManifestEntry>,
  errors: CompileError[],
  stmt: EnvDecl,
): void {
  const entry: EnvManifestEntry = {
    name: stmt.name,
    type: envTypeForLiteral(stmt.fallback),
    fallback: literalToEnvValue(stmt.fallback),
    span: { file: stmt.span.file, line: stmt.span.line, col: stmt.span.col },
  };
  const existing = manifest.get(stmt.name);
  if (existing && existing.type !== entry.type) {
    errors.push({
      message: `Env '${stmt.name}' is declared with conflicting fallback types (${existing.type} and ${entry.type})`,
      span: entry.span,
    });
    return;
  }
  manifest.set(stmt.name, existing ?? entry);
}

/**
 * Collects env from body from the supplied values.
 */
function collectEnvFromBody(
  body: ComponentBody,
  manifest: Map<string, EnvManifestEntry>,
  errors: CompileError[],
): void {
  for (const stmt of body.statements) {
    if (stmt.kind === 'env') addEnvDecl(manifest, errors, stmt);
    else if (stmt.kind === 'fn' || stmt.kind === 'return') {
      collectEnvFromBody(stmt.body, manifest, errors);
    } else if (stmt.kind === 'for') {
      collectEnvFromBody(stmt.body, manifest, errors);
    } else if (stmt.kind === 'if') {
      collectEnvFromBody(stmt.then, manifest, errors);
      if (stmt.else) collectEnvFromBody(stmt.else, manifest, errors);
    }
  }
}

/**
 * Collects env manifest from the supplied values.
 */
export function collectEnvManifest(
  statements: TopLevelStatement[],
): EnvManifestResult {
  const manifest = new Map<string, EnvManifestEntry>();
  const errors: CompileError[] = [];
  /**
   * Handles visit in the core flow.
   */
  const visit = (stmts: TopLevelStatement[]): void => {
    for (const stmt of stmts) {
      if (stmt.kind === 'env') addEnvDecl(manifest, errors, stmt);
      else if (stmt.kind === 'part' || stmt.kind === 'fn') {
        collectEnvFromBody(stmt.body, manifest, errors);
      } else if (stmt.kind === 'export') {
        visit([stmt.statement]);
      } else if (stmt.kind === 'import') {
        visit(stmt.resolved ?? []);
      }
    }
  };
  visit(statements);
  return { entries: [...manifest.values()], errors };
}

/**
 * Coerces CLI and service env override strings into typed evaluator values.
 *
 * Env declarations define the fallback type in BushSCAD code, but command-line
 * and editor overrides arrive as strings and must be validated before eval.
 */
function parseListOverride(
  raw: string,
  entry: EnvManifestEntry,
): { ok: true; value: EnvValue } | { ok: false; error: CompileError } {
  const parsed = parse(`env __value fallback ${raw};`, entry.span.file);
  if (parsed.errors.length > 0) {
    return {
      ok: false,
      error: {
        message: `Invalid list override for env '${entry.name}': ${parsed.errors[0].message}`,
        span: entry.span,
      },
    };
  }
  const stmt = parsed.ast.statements[0];
  if (!stmt || stmt.kind !== 'env' || stmt.fallback.kind !== 'list') {
    return {
      ok: false,
      error: {
        message: `Invalid list override for env '${entry.name}'; expected a BushSCAD list literal`,
        span: entry.span,
      },
    };
  }
  return { ok: true, value: literalToEnvValue(stmt.fallback) };
}

/**
 * Result of env override parse is tagged by ok: 'true' carries display value and 'false' carries
 * error.
 */
type EnvOverrideParseResult =
  { ok: true; value: EnvValue } | { ok: false; error: CompileError };

/**
 * Handles invalid override in the core flow.
 */
function invalidOverride(
  entry: EnvManifestEntry,
  message: string,
): CompileError {
  return { message, span: entry.span };
}

/**
 * Handles coerce number override in the core flow.
 */
function coerceNumberOverride(
  value: string,
  entry: EnvManifestEntry,
): EnvOverrideParseResult {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return {
      ok: false,
      error: invalidOverride(
        entry,
        `Invalid number override for env '${entry.name}': ${value}`,
      ),
    };
  }
  return { ok: true, value: num };
}

/**
 * Handles coerce boolean override in the core flow.
 */
function coerceBooleanOverride(
  value: string,
  entry: EnvManifestEntry,
): EnvOverrideParseResult {
  const normalized = value.toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    return {
      ok: false,
      error: invalidOverride(
        entry,
        `Invalid boolean override for env '${entry.name}': ${value}`,
      ),
    };
  }
  return { ok: true, value: normalized === 'true' };
}

/**
 * Handles coerce known env override in the core flow.
 */
function coerceKnownEnvOverride(
  value: string,
  entry: EnvManifestEntry,
): EnvOverrideParseResult {
  switch (entry.type) {
    case 'string':
      return { ok: true, value };
    case 'number':
      return coerceNumberOverride(value, entry);
    case 'boolean':
      return coerceBooleanOverride(value, entry);
    case 'list':
      return parseListOverride(value, entry);
  }
}

/**
 * Handles coerce env overrides in the core flow.
 */
export function coerceEnvOverrides(
  raw: RawEnvOverrides,
  manifest: EnvManifestEntry[],
  fallbackSpan: SourceSpan,
):
  | { ok: true; env: Record<string, EnvValue> }
  | { ok: false; errors: CompileError[] } {
  const entries = new Map(manifest.map((entry) => [entry.name, entry]));
  const env = Object.create(null) as Record<string, EnvValue>;
  const errors: CompileError[] = [];

  for (const [name, value] of Object.entries(raw)) {
    const entry = entries.get(name);
    if (!entry) {
      errors.push({
        message: `Unknown env override '${name}'`,
        span: fallbackSpan,
      });
      continue;
    }

    const parsed = coerceKnownEnvOverride(value, entry);
    if (parsed.ok) env[name] = parsed.value;
    else errors.push(parsed.error);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, env };
}
