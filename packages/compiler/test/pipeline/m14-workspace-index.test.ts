/**
 * @author Aidan Boissonneault
 * @file m14-workspace-index.test.ts
 * @purpose Tests m14 workspace index behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceIndex,
  compileDocument,
  entrypointsAffectedByPath,
  isBushScadFile,
  normalizePath,
} from '../../src/index';
import { compileFileToIr } from '../../src/platform/node/node';

describe('M14 workspace index', () => {
  it('recognizes the source extension case-insensitively', () => {
    expect(isBushScadFile('C:\\workspace\\main.bscd')).toBe(true);
    expect(isBushScadFile('C:\\workspace\\main.BSCD')).toBe(true);
    expect(isBushScadFile('C:\\workspace\\main.bushscad')).toBe(false);
    expect(isBushScadFile('C:\\workspace\\main.bscd.txt')).toBe(false);
  });

  it('compiles a .bscd entrypoint with a local import', () => {
    const root = '/workspace';
    const mainPath = `${root}/main.bscd`;
    const libraryPath = `${root}/library.bscd`;
    const source = `
import { width } from './library.bscd';
part body {
  sketch profile = rect(width, 5);
  obj solid = extrude(profile, 2);
}
`;
    const result = compileDocument({
      source,
      filePath: mainPath,
      rootPath: root,
      fileMap: {
        [mainPath]: source,
        [libraryPath]: 'export var width = 10;',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.dependencies[mainPath]).toContain(libraryPath);
    expect(result.program.ops.some((op) => op.kind === 'extrude')).toBe(true);
  });

  it('marks only normalized overlay paths in the workspace graph', () => {
    const root = '/workspace';
    const mainPath = `${root}/main.bscd`;
    const libraryPath = `${root}/library.bscd`;
    const index = buildWorkspaceIndex({
      rootPath: root,
      activeFilePath: mainPath,
      fileMap: {
        [mainPath]: "import { width } from './library.bscd';",
        [libraryPath]: 'export var width = 10;',
      },
      overlays: { [libraryPath]: 'export var width = 12;' },
    });

    expect(index.files[mainPath]?.isOverlay).toBe(false);
    expect(index.files[libraryPath]?.isOverlay).toBe(true);
  });

  it('reuses unchanged Node workspace graphs and refreshes changed imports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bushscad-workspace-cache-'));
    const mainPath = join(root, 'main.bscd');
    const libraryPath = join(root, 'library.bscd');
    const extraPath = join(root, 'extra.bscd');
    const initialSource = `
import { width } from './library.bscd';
part p {
  sketch profile = rect(width, 5);
  obj solid = extrude(profile, 2);
}
`;

    try {
      await writeFile(mainPath, initialSource, 'utf8');
      await writeFile(libraryPath, 'export var width = 10;', 'utf8');
      const first = compileFileToIr({ filePath: mainPath });
      const repeated = compileFileToIr({ filePath: mainPath });
      expect(first.ok).toBe(true);
      expect(repeated.ok).toBe(true);
      if (!first.ok || !repeated.ok) return;
      expect(repeated.program).toEqual(first.program);
      expect(repeated.workspace).toEqual(first.workspace);

      const changedSource = `
import { width } from './library.bscd';
import { depth } from './extra.bscd';
part p {
  sketch profile = rect(width, depth);
  obj solid = extrude(profile, 2);
}
`;
      await writeFile(mainPath, changedSource, 'utf8');
      await writeFile(extraPath, 'export var depth = 7;', 'utf8');
      const changed = compileFileToIr({ filePath: mainPath });
      expect(changed.ok).toBe(true);
      if (!changed.ok) return;

      expect(changed.workspace.dependencies[normalizePath(mainPath)]).toContain(
        normalizePath(extraPath),
      );
      expect(changed.program).not.toEqual(first.program);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('treats a folder without a manifest as an implicit active-file project', () => {
    const filePath = normalizePath('C:\\workspace\\main.bscd');
    const index = buildWorkspaceIndex({
      rootPath: normalizePath('C:\\workspace'),
      activeFilePath: filePath,
      fileMap: { [filePath]: 'part plate {}' },
    });

    expect(index.manifest).toBeNull();
    expect(index.defaultEntrypoint).toBe(filePath);
    expect(index.entrypoints).toEqual([
      { name: 'main', path: filePath, isDefault: true },
    ]);
  });

  it('discovers reverse imports in a manifest-less tooling graph', () => {
    const root = normalizePath('C:\\workspace');
    const partPath = `${root}/part.bscd`;
    const mainPath = `${root}/main.bscd`;
    const index = buildWorkspaceIndex({
      rootPath: root,
      activeFilePath: partPath,
      discoveryPaths: [partPath, mainPath],
      fileMap: {
        [partPath]: 'export sketch plate = rect(10, 5);',
        [mainPath]: "import { plate } from './part.bscd';",
      },
    });

    expect(index.errors).toEqual([]);
    expect(index.dependents[partPath]).toEqual([mainPath]);
  });

  it('builds a manifest workspace graph from entrypoints, imports, includes, and font assets', () => {
    const root = normalizePath('C:\\workspace');
    const mainPath = `${root}/src/main.bscd`;
    const logoPath = `${root}/src/logo.bscd`;
    const helperPath = `${root}/src/helper.bscd`;
    const fontPath = `${root}/assets/Brand.ttf`;
    const manifestPath = `${root}/bushscad.json`;
    const index = buildWorkspaceIndex({
      rootPath: root,
      activeFilePath: helperPath,
      fileMap: {
        [manifestPath]: JSON.stringify({
          version: 1,
          entrypoints: {
            main: 'src/main.bscd',
            logo: 'src/logo.bscd',
          },
          defaultEntrypoint: 'logo',
          include: ['src/**/*.bscd'],
          assets: ['assets/catalog.csv'],
          env: { mode: 'preview' },
          export: { format: 'step', entrypoints: ['logo'] },
        }),
        [mainPath]: "import './helper.bscd';\npart main {}",
        [logoPath]: "font brand = import '../assets/Brand.ttf';\npart logo {}",
        [helperPath]: 'export part helper {}',
      },
    });

    expect(index.errors).toEqual([]);
    expect(index.manifestPath).toBe(manifestPath);
    expect(index.defaultEntrypoint).toBe(logoPath);
    expect(index.dependencies[mainPath]).toContain(helperPath);
    expect(index.dependencies[logoPath]).toContain(fontPath);
    expect(index.assets).toEqual([
      `${root}/assets/Brand.ttf`,
      `${root}/assets/catalog.csv`,
    ]);
    expect(
      entrypointsAffectedByPath(index, helperPath).map((entry) => entry.name),
    ).toEqual(['main']);
  });

  it('expands recursive and shallow source globs in workspace manifests', () => {
    const root = '/workspace';
    const mainPath = `${root}/src/main.bscd`;
    const nestedPath = `${root}/src/nested/part.bscd`;
    const shallowPath = `${root}/src/shallow.bscd`;
    const ignoredPath = `${root}/notes.txt`;
    const index = buildWorkspaceIndex({
      rootPath: root,
      activeFilePath: mainPath,
      fileMap: {
        [`${root}/bushscad.json`]: JSON.stringify({
          version: 1,
          entrypoints: ['src/main.bscd'],
          include: ['src/**/*.bscd', 'src/*.bscd'],
        }),
        [mainPath]: 'part main {}',
        [nestedPath]: 'part nested {}',
        [shallowPath]: 'part shallow {}',
        [ignoredPath]: 'not a source file',
      },
    });

    expect(index.errors).toEqual([]);
    expect(Object.keys(index.files).sort()).toEqual(
      [mainPath, nestedPath, shallowPath].sort(),
    );
  });

  it('normalizes array entrypoints and resolves a default by path', () => {
    const root = normalizePath('C:\\workspace');
    const mainPath = `${root}/src/main.bscd`;
    const logoPath = `${root}/src/logo.bscd`;
    const manifestPath = `${root}/bushscad.json`;
    const index = buildWorkspaceIndex({
      rootPath: root,
      activeFilePath: mainPath,
      fileMap: {
        [manifestPath]: JSON.stringify({
          version: 1,
          entrypoints: [
            { name: 'main', path: 'src/main.bscd' },
            'src/logo.bscd',
          ],
          defaultEntrypoint: 'src/logo.bscd',
        }),
        [mainPath]: 'part main {}',
        [logoPath]: 'part logo {}',
      },
    });

    expect(index.errors).toEqual([]);
    expect(index.defaultEntrypoint).toBe(logoPath);
    expect(index.entrypoints).toEqual([
      { name: 'main', path: mainPath, isDefault: false },
      { name: 'logo', path: logoPath, isDefault: true },
    ]);
  });

  it('compiles the manifest default when the active file is a private dependency', () => {
    const root = normalizePath('C:\\workspace');
    const mainPath = `${root}/src/main.bscd`;
    const helperPath = `${root}/src/helper.bscd`;
    const helperSource = 'export part helper {}';
    const mainSource = `
import './helper.bscd';
part plate {
  sketch s = rect(10, 5);
  obj body = extrude(s, 2);
}
`;
    const result = compileDocument({
      source: helperSource,
      filePath: helperPath,
      rootPath: root,
      fileMap: {
        [`${root}/bushscad.json`]: JSON.stringify({
          version: 1,
          entrypoints: [{ name: 'main', path: 'src/main.bscd' }],
          defaultEntrypoint: 'main',
        }),
        [mainPath]: mainSource,
        [helperPath]: helperSource,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.defaultEntrypoint).toBe(mainPath);
    expect(result.program.ops.some((op) => op.kind === 'extrude')).toBe(true);
  });

  it('ignores manifest env defaults that are not declared by the active entrypoint', () => {
    const root = normalizePath('C:\\workspace');
    const mainPath = `${root}/src/main.bscd`;
    const badgePath = `${root}/src/badge.bscd`;
    const result = compileDocument({
      source: 'export part badge {}',
      filePath: badgePath,
      rootPath: root,
      fileMap: {
        [`${root}/bushscad.json`]: JSON.stringify({
          version: 1,
          entrypoints: {
            main: 'src/main.bscd',
            badge: 'src/badge.bscd',
          },
          defaultEntrypoint: 'main',
          env: { build_mode: 'preview' },
        }),
        [mainPath]: "env build_mode fallback 'preview';\npart main {}",
        [badgePath]: 'export part badge {}',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env).toEqual([]);
  });

  it('compiles a manifest project directory through the default entrypoint', () => {
    const projectPath = fileURLToPath(
      new URL('../../../../examples/m14', import.meta.url),
    );
    const result = compileFileToIr({ filePath: projectPath });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.defaultEntrypoint).toMatch(/src\/main\.bscd$/);
    expect(result.env.map((entry) => entry.name)).toEqual(['build_mode']);
  });

  it('reports invalid manifest defaults before compiling', () => {
    const root = normalizePath('C:\\workspace');
    const mainPath = `${root}/main.bscd`;
    const result = compileDocument({
      source: 'part main {}',
      filePath: mainPath,
      rootPath: root,
      fileMap: {
        [`${root}/bushscad.json`]: JSON.stringify({
          version: 1,
          entrypoints: ['main.bscd'],
          defaultEntrypoint: 'missing',
        }),
        [mainPath]: 'part main {}',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain("Default entrypoint 'missing'");
    expect(result.errors[0].span.file).toBe(`${root}/bushscad.json`);
  });
});
