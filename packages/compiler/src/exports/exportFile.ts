import type { ExportFormat } from '@bushscad/ir';
import { compileFileToIr } from '../pipeline/compileFileToIr.js';
import { getBridge } from '../platform/node/nodeOcct.js';
import { compileFailure, toCompileError } from '../platform/node/nodePaths.js';
import type { CompileFileOptions, ExportFileResult } from '../platform/node/nodeTypes.js';

/**
 * Compiles a file and exports the resulting program buffers.
 * Export mode shares compile setup with preview while delegating final format
 * conversion to the OpenCascade bridge.
 */
export async function exportFile(
  options: CompileFileOptions & { format: ExportFormat },
): Promise<ExportFileResult> {
  const t0 = Date.now();
  const compiled = compileFileToIr(options);
  if (!compiled.ok) return compiled;

  try {
    const bridge = await getBridge();
    const result = bridge.export(
      compiled.program,
      options.format,
      compiled.assets,
      compiled.drawings,
    );
    if (!result.ok) {
      return compileFailure([result.error], compiled.env, t0);
    }
    return {
      ok: true,
      program: compiled.program,
      buffers: result.buffers,
      drawings: result.drawings,
      env: compiled.env,
      elapsedMs: Date.now() - t0,
    };
  } catch (error) {
    return compileFailure([toCompileError(error)], compiled.env, t0);
  }
}
