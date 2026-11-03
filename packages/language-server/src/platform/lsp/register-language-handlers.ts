/**
 * @author Aidan Boissonneault
 * @file register-language-handlers.ts
 * @purpose Registers language handlers for the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import {
  Color,
  ColorInformation,
  ColorPresentation,
  SemanticTokensBuilder,
  TextEdit,
  type CancellationToken,
  type Connection,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  findActiveSketchPreview,
  findSketchPreviews,
} from '../../sketch-preview/sketchPreview.js';
import {
  findHexColorLiterals,
  formatHexColor,
} from '../../providers/colors.js';
import {
  BUSHSCAD_LSP_METHODS,
  parseVersionedDocumentRequest,
  parseVersionedInteractionUpdate,
  parseVersionedPositionRequest,
} from './custom-protocol.js';
import {
  fromLspPosition,
  toDocumentSymbol,
  toLspCompletion,
  toLspHover,
  toLspLocation,
  toWorkspaceSymbol,
} from './conversions.js';
import { pathFromUri } from '../../language/uri.js';
import type { WorkspaceLanguageServices } from './workspace-services.js';
import { handleGeometryLinkRequest } from './geometry-link-request.js';

const TOKEN_TYPES = ['keyword', 'function', 'variable', 'property', 'type'];

/** Registers standard LSP features over the existing editor-neutral service. */
export function registerLanguageHandlers(
  connection: Connection,
  workspaces: WorkspaceLanguageServices,
): void {
  connection.onCompletion(async (params, token) => {
    if (token.isCancellationRequested) return [];
    const items = await workspaces
      .serviceFor(params.textDocument.uri)
      .getCompletions(
        params.textDocument.uri,
        fromLspPosition(params.position),
      );
    return token.isCancellationRequested ? [] : items.map(toLspCompletion);
  });

  connection.onHover(async (params, token) => {
    const hover = await unlessCancelled(token, () =>
      workspaces
        .serviceFor(params.textDocument.uri)
        .getHover(params.textDocument.uri, fromLspPosition(params.position)),
    );
    return hover ? toLspHover(hover) : null;
  });

  connection.onDefinition(async (params, token) => {
    const location = await unlessCancelled(token, () =>
      workspaces
        .serviceFor(params.textDocument.uri)
        .getDefinition(
          params.textDocument.uri,
          fromLspPosition(params.position),
        ),
    );
    return location ? toLspLocation(location) : null;
  });

  connection.onReferences(async (params, token) => {
    const locations = await unlessCancelled(token, () =>
      workspaces
        .serviceFor(params.textDocument.uri)
        .getReferences(
          params.textDocument.uri,
          fromLspPosition(params.position),
        ),
    );
    return locations?.map(toLspLocation) ?? [];
  });

  connection.onDocumentSymbol(async (params, token) => {
    const symbols = await unlessCancelled(token, () =>
      workspaces
        .serviceFor(params.textDocument.uri)
        .getDocumentSymbols(params.textDocument.uri),
    );
    return symbols?.map(toDocumentSymbol) ?? [];
  });

  connection.onWorkspaceSymbol(async (params, token) => {
    const symbols = await unlessCancelled(token, () =>
      workspaces.workspaceSymbols(params.query),
    );
    return symbols?.map(toWorkspaceSymbol) ?? [];
  });

  connection.languages.semanticTokens.on(async (params, token) => {
    const tokens = await unlessCancelled(token, () =>
      workspaces
        .serviceFor(params.textDocument.uri)
        .getSemanticTokens(params.textDocument.uri),
    );
    const builder = new SemanticTokensBuilder();
    for (const semantic of tokens ?? []) {
      builder.push(
        semantic.line - 1,
        semantic.col - 1,
        semantic.length,
        TOKEN_TYPES.indexOf(semantic.type),
        0,
      );
    }
    return builder.build();
  });

  registerColorHandlers(connection, workspaces);
  registerCustomHandlers(connection, workspaces);
}

/**
 * Handles register color handlers in the platform lsp flow.
 */
function registerColorHandlers(
  connection: Connection,
  workspaces: WorkspaceLanguageServices,
): void {
  connection.onDocumentColor((params) => {
    const source = workspaces.documentText(params.textDocument.uri);
    const document = TextDocument.create(
      params.textDocument.uri,
      'bushscad',
      workspaces.documentVersion(params.textDocument.uri) ?? 0,
      source,
    );
    return findHexColorLiterals(source).map((literal) =>
      ColorInformation.create(
        {
          start: document.positionAt(literal.offset),
          end: document.positionAt(literal.offset + literal.length),
        },
        Color.create(
          literal.color.red / 255,
          literal.color.green / 255,
          literal.color.blue / 255,
          literal.color.alpha,
        ),
      ),
    );
  });

  connection.onColorPresentation((params) => {
    const color = {
      red: params.color.red * 255,
      green: params.color.green * 255,
      blue: params.color.blue * 255,
      alpha: params.color.alpha,
    };
    const label = formatHexColor(color);
    return [
      ColorPresentation.create(label, TextEdit.replace(params.range, label)),
    ];
  });
}

/**
 * Handles register custom handlers in the platform lsp flow.
 */
function registerCustomHandlers(
  connection: Connection,
  workspaces: WorkspaceLanguageServices,
): void {
  connection.onRequest(BUSHSCAD_LSP_METHODS.updateInteraction, (value) => {
    const update = parseVersionedInteractionUpdate(value);
    return workspaces.updateInteraction(
      update.uri,
      update.documentVersions,
      update.interaction,
    );
  });

  connection.onRequest(
    BUSHSCAD_LSP_METHODS.geometryLink,
    (value, token) => handleGeometryLinkRequest(value, token, workspaces),
  );

  connection.onRequest(BUSHSCAD_LSP_METHODS.sketches, (value, token) => {
    const request = parseVersionedDocumentRequest(value);
    if (
      token.isCancellationRequested ||
      !workspaces.isCurrent(request.uri, request.version)
    )
      return null;
    const sketches = findSketchPreviews(
      workspaces.documentText(request.uri),
      pathFromUri(request.uri),
      workspaces.sketchFiles(request.uri),
    );
    if (token.isCancellationRequested) return null;
    return {
      uri: request.uri,
      version: request.version,
      sketches,
    };
  });

  connection.onRequest(BUSHSCAD_LSP_METHODS.activeSketch, (value, token) => {
    const request = parseVersionedPositionRequest(value);
    if (
      token.isCancellationRequested ||
      !workspaces.isCurrent(request.uri, request.version)
    )
      return null;
    const sketch = findActiveSketchPreview(
      workspaces.documentText(request.uri),
      pathFromUri(request.uri),
      request.position.line,
      request.position.col,
      workspaces.sketchFiles(request.uri),
    );
    if (token.isCancellationRequested) return null;
    return {
      uri: request.uri,
      version: request.version,
      sketch,
    };
  });
}

/**
 * Handles unless cancelled in the platform lsp flow.
 */
async function unlessCancelled<T>(
  token: CancellationToken,
  operation: () => Promise<T>,
): Promise<T | null> {
  if (token.isCancellationRequested) return null;
  const result = await operation();
  return token.isCancellationRequested ? null : result;
}

export { TOKEN_TYPES };
