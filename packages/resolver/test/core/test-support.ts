/**
 * @author Aidan Boissonneault
 * @file test-support.ts
 * @purpose Tests test support behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { expect } from 'vitest';
import type { AssetLoader, FileLoader } from '../../src/index.js';
import { resolve } from '../../src/index.js';

/**
 * Handles no files in the core flow.
 */
export const noFiles: FileLoader = () => null;

/**
 * Parses resolver test source and asserts syntax success.
 *
 * Why:
 * Resolver tests should fail at the parser boundary before resolver diagnostics
 * are inspected, and the source filename should stay consistent across helpers.
 */
function parseResolverSource(src: string) {
  const parsed = parse(src, 'test.bscd');
  expect(
    parsed.errors,
    `parse errors: ${parsed.errors.map((error) => error.message).join(', ')}`,
  ).toHaveLength(0);
  return parsed.ast;
}

/**
 * Resolves ok against the current scope and reports unresolved references.
 */
export function resolveOk(src: string): void {
  const result = resolve(parseResolverSource(src), 'test.bscd', noFiles);
  if (result.errors.length > 0) {
    const msgs = result.errors
      .map((e) => `  ${e.span.line}:${e.span.col} — ${e.message}`)
      .join('\n');
    throw new Error(`Expected no resolve errors, got:\n${msgs}`);
  }
}

/**
 * Resolves source expected to produce resolver diagnostics.
 *
 * Why:
 * Resolver tests should share parser setup and fail loudly if a case stops
 * reaching the resolver because of a syntax error.
 */
export function resolveErrors(
  src: string,
  loadFile: FileLoader = noFiles,
): string[] {
  return resolve(
    parseResolverSource(src),
    'test.bscd',
    loadFile,
  ).errors.map((error) => error.message);
}

/**
 * Resolves errors with assets against the current scope and reports unresolved references.
 */
export function resolveErrorsWithAssets(
  src: string,
  loadAsset: AssetLoader,
): string[] {
  const parsed = parse(src, 'test.bscd');
  return resolve(parsed.ast, 'test.bscd', noFiles, loadAsset).errors.map(
    (e) => e.message,
  );
}
