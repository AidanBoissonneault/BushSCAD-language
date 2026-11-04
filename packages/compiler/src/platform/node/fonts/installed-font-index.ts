/**
 * @author Aidan Boissonneault
 * @purpose Resolves Node-side font assets for compiler programs.
 * @last-edited October 6, 2026
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { homedir } from 'node:os';
import { fontFamilyNames } from './font-name-table.js';

const FONT_EXTENSIONS = new Set(['.ttf', '.otf']);
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.bushscad-analysis',
  'node_modules',
  'dist',
  'out',
]);
let systemFonts: Map<string, string> | undefined;

/**
 * Handles installed font index in the platform node flow.
 */
export function installedFontIndex(): Map<string, string> {
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
export function indexFontDirectories(roots: readonly string[]): Map<string, string> {
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
 * Handles regular font path in the platform node flow.
 */
function regularFontPath(path: string): boolean {
  return /(?:regular|roman|book|normal)\.(?:ttf|otf)$/i.test(path);
}

/**
 * Normalizes family into the canonical form.
 */
export function normalizeFamily(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
