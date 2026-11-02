/**
 * @author Aidan Boissonneault
 * @file workspace-services.ts
 * @purpose Provides workspace services behavior for the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import { dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { InteractionSnapshot } from '@bushscad/ir';
import { BushScadLanguageServer } from '../../protocol/BushScadLanguageServer.js';
import type { LanguageSymbol } from '../../protocol/ILanguageServer.js';
import { normalizePath, pathFromUri } from '../../language/uri.js';
import { readBushScadWorkspace } from './workspace-files.js';

/**
 * Workspace session, including workspace root, files, service, and standalone.
 */
type WorkspaceSession = {
  rootPath: string;
  files: Record<string, string>;
  service: BushScadLanguageServer;
  standalone: boolean;
};

/** Owns one editor-neutral language service per VS Code workspace folder. */
export class WorkspaceLanguageServices {
  private sessions: WorkspaceSession[] = [];
  private readonly openDocuments = new Map<
    string,
    { text: string; version: number }
  >();

  /** Rebuilds multi-root indexes and reapplies every unsaved document overlay. */
  async setWorkspaceFolders(rootUris: readonly string[]): Promise<void> {
    const prior = this.sessions;
    this.sessions = await Promise.all(
      rootUris.map(async (rootUri) => {
        const rootPath = pathFromUri(rootUri);
        const service = new BushScadLanguageServer();
        const files = await readBushScadWorkspace(rootPath);
        service.updateWorkspace({ rootPath, fileMap: files });
        await service.start();
        return { rootPath, files, service, standalone: false };
      }),
    );
    await Promise.all(prior.map((session) => session.service.stop()));
    for (const [uri, document] of this.openDocuments) {
      this.sessionForUri(uri).service.updateDocument(uri, document.text);
    }
  }

  /** Installs or replaces an unsaved document at its exact VS Code version. */
  updateDocument(uri: string, text: string, version: number): void {
    this.openDocuments.set(uri, { text, version });
    this.sessionForUri(uri).service.updateDocument(uri, text);
  }

  /** Removes an overlay while retaining the indexed on-disk document. */
  closeDocument(uri: string): void {
    this.openDocuments.delete(uri);
    this.sessionForUri(uri).service.closeDocument(uri);
  }

  /** Refreshes an indexed file after an LSP watched-file notification. */
  async refreshFile(uri: string): Promise<void> {
    const session = this.sessionForUri(uri);
    const filePath = normalizePath(pathFromUri(uri));
    try {
      session.files[filePath] = await readFile(filePath, 'utf8');
    } catch {
      delete session.files[filePath];
    }
    session.service.updateWorkspace({
      rootPath: session.rootPath,
      fileMap: session.files,
    });
    for (const [openUri, document] of this.openDocuments) {
      if (this.sessionForUri(openUri) === session)
        session.service.updateDocument(openUri, document.text);
    }
  }

  /**
   * Handles service for in the platform lsp flow.
   */
  serviceFor(uri: string): BushScadLanguageServer {
    return this.sessionForUri(uri).service;
  }

  /**
   * Handles document text in the platform lsp flow.
   */
  documentText(uri: string): string {
    const open = this.openDocuments.get(uri);
    if (open) return open.text;
    return this.sessionForUri(uri).files[normalizePath(pathFromUri(uri))] ?? '';
  }

  /**
   * Handles document version in the platform lsp flow.
   */
  documentVersion(uri: string): number | undefined {
    return this.openDocuments.get(uri)?.version;
  }

  /** Supplies indexed imports with current buffers taking precedence for previews. */
  sketchFiles(uri: string): Record<string, string> {
    const session = this.sessionForUri(uri);
    const files = { ...session.files };
    for (const [openUri, document] of this.openDocuments) {
      if (this.sessionForUri(openUri) === session)
        files[normalizePath(pathFromUri(openUri))] = document.text;
    }
    return files;
  }

  /**
   * Opens document uris and initializes its resources.
   */
  openDocumentUris(): string[] {
    return [...this.openDocuments.keys()];
  }

  /** Aggregates symbols from every independent workspace without duplicates. */
  async workspaceSymbols(query: string): Promise<LanguageSymbol[]> {
    const symbols = (
      await Promise.all(
        this.sessions.map((session) =>
          session.service.getWorkspaceSymbols(query),
        ),
      )
    ).flat();
    const seen = new Set<string>();
    return symbols.filter((symbol) => {
      const key = `${symbol.uri}:${symbol.range.start.line}:${symbol.range.start.col}:${symbol.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Accepts compiler interaction only when every contributing buffer is current. */
  updateInteraction(
    uri: string,
    versions: Readonly<Record<string, number>>,
    interaction: InteractionSnapshot,
  ): boolean {
    for (const [documentUri, version] of Object.entries(versions)) {
      if (this.documentVersion(documentUri) !== version) return false;
    }
    this.serviceFor(uri).updateWorkspace({ interaction });
    return true;
  }

  /**
   * Returns whether the input meets the `current` condition.
   */
  isCurrent(uri: string, version: number): boolean {
    return this.documentVersion(uri) === version;
  }

  /**
   * Releases the owned resources held by this object.
   */
  async dispose(): Promise<void> {
    await Promise.all(this.sessions.map((session) => session.service.stop()));
    this.sessions = [];
    this.openDocuments.clear();
  }

  /**
   * Handles session for uri in the platform lsp flow.
   */
  private sessionForUri(uri: string): WorkspaceSession {
    const filePath = normalizePath(pathFromUri(uri));
    const match = this.sessions
      .filter((session) => containsPath(session.rootPath, filePath))
      .sort((left, right) => right.rootPath.length - left.rootPath.length)[0];
    if (match) return match;
    const rootPath = normalizePath(dirname(filePath));
    const existing = this.sessions.find(
      (session) => session.standalone && samePath(session.rootPath, rootPath),
    );
    if (existing) return existing;
    const service = new BushScadLanguageServer();
    const session = {
      rootPath,
      files: {},
      service,
      standalone: true,
    };
    service.updateWorkspace({ rootPath, fileMap: session.files });
    this.sessions.push(session);
    return session;
  }
}

/**
 * Handles comparable path in the platform lsp flow.
 */
function comparablePath(path: string): string {
  const normalized = normalizePath(path).replace(/\/$/, '');
  return /^[A-Za-z]:/.test(normalized) ? normalized.toLowerCase() : normalized;
}

/**
 * Checks whether the supplied path values are equivalent.
 */
function samePath(left: string, right: string): boolean {
  return comparablePath(left) === comparablePath(right);
}

/**
 * Handles contains path in the platform lsp flow.
 */
function containsPath(root: string, candidate: string): boolean {
  const rootPath = comparablePath(root);
  const candidatePath = comparablePath(candidate);
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}/`);
}
