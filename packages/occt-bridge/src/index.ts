/**
 * Public API for the OpenCascade geometry bridge.
 *
 * Build, query, validation, and export implementation lives in the bridge's
 * purpose modules; package consumers import the stable facade from this barrel.
 */
export {
  OCCT_FALLBACK_FONT_PATH,
  OCCT_FALLBACK_MONO_FONT_PATH,
  OCCT_FALLBACK_SERIF_FONT_PATH,
  OcctBridge,
} from './bridge/occt-bridge.js';
export type {
  BuildResult,
  ExportResult,
  OcctBuildOptions,
  PrepareComponentResult,
} from './bridge/occt-bridge.js';
