/** Public facade for building, preparing, and exporting OCCT-backed models. */

export {
  OCCT_FALLBACK_FONT_PATH,
  OCCT_FALLBACK_SERIF_FONT_PATH,
  OCCT_FALLBACK_MONO_FONT_PATH,
} from './occt-bridge-base.js';
export type { OcctBuildOptions } from './occt-bridge-base.js';
export type {
  BuildResult,
  ExportResult,
  PrepareComponentResult,
} from './bridge-types.js';

import { OcctBridgeImplementation } from './occt-bridge-implementation.js';
import type {
  CompileAssets,
  DrawingProgram,
  ExportFormat,
  IRProgram,
} from '@bushscad/ir';
import type {
  OC,
  BuildResult,
  ExportResult,
  PrepareComponentResult,
} from './bridge-types.js';
import type { OcctBuildOptions } from './occt-bridge-base.js';

export class OcctBridge {
  private readonly implementation: OcctBridgeImplementation;

  private constructor(oc: OC) {
    this.implementation = new OcctBridgeImplementation(oc);
  }

  /**
   * Creates a bridge around an initialized OpenCascade runtime supplied by the caller.
   */
  static async init(initOc?: () => Promise<OC>): Promise<OcctBridge> {
    if (!initOc) {
      throw new Error(
        'OcctBridge.init requires an OpenCascade initializer in this build',
      );
    }

    const oc = await initOc();
    return new OcctBridge(oc);
  }

  /** Builds a complete IR program and releases native shapes after extraction. */
  build(
    program: IRProgram,
    assets: CompileAssets = { fonts: [], shapes: [] },
    drawingProgram?: DrawingProgram,
    options: OcctBuildOptions = {},
  ): BuildResult {
    return this.implementation.build(program, assets, drawingProgram, options);
  }

  /** Builds one self-contained positive component and returns native BRep. */
  prepareComponent(
    program: IRProgram,
    name: string,
    semanticConsumerIds: readonly string[],
    assets: CompileAssets = { fonts: [], shapes: [] },
  ): PrepareComponentResult {
    return this.implementation.prepareComponent(
      program,
      name,
      semanticConsumerIds,
      assets,
    );
  }

  /** Builds the program and writes the requested geometry and drawing exports. */
  export(
    program: IRProgram,
    format: ExportFormat,
    assets: CompileAssets = { fonts: [], shapes: [] },
    drawingProgram?: DrawingProgram,
    options: Pick<
      OcctBuildOptions,
      'nativeBooleanPlan' | 'nativeBooleanConcurrencyLimit'
    > = {},
  ): ExportResult {
    return this.implementation.export(
      program,
      format,
      assets,
      drawingProgram,
      options,
    );
  }
}
