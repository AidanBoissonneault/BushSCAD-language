/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the dto in cli package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  DrawingResult,
  ExportFormat,
  IRProgram,
  InteractionSnapshot,
  MaterialAppearance,
  OcctTraceEvent,
  ResolvedJointData,
  ValidationResult,
} from '@bushscad/ir';
import type { EnvManifestEntry } from '@bushscad/compiler';
import type { CacheBreakpoint } from '@bushscad/compiler';
import type { CompileEntrypointMode, FileOverlayMap } from '@bushscad/compiler/node';

/**
 * Mesh dto, including part name, body name, color, uses default color, and material.
 */
export type MeshDto = {
  partName: string;
  bodyName?: string;
  color: string;
  usesDefaultColor?: boolean;
  material?: MaterialAppearance;
  vertices: number[];
  normals: number[];
  indices: number[];
  isHardwareVisual?: boolean;
  hardwareKind?: 'bolt' | 'insert';
};

/**
 * Buffer dto, including name and encoded geometry data.
 */
export type BufferDto = {
  name: string;
  dataBase64: string;
};

/**
 * Accepted values for compiler engine are 'classic' and 'parallel'.
 */
export type CompilerEngine = 'classic' | 'parallel';
/**
 * Accepted values for drawing output mode are 'write-source-paths' and 'return-content'.
 */
export type DrawingOutputMode = 'write-source-paths' | 'return-content';

/**
 * Measurements for compiler, including engine, fallback reason, worker count, ready worker
 * count, and IR compilation time.
 */
export type CompilerMetrics = {
  engine: CompilerEngine;
  fallbackReason?: string;
  workerCount: number;
  readyWorkerCount: number;
  compileIrMs: number;
  geometryMs: number;
  assemblyMs: number;
  workerStartupMs: number;
  reusedWarmWorkers: boolean;
  schedulerTaskCount?: number;
  workerBusyMs?: number;
  workerCpuMs?: number;
  queueWaitMs?: number;
  transportMs?: number;
  workerUtilization?: number;
  longestWorkerTaskMs?: number;
  aggregateWorkerRssBytes?: number;
  peakWorkerRssBytes?: number;
  componentPreparationMs?: number;
  componentReductionMs?: number;
  preparedComponentCount?: number;
  componentRecipeCount?: number;
  componentCacheHitCount?: number;
  persistentComponentCacheHitCount?: number;
  persistentCompletedBuildCacheHitCount?: number;
  nativeBooleanBatchCount?: number;
  nativeBooleanAvoidedBuildCount?: number;
  nativeBooleanRejectionCount?: number;
};

/**
 * Accepted values for compiler request kind are 'check', 'preview', 'export', and
 * 'exportDrawings'.
 */
export type CompilerRequestKind =
  'check' | 'preview' | 'export' | 'exportDrawings';

/**
 * Request to compiler, including operation kind, source file path, workspace root, entrypoint
 * mode, and source overlays.
 */
export type CompilerRequest = {
  kind: CompilerRequestKind;
  filePath: string;
  rootPath?: string | null;
  entrypointMode?: CompileEntrypointMode;
  overlays?: FileOverlayMap;
  env?: Record<string, string>;
  format?: ExportFormat;
  cursorOpIndex?: number;
  suppressedOpIndices?: number[];
  occtTrace?: boolean;
  engine?: CompilerEngine;
  drawingOutputMode?: DrawingOutputMode;
  componentCacheDirectory?: string;
  automaticallyAssignCacheBreakpoints?: boolean;
  cacheBreakpoints?: readonly CacheBreakpoint[];
};

/**
 * Derives `ServiceRequest` from `CompilerRequest & { id: number }` to preserve its type relationship
 * in the dto layer.
 */
export type ServiceRequest = CompilerRequest & { id: number };

/**
 * Written drawing dto, including name, path, and export format.
 */
type WrittenDrawingDto = { name: string; path: string; format: string };

/**
 * Response from service is tagged by ok: 'true' carries program, meshes, interaction and 'false'
 * carries errors.
 */
export type ServiceResponse =
  | {
      id: number;
      kind: ServiceRequest['kind'];
      ok: true;
      program?: IRProgram;
      meshes?: MeshDto[];
      interaction?: InteractionSnapshot;
      drawings?: DrawingResult[];
      buffers?: BufferDto[];
      validations?: ValidationResult[];
      joints?: ResolvedJointData[];
      writtenDrawings?: WrittenDrawingDto[];
      occtTraceEvents?: OcctTraceEvent[];
      env: EnvManifestEntry[];
      dependents?: Record<string, string[]>;
      elapsedMs: number;
      compilerMetrics?: CompilerMetrics;
    }
  | {
      id: number;
      kind: ServiceRequest['kind'];
      ok: false;
      errors: CompileError[];
      occtTraceEvents?: OcctTraceEvent[];
      env: EnvManifestEntry[];
      elapsedMs: number;
      compilerMetrics?: CompilerMetrics;
    };

/**
 * Message for service trace, including identifier, operation kind, and event.
 */
export type ServiceTraceMessage = {
  id: number;
  kind: 'occt-trace';
  event: OcctTraceEvent;
};

/**
 * Message for service pool, including operation kind and status.
 */
export type ServicePoolMessage = {
  kind: 'pool-status';
  status: CompilerPoolStatus;
};

/**
 * status of compiler pool represented by
 * import('../service/parallel/worker-protocol.js').ParallelPoolStatus.
 */
export type CompilerPoolStatus =
  import('../service/parallel/worker-protocol.js').ParallelPoolStatus;

/**
 * Message for service accepts ServiceResponse, ServiceTraceMessage, and ServicePoolMessage.
 */
export type ServiceMessage =
  ServiceResponse | ServiceTraceMessage | ServicePoolMessage;
