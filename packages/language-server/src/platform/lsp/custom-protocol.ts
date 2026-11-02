/**
 * @author Aidan Boissonneault
 * @file custom-protocol.ts
 * @purpose Provides custom protocol behavior for the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import type { InteractionSnapshot, SketchPreviewModel } from '@bushscad/ir';
import type {
  LanguageGeometryLink,
  LanguageLocation,
  LanguagePosition,
  LanguageRange,
} from '../../protocol/ILanguageServer.js';

export const BUSHSCAD_LSP_METHODS = Object.freeze({
  updateInteraction: 'bushscad/interaction/update',
  geometryLink: 'bushscad/interaction/link',
  sketches: 'bushscad/sketch/list',
  activeSketch: 'bushscad/sketch/active',
  applySourceEdits: 'bushscad/source/applyEdits',
});

/**
 * Request to versioned document, including uri and version.
 */
export type VersionedDocumentRequest = {
  uri: string;
  version: number;
};

/**
 * Derives `VersionedPositionRequest` from `VersionedDocumentRequest & { position: LanguagePosition; }`
 * to preserve its type relationship in the platform lsp layer.
 */
export type VersionedPositionRequest = VersionedDocumentRequest & {
  position: LanguagePosition;
};

/**
 * Versioned interaction update, including uri, document versions, and interaction.
 */
export type VersionedInteractionUpdate = {
  uri: string;
  documentVersions: Record<string, number>;
  interaction: InteractionSnapshot;
};

/**
 * Response from versioned sketch, including uri, version, and sketches.
 */
export type VersionedSketchResponse = {
  uri: string;
  version: number;
  sketches: SketchPreviewModel[];
};

/**
 * Response from versioned active sketch, including uri, version, and sketch.
 */
export type VersionedActiveSketchResponse = {
  uri: string;
  version: number;
  sketch: SketchPreviewModel | null;
};

/**
 * Response from versioned geometry link, including uri, version, and link.
 */
export type VersionedGeometryLinkResponse = {
  uri: string;
  version: number;
  link: LanguageGeometryLink | null;
};

/**
 * Source text edit, including range and new text.
 */
export type SourceTextEdit = {
  range: LanguageRange;
  newText: string;
};

/**
 * Versioned source edits, including documents.
 */
export type VersionedSourceEdits = {
  documents: Array<{
    uri: string;
    version: number;
    edits: SourceTextEdit[];
  }>;
};

/**
 * Handles record in the platform lsp flow.
 */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a protocol object.');
  }
  return value as Record<string, unknown>;
}

/**
 * Handles string field in the platform lsp flow.
 */
function stringField(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`${name} must be a non-empty string.`);
  return value;
}

/**
 * Handles text field in the platform lsp flow.
 */
