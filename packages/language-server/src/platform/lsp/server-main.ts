/**
 * @author Aidan Boissonneault
 * @file server-main.ts
 * @purpose Provides server main behavior for the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  type InitializeParams,
  type InitializeResult,
  type WorkspaceFolder,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  publishAllDiagnostics,
  publishDocumentDiagnostics,
} from './document-diagnostics.js';
import {
  registerLanguageHandlers,
  TOKEN_TYPES,
} from './register-language-handlers.js';
import { WorkspaceLanguageServices } from './workspace-services.js';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const workspaces = new WorkspaceLanguageServices();
let folders: WorkspaceFolder[] = [];

connection.onInitialize(async (params): Promise<InitializeResult> => {
  folders = initialFolders(params);
  await workspaces.setWorkspaceFolders(folders.map((folder) => folder.uri));
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: ['.', ' '] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      semanticTokensProvider: {
        legend: { tokenTypes: TOKEN_TYPES, tokenModifiers: [] },
        full: true,
      },
      colorProvider: true,
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true,
        },
      },
    },
  };
});

connection.onInitialized(() => {
  connection.workspace.onDidChangeWorkspaceFolders(async (event) => {
    const removed = new Set(event.removed.map((folder) => folder.uri));
    folders = [
      ...folders.filter((folder) => !removed.has(folder.uri)),
      ...event.added,
    ];
    await workspaces.setWorkspaceFolders(folders.map((folder) => folder.uri));
    await publishAllDiagnostics(connection, workspaces, documents);
  });
});

documents.onDidOpen((event) => {
  updateDocument(event.document);
});

documents.onDidChangeContent((event) => {
  updateDocument(event.document);
});

documents.onDidClose((event) => {
  workspaces.closeDocument(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onDidChangeWatchedFiles(async (event) => {
  await Promise.all(
    event.changes.map((change) => workspaces.refreshFile(change.uri)),
  );
  await publishAllDiagnostics(connection, workspaces, documents);
});

connection.onShutdown(async () => {
  await workspaces.dispose();
});

registerLanguageHandlers(connection, workspaces);
documents.listen(connection);
connection.listen();

/**
 * Updates document while preserving unrelated state.
 */
function updateDocument(document: TextDocument): void {
  workspaces.updateDocument(document.uri, document.getText(), document.version);
  void publishDocumentDiagnostics(connection, workspaces, document).catch(
    (error: unknown) =>
      connection.console.error(
        error instanceof Error ? error.message : String(error),
      ),
  );
}

/**
 * Handles initial folders in the platform lsp flow.
 */
function initialFolders(params: InitializeParams): WorkspaceFolder[] {
  if (params.workspaceFolders) return [...params.workspaceFolders];
  return params.rootUri
    ? [{ uri: params.rootUri, name: 'BushSCAD workspace' }]
    : [];
}
