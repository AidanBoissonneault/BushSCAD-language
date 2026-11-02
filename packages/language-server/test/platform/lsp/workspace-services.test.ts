/**
 * @author Aidan Boissonneault
 * @file workspace-services.test.ts
 * @purpose Tests workspace services behavior in the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceLanguageServices } from '../../../src/platform/lsp/workspace-services.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

/**
 * Handles workspace in the platform lsp flow.
 */
async function workspace(): Promise<{
  root: string;
  mainUri: string;
  compactUri: string;
  nestedUri: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'bushscad-lsp-'));
  temporaryRoots.push(root);
  const nested = join(root, 'nested');
  await mkdir(nested);
  await writeFile(join(root, 'main.bscd'), 'var disk_value = 1;');
  await writeFile(join(root, 'compact.bscd'), 'var compact_value = 3;');
  await writeFile(join(nested, 'part.bscd'), 'part nested {}');
  return {
    root,
    mainUri: pathToFileURL(join(root, 'main.bscd')).href,
    compactUri: pathToFileURL(join(root, 'compact.bscd')).href,
    nestedUri: pathToFileURL(join(nested, 'part.bscd')).href,
  };
}

describe('WorkspaceLanguageServices', () => {
  it('indexes roots and keeps unsaved overlays versioned', async () => {
    const fixture = await workspace();
    const services = new WorkspaceLanguageServices();
    await services.setWorkspaceFolders([pathToFileURL(fixture.root).href]);

    services.updateDocument(fixture.mainUri, 'var unsaved_value = 2;', 5);
    expect(
      await services.serviceFor(fixture.mainUri).getWorkspaceSymbols('unsaved'),
    ).toEqual([expect.objectContaining({ name: 'unsaved_value' })]);
    expect(
      await services.serviceFor(fixture.mainUri).getWorkspaceSymbols('compact'),
    ).toEqual([expect.objectContaining({ name: 'compact_value' })]);
    expect(services.documentVersion(fixture.mainUri)).toBe(5);

    services.closeDocument(fixture.mainUri);
    expect(
      await services.serviceFor(fixture.mainUri).getWorkspaceSymbols('disk'),
    ).toEqual([expect.objectContaining({ name: 'disk_value' })]);
    await services.dispose();
  });

  it('selects the deepest root and rejects stale interaction versions', async () => {
    const fixture = await workspace();
    const nestedRoot = join(fixture.root, 'nested');
    const services = new WorkspaceLanguageServices();
    await services.setWorkspaceFolders([
      pathToFileURL(fixture.root).href,
      pathToFileURL(nestedRoot).href,
    ]);
    services.updateDocument(fixture.nestedUri, 'part unsaved_nested {}', 9);

    const interaction = {
      version: 1 as const,
      entrypoint: fixture.nestedUri,
      entities: [],
      effects: [],
      references: [],
      topology: [],
    };
    expect(
      services.updateInteraction(
        fixture.nestedUri,
        { [fixture.nestedUri]: 8 },
        interaction,
      ),
    ).toBe(false);
    expect(
      services.updateInteraction(
        fixture.nestedUri,
        { [fixture.nestedUri]: 9 },
        interaction,
      ),
    ).toBe(true);
    await services.dispose();
  });
});
