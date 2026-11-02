/**
 * @author Aidan Boissonneault
 * @file request-parser.ts
 * @purpose Provides request parser behavior for the dto in cli package.
 * @last-edited October 6, 2026
 */

import { isAbsolute, relative, resolve } from 'node:path';
import {
  assertPreviewControls,
  parseEngine,
  parseDrawingOutputMode,
  parseEntrypointMode,
  parseFormat,
  parseOptionalBoolean,
  parseOptionalIndex,
  parseStringMap,
  parseSuppressedIndices,
} from './request-fields.js';
import type {
  CompilerRequest,
  CompilerRequestKind,
  ServiceRequest,
} from './types.js';

const REQUEST_KEYS = new Set([
  'id',
  'kind',
  'filePath',
  'rootPath',
  'entrypointMode',
  'overlays',
  'env',
  'format',
  'cursorOpIndex',
  'suppressedOpIndices',
  'occtTrace',
  'engine',
  'drawingOutputMode',
]);
const REQUEST_KINDS = new Set<unknown>([
  'check',
  'preview',
  'export',
  'exportDrawings',
]);

/**
 * Compiler request parse policy, including normalize absolute path, assert path allowed, and
 * path is within.
 */
export type CompilerRequestParsePolicy = {
  normalizeAbsolutePath?: (value: unknown, label: string) => string;
  assertPathAllowed?: (path: string) => void;
  pathIsWithin?: (rootPath: string, candidate: string) => boolean;
};

/**
 * Parses a host request through the canonical compiler-service contract.
 *
 * Why: VS Code and the CLI process must enforce identical field,
 * size, and operation rules before native compiler work can begin.
 */
export function parseCompilerRequest(
  value: unknown,
  forcedKind?: CompilerRequestKind,
  policy: CompilerRequestParsePolicy = {},
): CompilerRequest {
  const raw = requestRecord(value);
  if (raw.kind !== undefined) requestKind(raw.kind);
  const kind = requestKind(forcedKind ?? raw.kind);
  const filePath = absolutePath(raw.filePath, 'Compiler file path', policy);
  const rootPath = optionalRootPath(raw.rootPath, policy);
  assertWithin(rootPath, filePath, 'Compiler file path', policy);
  policy.assertPathAllowed?.(filePath);
  if (rootPath) policy.assertPathAllowed?.(rootPath);

  const overlays = parseStringMap(raw.overlays, 'Compiler overlays', {
    entries: 1_024,
    key: 32_767,
    value: 32 * 1024 * 1024,
    total: 64 * 1024 * 1024,
  });
  validateOverlayPaths(overlays, rootPath, policy);
  const env = parseStringMap(raw.env, 'Compiler environment', {
    entries: 256,
    key: 128,
    value: 4_096,
    total: 256 * 4_224,
  });
  const format = parseFormat(raw.format, kind);
  const cursorOpIndex = parseOptionalIndex(
    raw.cursorOpIndex,
    'Cursor operation index',
  );
  const suppressedOpIndices = parseSuppressedIndices(raw.suppressedOpIndices);
  const occtTrace = parseOptionalBoolean(raw.occtTrace, 'OCCT trace flag');
  const engine = parseEngine(raw.engine);
  const drawingOutputMode = parseDrawingOutputMode(raw.drawingOutputMode, kind);
  assertPreviewControls(kind, [cursorOpIndex, suppressedOpIndices, occtTrace]);

  return {
    kind,
    filePath,
    ...(rootPath ? { rootPath } : {}),
    entrypointMode: parseEntrypointMode(raw.entrypointMode),
    ...(overlays ? { overlays } : {}),
    ...(env ? { env } : {}),
    ...(format ? { format } : {}),
    ...(cursorOpIndex !== undefined ? { cursorOpIndex } : {}),
    ...(suppressedOpIndices ? { suppressedOpIndices } : {}),
    ...(occtTrace !== undefined ? { occtTrace } : {}),
    ...(engine ? { engine } : {}),
    ...(drawingOutputMode ? { drawingOutputMode } : {}),
  };
}

/** Parses an ID-bearing JSON-line request received by the CLI service. */
export function parseServiceRequest(value: unknown): ServiceRequest {
  const raw = requestRecord(value);
  const id = parseOptionalIndex(raw.id, 'Compiler request id');
  if (id === undefined) throw new TypeError('Compiler request id is required.');
  return { ...parseCompilerRequest(raw), id };
}

/**
 * Handles request record in the dto flow.
 */
function requestRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Compiler request must be an object.');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!REQUEST_KEYS.has(key))
      throw new TypeError(`Unknown compiler request field: ${key}`);
  }
  return record;
}

/**
 * Handles request kind in the dto flow.
 */
function requestKind(value: unknown): CompilerRequestKind {
  if (!REQUEST_KINDS.has(value))
    throw new TypeError('Invalid compiler request kind.');
  return value as CompilerRequestKind;
}

/**
 * Handles absolute path in the dto flow.
 */
function absolutePath(
  value: unknown,
  label: string,
  policy: CompilerRequestParsePolicy,
): string {
  if (policy.normalizeAbsolutePath)
    return policy.normalizeAbsolutePath(value, label);
  if (typeof value !== 'string' || !isAbsolute(value)) {
    throw new TypeError(`${label} must be an absolute path.`);
  }
  return resolve(value);
}

/**
 * Handles optional root path in the dto flow.
 */
function optionalRootPath(
  value: unknown,
  policy: CompilerRequestParsePolicy,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return absolutePath(value, 'Compiler root path', policy);
}

/**
 * Validates overlay paths and reports any violations.
 */
function validateOverlayPaths(
  overlays: Record<string, string> | undefined,
  rootPath: string | undefined,
  policy: CompilerRequestParsePolicy,
): void {
  for (const path of Object.keys(overlays ?? {})) {
    const normalized = absolutePath(path, 'Overlay path', policy);
    assertWithin(rootPath, normalized, 'Compiler overlay', policy);
    policy.assertPathAllowed?.(normalized);
  }
}

/**
 * Handles assert within in the dto flow.
 */
function assertWithin(
  rootPath: string | undefined,
  candidate: string,
  label: string,
  policy: CompilerRequestParsePolicy,
): void {
  if (!rootPath) return;
  const within = policy.pathIsWithin
    ? policy.pathIsWithin(rootPath, candidate)
    : defaultPathIsWithin(rootPath, candidate);
  if (!within) throw new Error(`${label} is outside the requested root.`);
}

/**
 * Returns the default path is within used by this module.
 */
function defaultPathIsWithin(rootPath: string, candidate: string): boolean {
  const child = relative(rootPath, candidate);
  return child === '' || (!child.startsWith('..') && !isAbsolute(child));
}
