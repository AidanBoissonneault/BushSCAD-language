/**
 * @author Aidan Boissonneault
 * @file BushScadLanguageServer.test.ts
 * @purpose Tests bush scad language server behavior in the protocol in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { BushScadLanguageServer } from '../../src/protocol/BushScadLanguageServer.js';
import type { InteractionSnapshot } from '@bushscad/ir';
import { selectorArrayInteraction } from '../fixtures/interaction-snapshots.js';

const rootPath = '/project';
const mainUri = 'file:///project/main.bscd';
const libUri = 'file:///project/lib.bscd';

const libSource = `
export fn mount_hole(d = 3) {
  sketch hole_profile = circle(d);
  obj hole = cut(hole_profile, through);
}
`;

const mainSource = `
import { mount_hole } from './lib.bscd';
sketch base_profile = rect(40, 20);
obj base = extrude(base_profile, 4);
mount_hole(3);
`;

/**
 * Constructs server from the supplied values.
 */
async function makeServer(): Promise<BushScadLanguageServer> {
  const server = new BushScadLanguageServer();
  await server.start();
  server.updateWorkspace({
    rootPath,
    fileMap: {
      '/project/main.bscd': mainSource,
      '/project/lib.bscd': libSource,
    },
  });
  server.updateDocument(mainUri, mainSource);
  server.updateDocument(libUri, libSource);
  return server;
}

