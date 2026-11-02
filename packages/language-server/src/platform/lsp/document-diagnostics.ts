/**
 * @author Aidan Boissonneault
 * @file document-diagnostics.ts
 * @purpose Provides document diagnostics behavior for the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import type { Connection, TextDocuments } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { toLspDiagnostic } from './conversions.js';
import type { WorkspaceLanguageServices } from './workspace-services.js';

/** Publishes diagnostics only if analysis still matches the open document version. */
export async function publishDocumentDiagnostics(
  connection: Connection,
  workspaces: WorkspaceLanguageServices,
  document: TextDocument,
): Promise<void> {
  const version = document.version;
  const errors = await workspaces
    .serviceFor(document.uri)
    .getDiagnostics(document.uri);
  if (!workspaces.isCurrent(document.uri, version)) return;
  connection.sendDiagnostics({
    uri: document.uri,
    version,
    diagnostics: errors.map(toLspDiagnostic),
  });
}

/** Revalidates all open documents when an imported file changes on disk. */
export async function publishAllDiagnostics(
  connection: Connection,
  workspaces: WorkspaceLanguageServices,
  documents: TextDocuments<TextDocument>,
): Promise<void> {
  await Promise.all(
    documents
      .all()
      .map((document) =>
        publishDocumentDiagnostics(connection, workspaces, document),
      ),
  );
}
