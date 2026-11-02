/**
 * @author Aidan Boissonneault
 * @file nodeTypes.ts
 * @purpose Provides node types behavior for the platform node in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  IRProgram,
  InteractionSnapshot,
  MeshData,
  OcctTraceEvent,
  ValidationResult,
  DrawingResult,
  ResolvedJointData,
} from '@bushscad/ir';
import type { EnvManifestEntry, RawEnvOverrides } from '../../types/types.js';

/**
 * Lookup from string keys to string values.
 */
export type FileOverlayMap = Record<string, string>;
/**
 * Accepted values for compile entrypoint mode are 'workspace' and 'requested-file'.
 */
export type CompileEntrypointMode = 'workspace' | 'requested-file';

/**
 * Options for compile file, including source file path, workspace root, entrypoint mode, source
 * overlays, and env.
 */
export type CompileFileOptions = {
  filePath: string;
  rootPath?: string | null;
  /** Selects the manifest entrypoint or compiles filePath itself. */
  entrypointMode?: CompileEntrypointMode;
  overlays?: FileOverlayMap;
  env?: RawEnvOverrides;
  cursorOpIndex?: number;
  /** Op indices excluded from the geometry build (timeline suppression). */
  suppressedOpIndices?: number[];
  /** Enables opt-in OCCT operation trace collection for preview builds. */
  occtTrace?: boolean;
  /** Streams OCCT trace events as soon as the bridge emits them. */
  onOcctTraceEvent?: (event: OcctTraceEvent) => void;
};

/**
 * Result of preview is tagged by ok: 'true' carries program, drawings, meshes and 'false'
 * carries errors.
 */
export type PreviewResult =
  | {
      ok: true;
      program: IRProgram;
      drawings: DrawingResult[];
      meshes: MeshData[];
      interaction: InteractionSnapshot;
      validations: ValidationResult[];
      joints: ResolvedJointData[];
      env: EnvManifestEntry[];
      dependents: Record<string, string[]>;
      occtTraceEvents?: OcctTraceEvent[];
      elapsedMs: number;
    }
  | {
      ok: false;
      errors: CompileError[];
      env: EnvManifestEntry[];
      occtTraceEvents?: OcctTraceEvent[];
      elapsedMs: number;
    };

/**
 * Result of export file is tagged by ok: 'true' carries program, buffers, drawings and 'false'
 * carries errors.
 */
export type ExportFileResult =
  | {
      ok: true;
      program: IRProgram;
      buffers: { name: string; data: ArrayBuffer }[];
      drawings: DrawingResult[];
      env: EnvManifestEntry[];
      elapsedMs: number;
    }
  | {
      ok: false;
      errors: CompileError[];
      env: EnvManifestEntry[];
      elapsedMs: number;
    };
