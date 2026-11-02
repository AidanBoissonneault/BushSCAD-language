/**
 * @author Aidan Boissonneault
 * @file diagnostics.ts
 * @purpose Provides diagnostics behavior for the diagnostics in language server package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { normalizePath } from '../language/uri.js';

/**
 * Input for diagnostic, including source, source file path, and file map.
 */
type DiagnosticInput = {
  source: string;
  filePath: string;
  fileMap: Record<string, string>;
};

/**
 * Parses errors from the supplied source into the diagnostics representation.
 */
function parseErrors(source: string, filePath: string): CompileError[] {
  const parsed = parse(source, filePath);
  return parsed.errors.map((error) => ({
    message: error.message,
    span: {
      file: error.span.file,
      line: error.span.line,
      col: error.span.col,
      endLine: error.span.endLine,
      endCol: error.span.endCol,
    },
  }));
}

/**
 * Runs the language-server diagnostic pass for one project document.
 * Editor diagnostics should match parser and resolver behavior used by builds
 * while operating on open-file overlays.
 */
export function collectDiagnostics(input: DiagnosticInput): CompileError[] {
  const filePath = normalizePath(input.filePath);
  const parsed = parse(input.source, filePath);
  if (parsed.errors.length > 0) return parseErrors(input.source, filePath);

  const { errors: resolveErrors } = resolve(
    parsed.ast,
    filePath,
    (path) => input.fileMap[normalizePath(path)] ?? null,
  );
  return resolveErrors;
}
