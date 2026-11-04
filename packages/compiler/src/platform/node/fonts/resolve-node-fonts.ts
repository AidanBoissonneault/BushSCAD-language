/**
 * @author Aidan Boissonneault
 * @purpose Resolves Node-side font assets for compiler programs.
 * @last-edited October 6, 2026
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { CompileAssets, IRPrimitive, IRProgram } from '@bushscad/ir';
import { fontFamilyNames } from './font-name-table.js';
import {
  indexFontDirectories,
  installedFontIndex,
  normalizeFamily,
} from './installed-font-index.js';

const GENERIC_FAMILIES = new Map([
  ['sans', 'sans'],
  ['sans-serif', 'sans'],
  ['system-ui', 'sans'],
  ['ui-sans-serif', 'sans'],
  ['serif', 'serif'],
  ['ui-serif', 'serif'],
  ['mono', 'mono'],
  ['monospace', 'mono'],
  ['ui-monospace', 'mono'],
  ['cursive', 'sans'],
  ['fantasy', 'sans'],
]);

/**
 * Resolves CSS-style word font families to concrete local outline assets.
 *
 * Why: the Node OCCT runtime cannot query the browser's CSS font subsystem, so
 * VS Code compilation must provide the same local font bytes explicitly.
 */
export function resolveNodeFonts(
  program: IRProgram,
  assets: CompileAssets,
  workspaceRoot: string,
): void {
  const requested = requestedFontFamilies(program);
  if (requested.size === 0) return;
  const workspaceFonts = indexFontDirectories([workspaceRoot]);
  const resolved = new Map<string, string>();
  for (const value of requested) {
    const selection = selectFont(value, workspaceFonts, installedFontIndex);
    if (selection) resolved.set(value, selection);
  }
  if (resolved.size === 0) return;

  const assetsByPath = new Map(
    assets.fonts.map((asset) => [asset.sourcePath, asset]),
  );
  visitProgramPrimitives(program, (primitive) => {
    if (primitive.kind !== 'word' || typeof primitive.font !== 'string') return;
    const sourcePath = resolved.get(primitive.font);
    if (!sourcePath) {
      primitive.font = genericFamilyFromStack(primitive.font) ?? primitive.font;
      return;
    }
    let asset = assetsByPath.get(sourcePath);
    if (!asset) {
      const name = selectedFamilyName(primitive.font, sourcePath);
      asset = {
        name,
        sourcePath,
        fsPath: resolvedFontFsPath(sourcePath),
        data: new Uint8Array(readFileSync(sourcePath)),
      };
      assets.fonts.push(asset);
      assetsByPath.set(sourcePath, asset);
    }
    primitive.font = {
      kind: 'fontAsset',
      name: asset.name,
      sourcePath: asset.sourcePath,
      fsPath: asset.fsPath,
    };
  });
}

/** Parses an ordered CSS `font-family` value, including quoted family names. */
export function cssFontFamilies(value: string): string[] {
  const families: string[] = [];
  let current = '';
  let quote = '';
  for (const character of value) {
    if (
      (character === "'" || character === '"') &&
      (!quote || quote === character)
    ) {
      quote = quote ? '' : character;
      current += character;
    } else if (character === ',' && !quote) {
      families.push(current);
      current = '';
    } else current += character;
  }
  families.push(current);
  return families
    .map((family) =>
      family
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Handles requested font families in the platform node flow.
 */
function requestedFontFamilies(program: IRProgram): Set<string> {
  const values = new Set<string>();
  visitProgramPrimitives(program, (primitive) => {
    if (primitive.kind === 'word' && typeof primitive.font === 'string')
      values.add(primitive.font);
  });
  return values;
}

/**
 * Handles visit program primitives in the platform node flow.
 */
function visitProgramPrimitives(
  program: IRProgram,
  visitor: (primitive: IRPrimitive) => void,
): void {
  for (const op of program.ops) {
    if (op.kind === 'sketch') visitPrimitive(op.primitive, visitor);
  }
}

/**
 * Handles visit primitive in the platform node flow.
 */
function visitPrimitive(
  primitive: IRPrimitive,
  visitor: (primitive: IRPrimitive) => void,
): void {
  visitor(primitive);
  if (primitive.kind === 'sketchAlias' || primitive.kind === 'sketchAt')
    visitPrimitive(primitive.primitive, visitor);
  else if (primitive.kind === 'sketchBoolean') {
    visitPrimitive(primitive.left, visitor);
    visitPrimitive(primitive.right, visitor);
  }
}

/**
 * Selects font according to the supplied filters.
 */
function selectFont(
  value: string,
  workspace: Map<string, string>,
  installed: () => Map<string, string>,
): string | undefined {
  for (const family of cssFontFamilies(value)) {
    const key = normalizeFamily(family);
    const workspacePath = workspace.get(key);
    if (workspacePath) return workspacePath;
    if (GENERIC_FAMILIES.has(key)) return;
    const installedPath = installed().get(key);
    if (installedPath) return installedPath;
  }
  return undefined;
}

/**
 * Handles generic family from stack in the platform node flow.
 */
function genericFamilyFromStack(value: string): string | undefined {
  for (const family of cssFontFamilies(value)) {
    const generic = GENERIC_FAMILIES.get(normalizeFamily(family));
    if (generic) return generic;
  }
  return undefined;
}

/**
 * Returns the selected family name from the current operation.
 */
function selectedFamilyName(value: string, path: string): string {
  const names = fontFamilyNames(readFileSync(path));
  return (
    cssFontFamilies(value).find((family) =>
      names.some((name) => normalizeFamily(name) === normalizeFamily(family)),
    ) ??
    names[0] ??
    value
  );
}

/**
 * Handles resolved font fs path in the platform node flow.
 */
function resolvedFontFsPath(path: string): string {
  const digest = createHash('sha256').update(path).digest('hex').slice(0, 12);
  return `/fonts/resolved/${digest}${extname(path).toLowerCase()}`;
}
