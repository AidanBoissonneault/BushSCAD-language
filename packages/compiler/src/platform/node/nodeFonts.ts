/**
 * @author Aidan Boissonneault
 * @file nodeFonts.ts
 * @purpose Provides node fonts behavior for the platform node in compiler package.
 * @last-edited October 6, 2026
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import type { OpenCascadeModule } from '@bushscad/occt-bridge/opencascade-types';

/**
 * Installs bundled fallback fonts into OpenCascade when available.
 * Text geometry should work in packaged Node contexts even when the host
 * system does not provide the requested fonts.
 */
function findFontDir(): string | null {
  const candidates = [
    resolvePath(dirname(process.argv[1] ?? ''), 'fonts'),
    resolvePath(process.cwd(), 'packages/compiler/assets/fonts'),
    resolvePath(process.cwd(), 'assets/fonts'),
    resolvePath(process.cwd(), '../compiler/assets/fonts'),
  ];
  return (
    candidates.find((path) => existsSync(join(path, 'NotoSans-Regular.ttf'))) ??
    null
  );
}

/**
 * Installs fallback fonts and registers its resources.
 */
export function installFallbackFonts(oc: OpenCascadeModule): void {
  const fontDir = findFontDir();
  if (!fontDir) return;
  try {
    oc.FS.mkdir('/fonts');
  } catch {
    // Directory already exists in the Emscripten FS.
  }

  const fonts = [
    ['NotoSans-Regular.ttf', '/fonts/FallbackSans-Regular.ttf'],
    ['NotoSerif-Regular.ttf', '/fonts/FallbackSerif-Regular.ttf'],
    ['NotoSansMono-Regular.ttf', '/fonts/FallbackMono-Regular.ttf'],
  ] as const;

  for (const [fileName, fsPath] of fonts) {
    const sourcePath = join(fontDir, fileName);
    if (existsSync(sourcePath)) {
      oc.FS.writeFile(fsPath, new Uint8Array(readFileSync(sourcePath)));
    }
  }
}
