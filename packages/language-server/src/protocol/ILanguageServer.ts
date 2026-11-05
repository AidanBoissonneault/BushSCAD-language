/**
 * @author Aidan Boissonneault
 * @file ILanguageServer.ts
 * @purpose Provides i language server behavior for the protocol in language server package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  InteractionSnapshot,
  InteractionSourceLinkKind,
} from '@bushscad/ir';
import type { RawEnvOverrides, WorkspaceIndex } from '@bushscad/compiler';

/**
 * Language position, including source line and source column.
 */
export type LanguagePosition = {
  line: number;
  col: number;
};

/**
 * Language range, including start and end.
 */
export type LanguageRange = {
  start: LanguagePosition;
  end: LanguagePosition;
};

/**
 * Language location, including uri and range.
 */
export type LanguageLocation = {
  uri: string;
  range: LanguageRange;
};

/**
 * Language completion item, including display label, additional detail, documentation, insert
 * text, and snippet.
 */
export type LanguageCompletionItem = {
  label: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
  snippet?: boolean;
  sortText?: string;
  kind:
    | 'keyword'
    | 'function'
    | 'variable'
    | 'class'
    | 'field'
    | 'reference'
    | 'text';
};

/**
 * Language hover, including range and contents.
 */
export type LanguageHover = {
  range: LanguageRange;
  contents: string[];
};

/**
 * Language geometry link, including operation kind, range, entity ids, and topology ids.
 */
export type LanguageGeometryLink = {
  kind: InteractionSourceLinkKind;
  range: LanguageRange;
  entityIds: readonly string[];
  topologyIds: readonly string[];
};

/**
 * Language symbol, including name, operation kind, additional detail, display value, and uri.
 */
export type LanguageSymbol = {
  name: string;
  kind:
    | 'var'
    | 'env'
    | 'font'
    | 'sketch'
    | 'obj'
    | 'part'
    | 'ref'
    | 'fn'
    | 'plane'
    | 'anchor';
  detail: string;
  documentation?: string;
  value?: string;
  uri: string;
  range: LanguageRange;
};

/**
 * Semantic token, including source line, source column, length, and value kind.
 */
export type SemanticToken = {
  line: number;
  col: number;
  length: number;
  type: 'keyword' | 'function' | 'variable' | 'property' | 'type';
};

/**
 * Input for language workspace, including workspace root, file map, asset map, env, and
 * workspace index.
 */
export type LanguageWorkspaceInput = {
  rootPath?: string | null;
  fileMap?: Record<string, string>;
  assetMap?: Record<string, Uint8Array>;
  env?: RawEnvOverrides;
  workspaceIndex?: WorkspaceIndex;
  interaction?: InteractionSnapshot | null;
};

/**
 * I language server, including start, stop, update workspace, update document, and close
 * document.
 */
export interface ILanguageServer {
  start(): Promise<void>;
  stop(): Promise<void>;

  updateWorkspace(input: LanguageWorkspaceInput): void;
  updateDocument(uri: string, content: string): void;
  closeDocument(uri: string): void;

  getDiagnostics(uri: string): Promise<CompileError[]>;
  getCompletions(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageCompletionItem[]>;
  getHover(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageHover | null>;
  getDefinition(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageLocation | null>;
  getWorkspaceSymbols(query?: string): Promise<LanguageSymbol[]>;
  getDocumentSymbols(uri: string): Promise<LanguageSymbol[]>;
  getReferences(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageLocation[]>;
  getSemanticTokens(uri: string): Promise<SemanticToken[]>;
  getGeometryLink(
    uri: string,
    position: LanguagePosition,
  ): Promise<LanguageGeometryLink | null>;
}
