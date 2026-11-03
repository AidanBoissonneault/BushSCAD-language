/**
 * @author Aidan Boissonneault
 * @file geometry-link-request.test.ts
 * @purpose Tests cancellation and version checks for geometry-link requests.
 * @last-edited November 3, 2026
 */

import type { CancellationToken } from 'vscode-languageserver/node';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceLanguageServices } from '../../../src/platform/lsp/workspace-services.js';
import { handleGeometryLinkRequest } from '../../../src/platform/lsp/geometry-link-request.js';

const request = {
  uri: 'file:///model.bscd',
  version: 4,
  position: { line: 2, col: 3 },
};

describe('geometry-link request', () => {
  it('skips canceled and stale requests before querying the document', async () => {
    const getGeometryLink = vi.fn();
    const workspaces = workspace(false, getGeometryLink);

    await expect(
      handleGeometryLinkRequest(request, token(true), workspaces),
    ).resolves.toBeNull();
    await expect(
      handleGeometryLinkRequest(request, token(false), workspaces),
    ).resolves.toBeNull();
    expect(getGeometryLink).not.toHaveBeenCalled();
  });

  it('returns a link while the requested document version remains current', async () => {
    const link = { label: 'body.top', source: { file: 'model.bscd', line: 2, col: 3 } };
    const workspaces = workspace(true, vi.fn().mockResolvedValue(link));

    await expect(
      handleGeometryLinkRequest(request, token(false), workspaces),
    ).resolves.toEqual({ uri: request.uri, version: request.version, link });
  });

  it('drops a result made stale during link resolution', async () => {
    let current = true;
    const workspaces = workspace(() => current, async () => {
      current = false;
      return null;
    });

    await expect(
      handleGeometryLinkRequest(request, token(false), workspaces),
    ).resolves.toBeNull();
    expect(current).toBe(false);
  });

  it('drops a result canceled during link resolution', async () => {
    let canceled = false;
    const cancellation: CancellationToken = {
      get isCancellationRequested() {
        return canceled;
      },
      onCancellationRequested: vi.fn(),
    };
    const workspaces = workspace(true, async () => {
      canceled = true;
      return null;
    });

    await expect(
      handleGeometryLinkRequest(request, cancellation, workspaces),
    ).resolves.toBeNull();
  });
});

/** Creates a structural workspace mock for protocol request tests. */
function workspace(
  current: boolean | (() => boolean),
  getGeometryLink: (...args: unknown[]) => Promise<unknown> | unknown,
): WorkspaceLanguageServices {
  return {
    isCurrent: vi.fn(() =>
      typeof current === 'function' ? current() : current,
    ),
    serviceFor: vi.fn(() => ({ getGeometryLink })),
  } as unknown as WorkspaceLanguageServices;
}

/** Creates the LSP cancellation token used by each request scenario. */
function token(isCancellationRequested: boolean): CancellationToken {
  return { isCancellationRequested, onCancellationRequested: vi.fn() };
}
