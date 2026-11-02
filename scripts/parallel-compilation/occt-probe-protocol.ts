/**
 * @author Aidan Boissonneault
 * @file occt-probe-protocol.ts
 * @purpose Defines the command, response, and report types shared by the OCCT probe runner and worker.
 * @last-edited October 6, 2026
 */

/**
 * Selects how the OCCT probe runs: in a worker thread or a separate process.
 */

export type ProbeMode = 'thread' | 'process';

/**
 * Commands sent from the probe runner to a worker: build, export, and import test geometry,
 * inspect memory, or shut down. Each command has a request ID; import commands also carry
 * encoded input data.
 */
export type ProbeCommand =
  | { kind: 'build-cuboid'; requestId: number }
  | { kind: 'export-cuboid'; requestId: number }
  | { kind: 'import-step'; requestId: number; dataBase64: string }
  | { kind: 'export-brep'; requestId: number }
  | { kind: 'import-brep'; requestId: number; dataBase64: string }
  | { kind: 'memory'; requestId: number }
  | { kind: 'shutdown'; requestId: number };

/**
 * Compact geometry measurements containing mesh and triangle counts plus the combined bounds.
 */
export type GeometrySummary = {
  meshCount: number;
  triangleCount: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
};

/**
 * Responses from the OCCT probe worker: readiness details, a measured request result with
 * optional geometry or transfer data, or a request-scoped error.
 */
export type ProbeMessage =
  | {
      kind: 'ready';
      workerId: number;
      initializationMs: number;
      rssBytes: number;
      heapUsedBytes: number;
      serializationApis: string[];
    }
  | {
      kind: 'result';
      requestId: number;
      elapsedMs: number;
      rssBytes: number;
      heapUsedBytes: number;
      geometry?: GeometrySummary;
      dataBase64?: string;
    }
  | { kind: 'error'; requestId?: number; message: string };

/**
 * Measurements collected during an OCCT probe run, including worker readiness, cold and warm
 * builds, idle memory before and after, and STEP/BREP transfers.
 */
export type ProbeReport = {
  generatedAt: string;
  mode: ProbeMode;
  workerCount: number;
  idleMs: number;
  wallInitializationMs: number;
  ready: Extract<ProbeMessage, { kind: 'ready' }>[];
  firstBuilds: Extract<ProbeMessage, { kind: 'result' }>[];
  warmBuilds: Extract<ProbeMessage, { kind: 'result' }>[];
  beforeIdle: Extract<ProbeMessage, { kind: 'result' }>[];
  afterIdle: Extract<ProbeMessage, { kind: 'result' }>[];
  transfer: {
    exportResult: Extract<ProbeMessage, { kind: 'result' }>;
    importResult: Extract<ProbeMessage, { kind: 'result' }>;
    stepBytes: number;
  };
  nativeBrepTransfer: {
    exportResult: Extract<ProbeMessage, { kind: 'result' }>;
    importResult: Extract<ProbeMessage, { kind: 'result' }>;
    brepBytes: number;
  };
};
