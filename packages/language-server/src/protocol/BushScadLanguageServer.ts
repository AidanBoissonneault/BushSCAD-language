/**
 * @author Aidan Boissonneault
 * @file BushScadLanguageServer.ts
 * @purpose Provides bush scad language server behavior for the protocol in language server package.
 * @last-edited October 6, 2026
 */

import {
  formatInteractionValuePreview,
  interactionValuePreview,
  type CompileError,
  type InteractionSnapshot,
} from '@bushscad/ir';
import type { RawEnvOverrides, WorkspaceIndex } from '@bushscad/compiler';
import type {
  ILanguageServer,
  LanguageCompletionItem,
  LanguageGeometryLink,
  LanguageHover,
  LanguageLocation,
  LanguagePosition,
  LanguageSymbol,
  LanguageWorkspaceInput,
  SemanticToken,
} from './ILanguageServer.js';
import { completionItems } from '../providers/completions.js';
import { languageHover } from '../language/help/catalog.js';
import { hoverWordAtPosition } from '../language/help/hover-word.js';
import { findIdentifierReferences } from '../providers/references.js';
import { collectSemanticTokens } from '../providers/semanticTokens.js';
import { collectSymbolsForSource } from '../providers/symbols.js';
import { wordAtPosition } from '../language/textPositions.js';
import { pathFromUri } from '../language/uri.js';
import {
  geometryDefinition,
  geometryLinkAtPosition,
  geometryReferences,
} from '../providers/geometryLinks.js';

/**
 * Open document, including uri, source file path, and content.
 */
type OpenDocument = {
  uri: string;
  filePath: string;
  content: string;
};

/**
 * Project-aware BushSCAD language service.
 * M21 needs one analyzer surface for completion and LSP transport while
 * reusing the compiler's workspace index and diagnostics behavior.
 */
export class BushScadLanguageServer implements ILanguageServer {
  private rootPath: string | null = null;
  private baseFileMap: Record<string, string> = {};
  private assetMap: Record<string, Uint8Array> = {};
  private env: RawEnvOverrides | undefined;
  private workspaceIndex: WorkspaceIndex | undefined;
  private interaction: InteractionSnapshot | null = null;
  private symbols: LanguageSymbol[] | null = null;
  private readonly documents = new Map<string, OpenDocument>();

  /**
   * Starts with the supplied configuration.
   */
  async start(): Promise<void> {}

  /**
   * Stops and releases its active resources.
   */
  async stop(): Promise<void> {
    this.documents.clear();
    this.interaction = null;
    this.symbols = null;
  }

  /**
   * Updates workspace while preserving unrelated state.
   */
  updateWorkspace(input: LanguageWorkspaceInput): void {
    if (input.fileMap && !('interaction' in input)) this.interaction = null;
    this.rootPath = input.rootPath ?? this.rootPath;
    this.baseFileMap = input.fileMap
      ? normalizeFileMap(input.fileMap)
      : this.baseFileMap;
    this.assetMap = input.assetMap ?? this.assetMap;
    this.env = input.env ?? this.env;
    this.workspaceIndex = input.workspaceIndex;
    if ('interaction' in input) this.interaction = input.interaction ?? null;
    this.symbols = null;
  }

  /**
   * Updates document while preserving unrelated state.
   */
  updateDocument(uri: string, content: string): void {
    const filePath = pathFromUri(uri);
    const priorContent =
      this.documents.get(uri)?.content ?? this.baseFileMap[filePath];
    if (priorContent !== undefined && priorContent !== content) {
      this.interaction = null;
    }
    this.documents.set(uri, {
      uri,
      filePath,
      content,
    });
    this.workspaceIndex = undefined;
    this.symbols = null;
  }

  /** Removes an unsaved overlay so the workspace copy becomes authoritative. */
  closeDocument(uri: string): void {
    if (!this.documents.delete(uri)) return;
    this.interaction = null;
    this.workspaceIndex = undefined;
    this.symbols = null;
  }

  /**
   * Returns diagnostics from the supplied input.
   */
  async getDiagnostics(uri: string): Promise<CompileError[]> {
    const document = this.documentForUri(uri);
    const { collectDiagnostics } =
      await import('../diagnostics/diagnostics.js');
    return collectDiagnostics({
      source: document.content,
      filePath: document.filePath,
      fileMap: this.fileMap(),
    });
  }