function textField(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`);
  return value;
}

/**
 * Handles version field in the platform lsp flow.
 */
function versionField(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(`${name} must be a non-negative integer.`);
  return value as number;
}

/**
 * Handles position in the platform lsp flow.
 */
function position(value: unknown, name: string): LanguagePosition {
  const input = record(value);
  const result = {
    line: versionField(input.line, `${name}.line`),
    col: versionField(input.col, `${name}.col`),
  };
  if (result.line === 0 || result.col === 0)
    throw new Error(`${name} must use one-based line and column values.`);
  return result;
}

/**
 * Handles range in the platform lsp flow.
 */
function range(value: unknown, name: string): LanguageRange {
  const input = record(value);
  return {
    start: position(input.start, `${name}.start`),
    end: position(input.end, `${name}.end`),
  };
}

/** Validates a source location before a host performs native navigation. */
export function parseLanguageLocation(value: unknown): LanguageLocation {
  const input = record(value);
  return {
    uri: stringField(input.uri, 'uri'),
    range: range(input.range, 'range'),
  };
}

/** Validates a custom document request before it reaches language analysis. */
export function parseVersionedDocumentRequest(
  value: unknown,
): VersionedDocumentRequest {
  const input = record(value);
  return {
    uri: stringField(input.uri, 'uri'),
    version: versionField(input.version, 'version'),
  };
}

/** Validates custom position requests, whose positions use core one-based coordinates. */
export function parseVersionedPositionRequest(
  value: unknown,
): VersionedPositionRequest {
  const input = record(value);
  return {
    ...parseVersionedDocumentRequest(input),
    position: position(input.position, 'position'),
  };
}

/** Validates a compiler-produced interaction snapshot and its source versions. */
export function parseVersionedInteractionUpdate(
  value: unknown,
): VersionedInteractionUpdate {
  const input = record(value);
  const uri = stringField(input.uri, 'uri');
  const versions = record(input.documentVersions);
  const interaction = record(input.interaction);
  if (
    interaction.version !== 1 ||
    !Array.isArray(interaction.entities) ||
    !Array.isArray(interaction.effects) ||
    !Array.isArray(interaction.references) ||
    !Array.isArray(interaction.topology)
  )
    throw new Error('interaction must be a version 1 InteractionSnapshot.');
  stringField(interaction.entrypoint, 'interaction.entrypoint');
  const documentVersions = Object.fromEntries(
    Object.entries(versions).map(([documentUri, version]) => [
      stringField(documentUri, 'documentVersions uri'),
      versionField(version, `documentVersions.${documentUri}`),
    ]),
  );
  if (documentVersions[uri] === undefined)
    throw new Error('documentVersions must include the request uri.');
  return {
    uri,
    documentVersions,
    interaction: input.interaction as InteractionSnapshot,
  };
}

/** Validates generated source edits before VS Code applies them atomically. */
export function parseVersionedSourceEdits(
  value: unknown,
): VersionedSourceEdits {
  const input = record(value);
  if (!Array.isArray(input.documents))
    throw new Error('documents must be an array.');
  return {
    documents: input.documents.map((documentValue, documentIndex) => {
      const document = record(documentValue);
      if (!Array.isArray(document.edits))
        throw new Error(`documents[${documentIndex}].edits must be an array.`);
      return {
        uri: stringField(document.uri, `documents[${documentIndex}].uri`),
        version: versionField(
          document.version,
          `documents[${documentIndex}].version`,
        ),
        edits: document.edits.map((editValue, editIndex) => {
          const edit = record(editValue);
          const editRange = range(
            edit.range,
            `documents[${documentIndex}].edits[${editIndex}].range`,
          );
          return {
            range: editRange,
            newText: textField(
              edit.newText,
              `documents[${documentIndex}].edits[${editIndex}].newText`,
            ),
          };
        }),
      };
    }),
  };
}

/** Validates a versioned geometry-link response received by a host adapter. */
export function parseVersionedGeometryLinkResponse(
  value: unknown,
): VersionedGeometryLinkResponse {
  const input = record(value);
  if (input.link !== null) record(input.link);
  return {
    ...parseVersionedDocumentRequest(input),
    link: input.link as LanguageGeometryLink | null,
  };
}

/** Validates a versioned sketch-list envelope while retaining the shared DTOs. */
export function parseVersionedSketchResponse(
  value: unknown,
): VersionedSketchResponse {
  const input = record(value);
  if (!Array.isArray(input.sketches))
    throw new Error('sketches must be an array.');
  return {
    ...parseVersionedDocumentRequest(input),
    sketches: input.sketches as SketchPreviewModel[],
  };
}

/** Validates a versioned active-sketch envelope. */
export function parseVersionedActiveSketchResponse(
  value: unknown,
): VersionedActiveSketchResponse {
  const input = record(value);
  if (input.sketch !== null) record(input.sketch);
  return {
    ...parseVersionedDocumentRequest(input),
    sketch: input.sketch as SketchPreviewModel | null,
  };
}
