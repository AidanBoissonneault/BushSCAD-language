/**
 * @author Aidan Boissonneault
 * @file conversions.ts
 * @purpose Provides conversions behavior for the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  InsertTextFormat,
  MarkupKind,
  SymbolKind,
  type CompletionItem,
  type Diagnostic,
  type DocumentSymbol,
  type Hover,
  type Location,
  type Position,
  type Range,
  type SymbolInformation,
} from 'vscode-languageserver/node';
import type {
  LanguageCompletionItem,
  LanguageHover,
  LanguageLocation,
  LanguagePosition,
  LanguageRange,
  LanguageSymbol,
} from '../../protocol/ILanguageServer.js';

/**
 * Builds lsp position from the supplied source value.
 */
export function fromLspPosition(position: Position): LanguagePosition {
  return { line: position.line + 1, col: position.character + 1 };
}

/**
 * Converts the supplied value to its lsp position representation.
 */
export function toLspPosition(position: LanguagePosition): Position {
  return {
    line: Math.max(0, position.line - 1),
    character: Math.max(0, position.col - 1),
  };
}

/**
 * Converts the supplied value to its lsp range representation.
 */
export function toLspRange(range: LanguageRange): Range {
  return { start: toLspPosition(range.start), end: toLspPosition(range.end) };
}

/**
 * Converts the supplied value to its lsp location representation.
 */
export function toLspLocation(location: LanguageLocation): Location {
  return { uri: location.uri, range: toLspRange(location.range) };
}

/**
 * Converts the supplied value to its lsp diagnostic representation.
 */
export function toLspDiagnostic(error: CompileError): Diagnostic {
  const line = Math.max(0, error.span.line - 1);
  const character = Math.max(0, error.span.col - 1);
  const endLine = Math.max(line, (error.span.endLine ?? error.span.line) - 1);
  const requestedEndCharacter = Math.max(
    0,
    (error.span.endCol ?? error.span.col + 1) - 1,
  );
  return {
    range: {
      start: { line, character },
      end: {
        line: endLine,
        character:
          endLine === line
            ? Math.max(character + 1, requestedEndCharacter)
            : requestedEndCharacter,
      },
    },
    message: error.message,
    severity: DiagnosticSeverity.Error,
    source: 'BushSCAD',
  };
}

/**
 * Converts the supplied value to its lsp completion representation.
 */
export function toLspCompletion(item: LanguageCompletionItem): CompletionItem {
  return {
    label: item.label,
    kind: completionKind(item.kind),
    ...(item.detail ? { detail: item.detail } : {}),
    ...(item.documentation
      ? {
          documentation: {
            kind: MarkupKind.Markdown,
            value: item.documentation,
          },
        }
      : {}),
    ...(item.insertText ? { insertText: item.insertText } : {}),
    ...(item.snippet ? { insertTextFormat: InsertTextFormat.Snippet } : {}),
    ...(item.sortText ? { sortText: item.sortText } : {}),
  };
}

/**
 * Converts the supplied value to its lsp hover representation.
 */
export function toLspHover(hover: LanguageHover): Hover {
  return {
    range: toLspRange(hover.range),
    contents: {
      kind: MarkupKind.Markdown,
      value: hover.contents.join('\n\n'),
    },
  };
}

/**
 * Converts the supplied value to its document symbol representation.
 */
export function toDocumentSymbol(symbol: LanguageSymbol): DocumentSymbol {
  const range = toLspRange(symbol.range);
  return {
    name: symbol.name,
    detail: symbol.detail,
    kind: symbolKind(symbol.kind),
    range,
    selectionRange: range,
  };
}

/**
 * Converts the supplied value to its workspace symbol representation.
 */
export function toWorkspaceSymbol(symbol: LanguageSymbol): SymbolInformation {
  return {
    name: symbol.name,
    kind: symbolKind(symbol.kind),
    location: { uri: symbol.uri, range: toLspRange(symbol.range) },
    containerName: symbol.detail,
  };
}

/**
 * Handles completion kind in the platform lsp flow.
 */
function completionKind(
  kind: LanguageCompletionItem['kind'],
): CompletionItemKind {
  return {
    keyword: CompletionItemKind.Keyword,
    function: CompletionItemKind.Function,
    variable: CompletionItemKind.Variable,
    class: CompletionItemKind.Class,
    field: CompletionItemKind.Field,
    reference: CompletionItemKind.Reference,
    text: CompletionItemKind.Text,
  }[kind];
}

/**
 * Handles symbol kind in the platform lsp flow.
 */
function symbolKind(kind: LanguageSymbol['kind']): SymbolKind {
  return {
    var: SymbolKind.Variable,
    env: SymbolKind.Constant,
    font: SymbolKind.String,
    sketch: SymbolKind.Struct,
    obj: SymbolKind.Object,
    part: SymbolKind.Class,
    ref: SymbolKind.Class,
    fn: SymbolKind.Function,
    plane: SymbolKind.Field,
    anchor: SymbolKind.Field,
  }[kind];
}