  /**
   * Returns completions from the supplied input.
   */
  async getCompletions(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageCompletionItem[]> {
    const document = this.documentForUri(uri);
    return completionItems(
      document.content,
      position,
      this.collectWorkspaceSymbols(),
    );
  }

  /**
   * Returns hover from the supplied input.
   */
  async getHover(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageHover | null> {
    const document = this.documentForUri(uri);
    const word = hoverWordAtPosition(document.content, position);
    if (!word.word) return null;
    const valuePreview = this.interaction
      ? geometryValuePreview(this.interaction, document.filePath, position)
      : null;
    const symbol = this.collectWorkspaceSymbols().find(
      (candidate) => candidate.name === word.word,
    );
    if (symbol) {
      return {
        range: { start: word.start, end: word.end },
        contents: [
          `**${symbol.kind}** \`${symbol.name}\``,
          symbol.detail,
          ...(symbol.documentation ? [symbol.documentation] : []),
          ...(symbol.value ? [`\`${symbol.value}\``] : []),
          ...(valuePreview ? [valuePreview] : []),
        ],
      };
    }
    const languageDoc = languageHover(word.word);
    if (!languageDoc) return null;
    return {
      range: { start: word.start, end: word.end },
      contents: [...languageDoc, ...(valuePreview ? [valuePreview] : [])],
    };
  }

  /**
   * Returns definition from the supplied input.
   */
  async getDefinition(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageLocation | null> {
    const document = this.documentForUri(uri);
    const geometry = this.interaction
      ? geometryDefinition(this.interaction, document.filePath, position)
      : null;
    if (geometry) return geometry;
    const word = wordAtPosition(document.content, position).word;
    if (!word) return null;
    const symbol = this.collectWorkspaceSymbols().find(
      (candidate) => candidate.name === word,
    );
    return symbol ? { uri: symbol.uri, range: symbol.range } : null;
  }

  /**
   * Returns workspace symbols from the supplied input.
   */
  async getWorkspaceSymbols(query = ''): Promise<LanguageSymbol[]> {
    const lower = query.toLowerCase();
    return this.collectWorkspaceSymbols().filter((symbol) =>
      symbol.name.toLowerCase().includes(lower),
    );
  }

  /**
   * Returns document symbols from the supplied input.
   */
  async getDocumentSymbols(uri: string): Promise<LanguageSymbol[]> {
    const document = this.documentForUri(uri);
    return collectSymbolsForSource(document.content, document.filePath);
  }

  /**
   * Returns references from the supplied input.
   */
  async getReferences(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageLocation[]> {
    const document = this.documentForUri(uri);
    const geometry = this.interaction
      ? geometryReferences(this.interaction, document.filePath, position)
      : null;
    if (geometry) return geometry;
    const word = wordAtPosition(document.content, position).word;
    return findIdentifierReferences(this.fileMap(), word);
  }

  /**
   * Returns semantic tokens from the supplied input.
   */
  async getSemanticTokens(uri: string): Promise<SemanticToken[]> {
    return collectSemanticTokens(this.documentForUri(uri).content);
  }

  /**
   * Returns geometry link from the supplied input.
   */
  async getGeometryLink(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageGeometryLink | null> {
    if (!this.interaction) return null;
    const document = this.documentForUri(uri);
    return geometryLinkAtPosition(
      this.interaction,
      document.filePath,
      position,
    );
  }

  /**
   * Handles document for uri in the protocol flow.
   */
  private documentForUri(uri: string): OpenDocument {
    const known = this.documents.get(uri);
    if (known) return known;
    const filePath = pathFromUri(uri);
    return {
      uri,
      filePath,
      content: this.baseFileMap[filePath] ?? '',
    };
  }

  /**
   * Handles file map in the protocol flow.
   */
  private fileMap(): Record<string, string> {
    const overlays = Object.fromEntries(
      [...this.documents.values()].map((document) => [
        document.filePath,
        document.content,
      ]),
    );
    return { ...this.baseFileMap, ...overlays };
  }

  /**
   * Collects workspace symbols from the supplied values.
   */
  private collectWorkspaceSymbols(): LanguageSymbol[] {
    if (this.symbols) return this.symbols;
    const fileMap = this.fileMap();
    const paths = this.workspaceIndex
      ? Object.keys(this.workspaceIndex.files)
      : Object.keys(fileMap);
    this.symbols = paths.flatMap((path) => {
      const source = fileMap[path];
      return source == null ? [] : collectSymbolsForSource(source, path);
    });
    return this.symbols;
  }
}

/**
 * Handles geometry value preview in the protocol flow.
 */
function geometryValuePreview(
  snapshot: InteractionSnapshot,
  filePath: string,
  position: LanguagePosition,
): string | null {
  const link = geometryLinkAtPosition(snapshot, filePath, position);
  if (!link) return null;
  const preview = interactionValuePreview(
    snapshot,
    link.entityIds,
    link.topologyIds,
  );
  if (!preview) return null;
  return formatInteractionValuePreview(preview);
}

/**
 * Normalizes file map into the canonical form.
 */
function normalizeFileMap(
  fileMap: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fileMap).map(([path, source]) => [
      pathFromUri(path),
      source,
    ]),
  );
}
