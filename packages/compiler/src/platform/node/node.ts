/**
 * @author Aidan Boissonneault
 * @file node.ts
 * @purpose Provides node behavior for the platform node in compiler package.
 * @last-edited October 6, 2026
 */

export { compileFileToIr } from '../../pipeline/compileFileToIr.js';
export { exportFile } from '../../exports/exportFile.js';
export { previewFile } from '../../pipeline/previewFile.js';
export { selectBuildOps } from '../../pipeline/previewFile.js';
export { writeExportBuffers } from '../../exports/writeExportBuffers.js';
export { getBridge } from './nodeOcct.js';
export type {
  CompileEntrypointMode,
  CompileFileOptions,
  ExportFileResult,
  FileOverlayMap,
  PreviewResult,
} from './nodeTypes.js';
