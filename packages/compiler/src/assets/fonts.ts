/**
 * @author Aidan Boissonneault
 * @file fonts.ts
 * @purpose Provides fonts behavior for the assets in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompileAssets,
  CompileError,
  TopLevelStatement,
} from '@bushscad/ir';
import { collectImportsByKind, loadAssetImports } from './assetImports.js';

/**
 * Collects font assets from the supplied values.
 */
export function collectFontAssets(
  statements: TopLevelStatement[],
  loadAsset: ((path: string) => Uint8Array | null) | undefined,
): { assets: CompileAssets; errors: CompileError[] } {
  const { assets, errors } = loadAssetImports(
    collectImportsByKind(statements, 'fontImport'),
    loadAsset,
    (stmt) => `/fonts/imported/${stmt.name}`,
    'font',
  );
  return { assets: { fonts: assets, shapes: [] }, errors };
}
