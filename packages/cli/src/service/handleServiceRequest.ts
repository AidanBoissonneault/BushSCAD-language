/**
 * @author Aidan Boissonneault
 * @file handleServiceRequest.ts
 * @purpose Provides handle service request behavior for the service in cli package.
 * @last-edited October 6, 2026
 */

import {
  compileFileToIr,
  exportFile,
  previewFile,
  type CompileFileOptions,
} from '@bushscad/compiler/node';

import { meshToDto } from '../dto/meshDto.js';
import { bufferToDto } from '../dto/bufferDto.js';
import { writeDrawingFiles } from '../cli/writeDrawingFiles.js';
import type {
  CompilerMetrics,
  ServiceRequest,
  ServiceResponse,
} from '../dto/types.js';
import type { OcctTraceEvent } from '@bushscad/ir';
import type { PreviewResult } from '@bushscad/compiler/node';
import type { ExportFormat } from '@bushscad/ir';
import type { PoolExportOutcome } from './parallel/pool-export.js';

/**
 * Service request callbacks, including on occt trace event, preview, and export.
 */
export type ServiceRequestCallbacks = {
  onOcctTraceEvent?: (event: OcctTraceEvent) => void;
  preview?: (
    options: CompileFileOptions,
  ) => Promise<{ result: PreviewResult; metrics?: CompilerMetrics }>;
  export?: (
    options: CompileFileOptions & { format: ExportFormat },
  ) => Promise<PoolExportOutcome>;
};

/**
 * Routes a validated service request to IR compilation, preview meshing, drawing
 * output, or solid export and converts the result to the transport DTO.
 */
export async function handleServiceRequest(
  request: ServiceRequest,
  callbacks: ServiceRequestCallbacks = {},
): Promise<ServiceResponse> {
  const options = serviceCompileOptions(request, callbacks);

  switch (request.kind) {
    case 'check':
      return handleCheckRequest(request, options);
    case 'preview':
      return handlePreviewRequest(request, options, callbacks);
    case 'exportDrawings':
      return handleExportDrawingsRequest(request, options, callbacks);
    case 'export':
      return handleExportRequest(request, options, callbacks);
  }
}

/**
 * Handles service compile options in the service flow.
 */
function serviceCompileOptions(
  request: ServiceRequest,
  callbacks: ServiceRequestCallbacks,
): CompileFileOptions {
  return {
    filePath: request.filePath,
    rootPath: request.rootPath,
    entrypointMode: request.entrypointMode,
    overlays: request.overlays,
    env: request.env,
    automaticallyAssignCacheBreakpoints:
      request.automaticallyAssignCacheBreakpoints,
    cacheBreakpoints: request.cacheBreakpoints,
    cursorOpIndex: request.cursorOpIndex,
    suppressedOpIndices: request.suppressedOpIndices,
    occtTrace: request.occtTrace,
    onOcctTraceEvent: callbacks.onOcctTraceEvent,
  };
}

/**
 * Handles check request in the current service flow.
 */
function handleCheckRequest(
  request: ServiceRequest,
  options: CompileFileOptions,
): ServiceResponse {
  const result = compileFileToIr(options);
  if (!result.ok) {
    return { ...result, id: request.id, kind: request.kind, ok: false };
  }
  return {
    id: request.id,
    kind: request.kind,
    ok: true,
    program: result.program,
    env: result.env,
    dependents: result.workspace.dependents,
    elapsedMs: result.elapsedMs,
  };
}

/**
 * Handles preview request in the current service flow.
 */
async function handlePreviewRequest(
  request: ServiceRequest,
  options: CompileFileOptions,
  callbacks?: ServiceRequestCallbacks,
): Promise<ServiceResponse> {
  const preview = callbacks?.preview
    ? await callbacks.preview(options)
    : { result: await previewFile(options) };
  const { result } = preview;
  return result.ok
    ? {
        ...result,
        id: request.id,
        kind: request.kind,
        meshes: result.meshes.map(meshToDto),
        drawings: result.drawings,
        validations: result.validations,
        joints: result.joints,
        ...(result.occtTraceEvents
          ? { occtTraceEvents: result.occtTraceEvents }
          : {}),
        ...(preview.metrics ? { compilerMetrics: preview.metrics } : {}),
        ok: true,
      }
    : {
        ...result,
        id: request.id,
        kind: request.kind,
        ...(preview.metrics ? { compilerMetrics: preview.metrics } : {}),
        ok: false,
      };
}

/**
 * Handles export drawings request in the current service flow.
 */
async function handleExportDrawingsRequest(
  request: ServiceRequest,
  options: CompileFileOptions,
  callbacks?: ServiceRequestCallbacks,
): Promise<ServiceResponse> {
  const result = callbacks?.preview
    ? (await callbacks.preview(options)).result
    : await previewFile(options);
  if (!result.ok)
    return { ...result, id: request.id, kind: request.kind, ok: false };
  const returnContent = request.drawingOutputMode === 'return-content';
  const writtenDrawings = returnContent
    ? []
    : writeDrawingFiles(result.drawings ?? [], request.filePath);
  return {
    id: request.id,
    kind: request.kind,
    ok: true,
    program: result.program,
    env: result.env,
    dependents: result.dependents,
    writtenDrawings,
    ...(returnContent ? { drawings: result.drawings ?? [] } : {}),
    elapsedMs: result.elapsedMs,
  };
}

/**
 * Handles export request in the current service flow.
 */
async function handleExportRequest(
  request: ServiceRequest,
  options: CompileFileOptions,
  callbacks?: ServiceRequestCallbacks,
): Promise<ServiceResponse> {
  const exportOptions = {
    ...options,
    format: request.format ?? 'step',
  };
  const exported = callbacks?.export
    ? await callbacks.export(exportOptions)
    : { result: await exportFile(exportOptions) };
  const { result } = exported;
  const metrics = 'metrics' in exported ? exported.metrics : undefined;

  if (!result.ok)
    return {
      ...result,
      id: request.id,
      kind: request.kind,
      ...(metrics ? { compilerMetrics: metrics } : {}),
      ok: false,
    };

  const writtenDrawings = writeDrawingFiles(result.drawings, request.filePath);
  return {
    ...result,
    id: request.id,
    kind: request.kind,
    buffers: result.buffers.map(bufferToDto),
    writtenDrawings,
    ...(metrics ? { compilerMetrics: metrics } : {}),
    ok: true,
  };
}