describe('BushScadLanguageServer', () => {
  it('returns compiler diagnostics , @open-file overlays', async () => {
    const server = await makeServer();
    server.updateDocument(mainUri, 'obj bad = extrude(missing, 4);');

    const diagnostics = await server.getDiagnostics(mainUri);

    expect(diagnostics.some((error) => error.message.includes('missing'))).toBe(
      true,
    );
  });

  it('returns selector compatibility diagnostics from the compiler', async () => {
    const server = await makeServer();
    server.updateDocument(
      mainUri,
      'obj body = extrude(rect(20, 10), 4);\nsurface bad = fill(body.top.front_left);',
    );

    const diagnostics = await server.getDiagnostics(mainUri);

    expect(
      diagnostics.some((error) =>
        error.message.includes('fill does not accept a named corner'),
      ),
    ).toBe(true);
  });

  it('reports duplicate object names before compilation is requested', async () => {
    const server = await makeServer();
    server.updateDocument(
      mainUri,
      'obj body = cube([20, 10, 5]);\nobj body = sphere(4);',
    );

    const diagnostics = await server.getDiagnostics(mainUri);

    expect(
      diagnostics.some((error) =>
        error.message.includes("Duplicate object name 'body'"),
      ),
    ).toBe(true);
  });

  it('collects workspace symbols across imported files', async () => {
    const server = await makeServer();

    const symbols = await server.getWorkspaceSymbols('mount');

    expect(symbols.map((symbol) => symbol.name)).toContain('mount_hole');
  });

  it('exposes refs to document symbols, hover, and place completion', async () => {
    const server = new BushScadLanguageServer();
    const source = 'ref pin { obj shaft = cylinder(12, d: 4); }\nplace(';
    server.updateWorkspace({ fileMap: { '/project/main.bscd': source } });
    server.updateDocument(mainUri, source);

    const symbols = await server.getDocumentSymbols(mainUri);
    const completions = await server.getCompletions(mainUri, {
      line: 2,
      col: 7,
    });
    const hover = await server.getHover(mainUri, { line: 1, col: 6 });

    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'pin', kind: 'ref' }),
      ]),
    );
    expect(completions.map((item) => item.label)).toContain('pin');
    expect(hover?.contents.join('\n')).toContain('ref pin');
  });

  it('returns hover and definition for project symbols', async () => {
    const server = await makeServer();

    const hover = await server.getHover(mainUri, { line: 5, col: 2 });
    const definition = await server.getDefinition(mainUri, { line: 5, col: 2 });

    expect(hover?.contents.join('\n')).toContain('mount_hole');
    expect(definition?.uri).toBe(libUri);
  });

  it('adds compiler-backed expanded selector values to language hover', async () => {
    const server = new BushScadLanguageServer();
    const source = 'var sides = [top, bottom];\nfillet(@body.sides.edges, 1);';
    server.updateWorkspace({
      fileMap: { '/project/main.bscd': source },
    });
    server.updateDocument(mainUri, source);
    server.updateWorkspace({ interaction: selectorArrayInteraction() });

    const hover = await server.getHover(mainUri, { line: 2, col: 15 });

    expect(hover?.contents).toContain(
      'Expanded values (2):\n- `body.top.edges`\n- `body.bottom.edges`',
    );
  });

  it('finds references across the workspace source map', async () => {
    const server = await makeServer();

    const references = await server.getReferences(mainUri, {
      line: 4,
      col: 20,
    });

    expect(references.length).toBeGreaterThanOrEqual(2);
  });

  it('prefers compiler geometry links and exposes their semantic IDs', async () => {
    const server = await makeServer();
    const interaction: InteractionSnapshot = {
      version: 1,
      entrypoint: '/project/main.bscd',
      entities: [
        {
          id: 'base',
          kind: 'object',
          name: 'base',
          declarationSpan: {
            file: '/project/main.bscd',
            line: 4,
            col: 1,
            endLine: 4,
            endCol: 36,
          },
          linkSpan: {
            file: '/project/main.bscd',
            line: 4,
            col: 5,
            endLine: 4,
            endCol: 9,
          },
          effectIds: [],
          rendered: true,
        },
      ],
      effects: [],
      references: [],
      topology: [
        {
          meshIndex: 0,
          partEntityId: 'part',
          objectEntityId: 'base',
          faces: [
            {
              id: 'base-face',
              ownerEntityId: 'base',
              semanticTargetIds: [],
              triangleStart: 0,
              triangleCount: 1,
            },
          ],
          edges: [],
          corners: [],
        },
      ],
    };
    server.updateWorkspace({ interaction });

    await expect(
      server.getGeometryLink(mainUri, { line: 4, col: 5 }),
    ).resolves.toMatchObject({
      entityIds: ['base'],
      topologyIds: ['base-face'],
    });

    server.updateDocument(mainUri, `${mainSource}\n// edited`);
    await expect(
      server.getGeometryLink(mainUri, { line: 4, col: 5 }),
    ).resolves.toBeNull();
  });

  it('returns context-aware completions and semantic tokens', async () => {
    const server = await makeServer();
    server.updateDocument(mainUri, `${mainSource}\nbase.\nloop(feature);`);

    const surfaceCompletions = await server.getCompletions(mainUri, {
      line: 7,
      col: 6,
    });
    const defaultCompletions = await server.getCompletions(mainUri, {
      line: 5,
      col: 1,
    });
    const loopHover = await server.getHover(mainUri, { line: 8, col: 2 });
    const tokens = await server.getSemanticTokens(mainUri);

    expect(surfaceCompletions.some((item) => item.label === 'top')).toBe(true);
    expect(defaultCompletions.some((item) => item.label === 'mount_hole')).toBe(
      true,
    );
    expect(defaultCompletions.some((item) => item.label === 'loop')).toBe(true);
    expect(defaultCompletions.some((item) => item.label === 'ignore')).toBe(
      true,
    );
    expect(loopHover?.contents.join('\n')).toContain('closed path loop');
    expect(tokens.some((token) => token.type === 'keyword')).toBe(true);
  });

  it('completes canonical compact rectangle plant sides', async () => {
    const server = await makeServer();
    const source = 'sketch plate = rect(40, 20) at (28, 16) plant ';
    server.updateDocument(mainUri, source);

    const completions = await server.getCompletions(mainUri, {
      line: 1,
      col: source.length + 1,
    });

    expect(completions.map(({ label }) => label)).toEqual([
      'bottom',
      'right',
      'top',
      'left',
    ]);
  });

  it('completes named bodies on a path sketch', async () => {
    const server = await makeServer();
    const source = [
      'sketch plate = path(',
      '  bottom = line((0, 0), (20, 0)),',
      '  right = line((20, 10)),',
      '  top = line((0, 10)),',
      '  left = close(),',
      '  region = closed((5, 5)),',
      '  shell = loop(bottom)',
      ');',
      'plate.',
    ].join('\n');
    server.updateDocument(mainUri, source);

    const completions = await server.getCompletions(mainUri, {
      line: 9,
      col: 7,
    });

    expect(completions.map(({ label }) => label)).toEqual(
      expect.arrayContaining(['region', 'shell']),
    );
  });

  it('isolates sketch body completions from unrelated nested scopes', async () => {
    const server = await makeServer();
    const source = [
      'sketch plate = path(',
      '  top_edge = line((0, 0), (20, 0)),',
      '  top_body = loop(top_edge)',
      ');',
      'part hidden {',
      '  sketch plate = path(',
      '    nested_edge = line((0, 0), (10, 0)),',
      '    nested_body = loop(nested_edge)',
      '  );',
      '}',
      'plate.',
    ].join('\n');
    server.updateDocument(mainUri, source);

    const completions = await server.getCompletions(mainUri, {
      line: 11,
      col: 7,
    });
    const labels = completions.map(({ label }) => label);

    expect(labels).toContain('top_body');
    expect(labels).not.toContain('nested_body');
  });

  it('completes bodies through a placed sketch-reference chain', async () => {
    const server = await makeServer();
    const source = [
      'sketch base = path(',
      '  edge = line((0, 0), (20, 0)),',
      '  shell = loop(edge)',
      ');',
      'sketch copy = base at (4, 2);',
      'copy.',
    ].join('\n');
    server.updateDocument(mainUri, source);

    const completions = await server.getCompletions(mainUri, {
      line: 6,
      col: 6,
    });

    expect(completions.map(({ label }) => label)).toContain('shell');
  });
});
