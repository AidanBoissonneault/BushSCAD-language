/**
 * @author Aidan Boissonneault
 * @file geometry-link-request.ts
 * @purpose Handles versioned geometry-link requests over LSP.
 * @last-edited November 3, 2026
 */

import type { CancellationToken } from 'vscode-languageserver/node';
import {
  parseVersionedPositionRequest,
  type VersionedGeometryLinkResponse,
} from './custom-protocol.js';
import type { WorkspaceLanguageServices } from './workspace-services.js';

/** Resolves a geometry link only while its source document version stays current. */
export async function handleGeometryLinkRequest(
  value: unknown,
  token: CancellationToken,
  workspaces: WorkspaceLanguageServices,
): Promise<VersionedGeometryLinkResponse | null> {
  const request = parseVersionedPositionRequest(value);
  if (
    token.isCancellationRequested ||
    !workspaces.isCurrent(request.uri, request.version)
  )
    return null;

  const link = await workspaces
    .serviceFor(request.uri)
    .getGeometryLink(request.uri, request.position);
  if (token.isCancellationRequested) return null;
  if (!workspaces.isCurrent(request.uri, request.version)) return null;
  return { uri: request.uri, version: request.version, link };
}
