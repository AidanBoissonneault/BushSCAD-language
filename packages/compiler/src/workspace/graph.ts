/**
 * @author Aidan Boissonneault
 * @file graph.ts
 * @purpose Provides graph behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { Program, TopLevelStatement } from '@bushscad/ir';
import { resolveFromFile } from './workspace-path-join.js';
import { normalizeWorkspacePath } from './workspace-path-names.js';

/**
 * Collects dependency and reverse-dependency graph data for workspace files.
 * Editor tooling needs to know which entrypoints are affected when a file
 * changes, including transitive imports.
 */
export function collectTopLevelGraphDeps(
  ast: Program,
  filePath: string,
): { imports: string[]; assets: string[] } {
  const imports: string[] = [];
  const assets: string[] = [];
  /**
   * Handles visit in the workspace flow.
   */
  const visit = (statements: TopLevelStatement[]): void => {
    for (const stmt of statements) {
      if (stmt.kind === 'import') {
        imports.push(resolveFromFile(filePath, stmt.path));
      } else if (stmt.kind === 'fontImport') {
        assets.push(resolveFromFile(filePath, stmt.path));
      } else if (stmt.kind === 'export') {
        visit([stmt.statement]);
      }
    }
  };
  visit(ast.statements);
  return { imports: unique(imports), assets: unique(assets) };
}

/**
 * Removes duplicate values while preserving their first occurrence.
 */
export function unique(values: string[]): string[] {
  return [...new Set(values.map(normalizeWorkspacePath))];
}

/**
 * Adds reverse edges to its owning collection.
 */
export function addReverseEdges(
  reverse: Map<string, Set<string>>,
  from: string,
  deps: string[],
): void {
  for (const dep of deps) {
    const set = reverse.get(dep) ?? new Set<string>();
    set.add(from);
    reverse.set(dep, set);
  }
}

/**
 * Handles dependency closure in the workspace flow.
 */
export function dependencyClosure(
  start: string,
  dependencies: Map<string, Set<string>>,
): string[] {
  const seen = new Set<string>();
  /**
   * Handles visit in the workspace flow.
   */
  const visit = (path: string): void => {
    if (seen.has(path)) return;
    seen.add(path);
    for (const dep of dependencies.get(path) ?? []) {
      visit(dep);
    }
  };
  visit(start);
  return [...seen];
}

/**
 * Handles record from map in the workspace flow.
 */
export function recordFromMap(
  map: Map<string, Set<string>>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of map.entries()) {
    out[key] = [...value].sort();
  }
  return out;
}
