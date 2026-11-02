/**
 * @author Aidan Boissonneault
 * @file paths.ts
 * @purpose Provides paths behavior for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

/**
 * Resolves an import path relative to the file that declared it.
 * The resolver works against normalized virtual workspace paths, not Node's
 * filesystem path APIs, so relative imports are collapsed manually.
 */
export function resolvePath(baseFile: string, importPath: string): string {
  if (!importPath.startsWith('.')) return importPath;
  const sep = baseFile.lastIndexOf('/');
  const dir = sep >= 0 ? baseFile.slice(0, sep) : '';
  const combined = dir ? `${dir}/${importPath}` : importPath;
  const parts = combined.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
}

/**
 * Creates the stable virtual filesystem path used for imported fonts.
 */
export function importedFontFsPath(resolvedPath: string): string {
  const fileName = resolvedPath.split('/').pop() ?? 'font.ttf';
  const safePrefix = resolvedPath
    .replace(/\\/g, '/')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+/, '');
  return `/fonts/imported/${safePrefix || fileName}`;
}

/**
 * Creates the stable virtual filesystem path used for imported STEP shapes.
 */
export function importedShapeFsPath(resolvedPath: string): string {
  const fileName = resolvedPath.split('/').pop() ?? 'shape.step';
  const safePrefix = resolvedPath
    .replace(/\\/g, '/')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+/, '');
  return `/shapes/imported/${safePrefix || fileName}`;
}
