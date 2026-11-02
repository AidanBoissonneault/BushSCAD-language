/**
 * @author Aidan Boissonneault
 * @file nodeFontResolution.ts
 * @purpose Provides node font resolution behavior for the platform node in compiler package.
 * @last-edited October 6, 2026
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { homedir } from 'node:os';
import type { CompileAssets, IRPrimitive, IRProgram } from '@bushscad/ir';

const FONT_EXTENSIONS = new Set(['.ttf', '.otf']);
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.bushscad-analysis',
  'node_modules',
  'dist',
  'out',
]);
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
let systemFonts: Map<string, string> | undefined;

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
 * Handles installed font index in the platform node flow.
 */
function installedFontIndex(): Map<string, string> {
  systemFonts ??= indexFontDirectories(installedFontDirectories());
  return systemFonts;
}

/**
 * Handles installed font directories in the platform node flow.
 */
function installedFontDirectories(): string[] {
  if (process.platform === 'win32')
    return [
      join(process.env['WINDIR'] ?? 'C:/Windows', 'Fonts'),
      join(process.env['LOCALAPPDATA'] ?? homedir(), 'Microsoft/Windows/Fonts'),
    ];
  if (process.platform === 'darwin')
    return [
      '/System/Library/Fonts',
      '/Library/Fonts',
      join(homedir(), 'Library/Fonts'),
    ];
  return [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    join(homedir(), '.local/share/fonts'),
  ];
}

/**
 * Handles index font directories in the platform node flow.
 */
function indexFontDirectories(roots: readonly string[]): Map<string, string> {
  const index = new Map<string, string>();
  const pending = roots.filter(existsSync);
  while (pending.length > 0) {
    const directory = pending.pop()!;
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) pending.push(path);
      } else if (FONT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        indexFontFile(index, path);
      }
    }
  }
  return index;
}

/**
 * Handles index font file in the platform node flow.
 */
function indexFontFile(index: Map<string, string>, path: string): void {
  let names: string[];
  try {
    names = fontFamilyNames(readFileSync(path));
  } catch {
    return;
  }
  for (const name of names) {
    const key = normalizeFamily(name);
    if (!index.has(key) || regularFontPath(path)) index.set(key, path);
  }
}

/**
 * Normalizes family into the canonical form.
 */
function normalizeFamily(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Handles regular font path in the platform node flow.
 */
function regularFontPath(path: string): boolean {
  return /(?:regular|roman|book|normal)\.(?:ttf|otf)$/i.test(path);
}

/**
 * Handles resolved font fs path in the platform node flow.
 */
function resolvedFontFsPath(path: string): string {
  const digest = createHash('sha256').update(path).digest('hex').slice(0, 12);
  return `/fonts/resolved/${digest}${extname(path).toLowerCase()}`;
}

/** Reads preferred and legacy family names from an OpenType `name` table. */
export function fontFamilyNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) return [];
  const tableCount = view.getUint16(4);
  for (let index = 0; index < tableCount; index++) {
    const offset = 12 + index * 16;
    if (offset + 16 > bytes.byteLength || ascii(bytes, offset, 4) !== 'name')
      continue;
    return readNameTable(bytes, view.getUint32(offset + 8));
  }
  return [];
}

/**
 * Reads name table from the supplied source.
 */
function readNameTable(bytes: Uint8Array, tableOffset: number): string[] {
  if (tableOffset + 6 > bytes.byteLength) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(tableOffset + 2);
  const strings = tableOffset + view.getUint16(tableOffset + 4);
  const preferred: string[] = [];
  const legacy: string[] = [];
  for (let index = 0; index < count; index++) {
    const record = tableOffset + 6 + index * 12;
    if (record + 12 > bytes.byteLength) break;
    const platform = view.getUint16(record);
    const nameId = view.getUint16(record + 6);
    if (nameId !== 1 && nameId !== 16) continue;
    const length = view.getUint16(record + 8);
    const offset = strings + view.getUint16(record + 10);
    if (offset + length > bytes.byteLength) continue;
    const name = decodeName(bytes.subarray(offset, offset + length), platform);
    if (name) (nameId === 16 ? preferred : legacy).push(name);
  }
  return [...new Set(preferred.length > 0 ? preferred : legacy)];
}

/**
 * Handles decode name in the platform node flow.
 */
function decodeName(bytes: Uint8Array, platform: number): string {
  if (platform !== 0 && platform !== 3)
    return new TextDecoder('latin1').decode(bytes).replace(/\0/g, '').trim();
  let value = '';
  for (let index = 0; index + 1 < bytes.length; index += 2)
    value += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  return value.replace(/\0/g, '').trim();
}

/**
 * Handles ascii in the platform node flow.
 */
function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
