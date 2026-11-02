/**
 * @author Aidan Boissonneault
 * @file shapes.ts
 * @purpose Provides shapes behavior for the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  IRShapeAsset,
  TopLevelStatement,
} from '@bushscad/ir';
import {
  collectImportsByKind,
  loadAssetImports,
} from '../assets/assetImports.js';

/**
 * Collects shape assets from the supplied values.
 */
export function collectShapeAssets(
  statements: TopLevelStatement[],
  loadAsset: ((path: string) => Uint8Array | null) | undefined,
): { shapes: IRShapeAsset[]; errors: CompileError[] } {
  const { assets, errors } = loadAssetImports(
    collectImportsByKind(statements, 'shapeImport'),
    loadAsset,
    (stmt) => `/shapes/imported/${stmt.name}${shapeImportExtension(stmt.path)}`,
    'shape',
  );
  return {
    shapes: assets.map((asset) => ({
      ...asset,
      format: asset.format ?? shapeImportFormat(asset.sourcePath),
    })),
    errors,
  };
}

/**
 * Resolves the OCCT reader format for an imported shape path.
 * STEP remains the default for historical imports, while `.stl` selects the
 * mesh reader and must be preserved in compile assets.
 */
function shapeImportFormat(path: string): 'step' | 'stl' {
  return path.toLowerCase().endsWith('.stl') ? 'stl' : 'step';
}

/**
 * Chooses the fallback virtual filesystem extension for unresolved assets.
 * Resolver-filled `fsPath` normally preserves the real file extension; this
 * fallback keeps compile-only paths consistent when resolution is bypassed.
 */
function shapeImportExtension(path: string): '.step' | '.stl' {
  return shapeImportFormat(path) === 'stl' ? '.stl' : '.step';
}
