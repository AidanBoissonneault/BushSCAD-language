/**
 * @author Aidan Boissonneault
 * @file assetImports.ts
 * @purpose Provides asset imports behavior for the assets in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompileError, TopLevelStatement } from '@bushscad/ir';

/**
 * Recursively collects top-level statements of a given kind, descending through
 * `export` and resolved `import` statements.
 * Asset imports can be nested behind export/import statements after resolution,
 * so collection walks the resolved tree instead of only the entry file.
 */
export function collectImportsByKind<K extends TopLevelStatement['kind']>(
  statements: TopLevelStatement[],
  kind: K,
): Extract<TopLevelStatement, { kind: K }>[] {
  const out: Extract<TopLevelStatement, { kind: K }>[] = [];
  /**
   * Handles walk in the assets flow.
   */
  const walk = (stmts: TopLevelStatement[]): void => {
    for (const stmt of stmts) {
      if (stmt.kind === kind) {
        out.push(stmt as Extract<TopLevelStatement, { kind: K }>);
      } else if (stmt.kind === 'export') {
        walk([stmt.statement]);
      } else if (stmt.kind === 'import') {
        walk(stmt.resolved ?? []);
      }
    }
  };
  walk(statements);
  return out;
}

/**
 * Collected asset, including name, source path, fs path, export format, and data.
 */
interface CollectedAsset {
  name: string;
  sourcePath: string;
  fsPath: string;
  format?: 'step' | 'stl';
  data: Uint8Array;
}

/**
 * Asset import, including name, path, resolved path, fs path, and span.
 */
interface AssetImport {
  name: string;
  path: string;
  resolvedPath?: string;
  fsPath?: string;
  span: { file: string; line: number; col: number };
}

/**
 * Resolves a set of asset import declarations to loaded assets, deduplicating by
 * filesystem path and collecting load errors when no loader is available.
 */
export function loadAssetImports<S extends AssetImport>(
  imports: S[],
  loadAsset: ((path: string) => Uint8Array | null) | undefined,
  fallbackFsPath: (stmt: S) => string,
  label: string,
): { assets: CollectedAsset[]; errors: CompileError[] } {
  const assets: CollectedAsset[] = [];
  const errors: CompileError[] = [];
  const seen = new Set<string>();

  for (const stmt of imports) {
    const sourcePath = stmt.resolvedPath ?? stmt.path;
    const fsPath = stmt.fsPath ?? fallbackFsPath(stmt);
    if (seen.has(fsPath)) continue;
    seen.add(fsPath);
    const data = loadAsset?.(sourcePath) ?? null;
    if (data === null) {
      if (!loadAsset) {
        errors.push({
          message: `Cannot load ${label} '${stmt.path}'`,
          span: {
            file: stmt.span.file,
            line: stmt.span.line,
            col: stmt.span.col,
          },
        });
      }
      continue;
    }
    assets.push({
      name: stmt.name,
      sourcePath,
      fsPath,
      format: shapeImportFormat(sourcePath),
      data,
    });
  }

  return { assets, errors };
}

/**
 * Detects the imported CAD/mesh format from a source path.
 * The shared asset loader is used by fonts and shapes, so shape-specific
 * metadata must be optional and derived without changing font imports.
 */
function shapeImportFormat(path: string): 'step' | 'stl' | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith('.stl')) return 'stl';
  if (lower.endsWith('.step') || lower.endsWith('.stp')) return 'step';
  return undefined;
}
