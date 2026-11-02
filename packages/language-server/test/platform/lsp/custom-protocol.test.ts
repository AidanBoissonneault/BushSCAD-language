/**
 * @author Aidan Boissonneault
 * @file custom-protocol.test.ts
 * @purpose Tests custom protocol behavior in the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  parseLanguageLocation,
  parseVersionedInteractionUpdate,
  parseVersionedPositionRequest,
  parseVersionedSourceEdits,
} from '../../../src/platform/lsp/custom-protocol.js';

const interaction = {
  version: 1,
  entrypoint: '/project/main.bscd',
  entities: [],
  effects: [],
  references: [],
  topology: [],
};

describe('BushSCAD custom LSP protocol', () => {
  it('validates document versions and one-based positions', () => {
    expect(
      parseVersionedPositionRequest({
        uri: 'file:///project/main.bscd',
        version: 7,
        position: { line: 2, col: 4 },
      }),
    ).toEqual({
      uri: 'file:///project/main.bscd',
      version: 7,
      position: { line: 2, col: 4 },
    });
    expect(() =>
      parseVersionedPositionRequest({ uri: '', version: -1 }),
    ).toThrow();
  });

  it('accepts only versioned compiler interaction snapshots', () => {
    const update = parseVersionedInteractionUpdate({
      uri: 'file:///project/main.bscd',
      documentVersions: { 'file:///project/main.bscd': 3 },
      interaction,
    });
    expect(update.documentVersions).toEqual({
      'file:///project/main.bscd': 3,
    });
    expect(() =>
      parseVersionedInteractionUpdate({
        uri: 'file:///project/main.bscd',
        documentVersions: {},
        interaction,
      }),
    ).toThrow(/include the request uri/);
    expect(() =>
      parseVersionedInteractionUpdate({
        uri: 'file:///project/main.bscd',
        documentVersions: { 'file:///project/main.bscd': 3 },
        interaction: { ...interaction, effects: null },
      }),
    ).toThrow(/version 1/);
  });

  it('validates locations used by native source navigation', () => {
    expect(
      parseLanguageLocation({
        uri: 'file:///project/main.bscd',
        range: {
          start: { line: 2, col: 3 },
          end: { line: 2, col: 7 },
        },
      }),
    ).toEqual({
      uri: 'file:///project/main.bscd',
      range: {
        start: { line: 2, col: 3 },
        end: { line: 2, col: 7 },
      },
    });
  });

  it('allows deletion edits while rejecting malformed ranges', () => {
    const edits = parseVersionedSourceEdits({
      documents: [
        {
          uri: 'file:///project/main.bscd',
          version: 4,
          edits: [
            {
              range: {
                start: { line: 1, col: 1 },
                end: { line: 1, col: 5 },
              },
              newText: '',
            },
          ],
        },
      ],
    });
    expect(edits.documents[0]?.edits[0]?.newText).toBe('');
    expect(() =>
      parseVersionedSourceEdits({ documents: [{ edits: 'invalid' }] }),
    ).toThrow(/edits must be an array/);
  });
});
