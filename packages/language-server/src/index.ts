/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for language server package.
 * @last-edited October 6, 2026
 */

export type {
  ILanguageServer,
  LanguageCompletionItem,
  LanguageGeometryLink,
  LanguageHover,
  LanguageLocation,
  LanguagePosition,
  LanguageRange,
  LanguageSymbol,
  LanguageWorkspaceInput,
  SemanticToken,
} from './protocol/ILanguageServer.js';
export { BushScadLanguageServer } from './protocol/BushScadLanguageServer.js';
export { offsetAt } from './language/textPositions.js';
export {
  isRectanglePlantSideContext,
  rectanglePlantSideCompletionItems,
} from './providers/rectanglePlantCompletions.js';
export { sketchBodyCompletionItems } from './providers/sketchBodyCompletions.js';
export {
  completionContextAt,
  completionSpecs,
  type CompletionContext,
  type LanguageCompletionSpec,
} from './providers/completion-specs.js';
export {
  contrastTextForColor,
  findHexColorLiterals,
  formatHexColor,
  parseHexColorLiteral,
  type HexColorLiteral,
  type RgbaColor,
} from './providers/colors.js';
export {
  BUSHSCAD_BOOLEANS,
  BUSHSCAD_BUILTINS,
  BUSHSCAD_KEYWORDS,
  BUSHSCAD_SURFACE_REFS,
  BUSHSCAD_UNITS,
  BUSHSCAD_WORKPLANES,
} from './language/syntaxFacts.js';
export { HOVER_DOCS as BUSHSCAD_HOVER_DOCS } from './language/languageFacts.js';
export {
  BUSHSCAD_HELPER_SNIPPETS,
  BUSHSCAD_PRIMITIVE_SNIPPETS,
} from './snippets/primitiveHelperSnippets.js';
export { BUSHSCAD_SKETCH_SNIPPETS } from './snippets/sketchSnippets.js';
export { BUSHSCAD_STATEMENT_COMPLETION_SPECS } from './snippets/statementCompletionSpecs.js';
export { BUSHSCAD_TOP_LEVEL_SNIPPETS } from './snippets/topLevelSnippets.js';
export { BUSHSCAD_VALIDATION_SNIPPETS } from './snippets/validationSnippets.js';
export * from './sketch-preview/sketchPathSourceFields.js';
export * from './sketch-preview/sketchPreview.js';
export * from './sketch-preview/sketchPreviewDetail.js';
export * from './sketch-preview/sketchPreviewDetails.js';
export * from './sketch-preview/sketchPreviewDimensionDetails.js';
export * from './sketch-preview/sketchPreviewEditability.js';
export * from './sketch-preview/sketchPreviewEvaluation.js';
export * from './sketch-preview/sketchPreviewTarget.js';
export * from './sketch-preview/sketchSourceEntities.js';
export * from './sketch-preview/sketchSourceFields.js';
export * from './sketch-preview/sketchSourceMetadata.js';
export * from './sketch-preview/sketchSourceRange.js';
export * from './sketch-preview/sketchSourceText.js';
export {
  BUSHSCAD_LSP_METHODS,
  parseLanguageLocation,
  parseVersionedDocumentRequest,
  parseVersionedActiveSketchResponse,
  parseVersionedGeometryLinkResponse,
  parseVersionedInteractionUpdate,
  parseVersionedPositionRequest,
  parseVersionedSketchResponse,
  parseVersionedSourceEdits,
  type SourceTextEdit,
  type VersionedActiveSketchResponse,
  type VersionedDocumentRequest,
  type VersionedGeometryLinkResponse,
  type VersionedInteractionUpdate,
  type VersionedPositionRequest,
  type VersionedSketchResponse,
  type VersionedSourceEdits,
} from './platform/lsp/custom-protocol.js';
export { languageHover, languageHelp } from './language/help/catalog.js';
export type { LanguageHelpEntry } from './language/help/types.js';
export { hoverWordAtPosition } from './language/help/hover-word.js';
export {
  functionDetailsForSource,
  type FunctionSourceDetails,
} from './providers/functionDetails.js';
