/**
 * @author Aidan Boissonneault
 * @file message-parser.ts
 * @purpose Provides message parser behavior for the dto in cli package.
 * @last-edited October 6, 2026
 */

import type {
  CompilerPoolStatus,
  ServiceMessage,
  ServicePoolMessage,
  ServiceResponse,
  ServiceTraceMessage,
} from './types.js';

/**
 * Parses one compiler-service stdout line into its canonical message union.
 *
 * Why: hosts must reject malformed or ambiguous child-process output instead
 * of trusting a TypeScript cast across the process boundary.
 */
export function parseServiceMessageLine(line: string): ServiceMessage {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new TypeError('Compiler service emitted invalid JSON.');
  }
  return parseServiceMessage(value);
}

/** Validates the stable envelope and discriminants of a service message. */
export function parseServiceMessage(value: unknown): ServiceMessage {
  const record = objectRecord(value, 'Compiler service message');
  if (record.kind === 'pool-status') return parsePoolMessage(record);
  if (record.kind === 'occt-trace') return parseTraceMessage(record);
  return parseResponse(record);
}

/**
 * Parses response from the supplied source into the dto representation.
 */
function parseResponse(record: Record<string, unknown>): ServiceResponse {
  integer(record.id, 'Compiler response id');
  responseKind(record.kind);
  if (typeof record.ok !== 'boolean')
    throw new TypeError('Compiler response ok must be boolean.');
  if (!Array.isArray(record.env))
    throw new TypeError('Compiler response env must be an array.');
  finiteNumber(record.elapsedMs, 'Compiler response elapsedMs');
  if (!record.ok && !Array.isArray(record.errors)) {
    throw new TypeError('Failed compiler response must include errors.');
  }
  return record as ServiceResponse;
}

/**
 * Parses trace message from the supplied source into the dto representation.
 */
function parseTraceMessage(
  record: Record<string, unknown>,
): ServiceTraceMessage {
  integer(record.id, 'Compiler trace id');
  const event = objectRecord(record.event, 'Compiler trace event');
  stringValue(event.kind, 'Compiler trace event kind');
  finiteNumber(event.timestampMs, 'Compiler trace timestampMs');
  if (event.schemaVersion !== undefined) validateVersionedTrace(event);
  return record as ServiceTraceMessage;
}

/**
 * Validates versioned trace and reports any violations.
 */
function validateVersionedTrace(event: Record<string, unknown>): void {
  if (event.schemaVersion !== 2)
    throw new TypeError('Compiler trace schemaVersion must be 2.');
  for (const key of ['buildId', 'eventId', 'engine', 'phase', 'state'])
    stringValue(event[key], `Compiler trace ${key}`);
  if (!['classic', 'parallel'].includes(String(event.engine)))
    throw new TypeError('Invalid compiler trace engine.');
}

/**
 * Parses pool message from the supplied source into the dto representation.
 */
function parsePoolMessage(record: Record<string, unknown>): ServicePoolMessage {
  const status = objectRecord(record.status, 'Compiler pool status');
  const state = status.state;
  if (
    !['warming', 'ready', 'busy', 'degraded', 'failed', 'stopped'].includes(
      String(state),
    )
  ) {
    throw new TypeError('Invalid compiler pool state.');
  }
  for (const key of [
    'desiredWorkers',
    'warmingWorkers',
    'readyWorkers',
    'busyWorkers',
    'failedWorkers',
    'startupMs',
    'aggregateWorkerRssBytes',
    'peakAggregateWorkerRssBytes',
  ])
    finiteNumber(status[key], `Compiler pool ${key}`);
  return { kind: 'pool-status', status: status as CompilerPoolStatus };
}

/**
 * Handles object record in the dto flow.
 */
function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Handles integer in the dto flow.
 */
function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value))
    throw new TypeError(`${label} must be an integer.`);
  return value as number;
}

/**
 * Handles finite number in the dto flow.
 */
function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return value;
}

/**
 * Handles string value in the dto flow.
 */
function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

/**
 * Handles response kind in the dto flow.
 */
function responseKind(value: unknown): ServiceResponse['kind'] {
  if (
    !['check', 'preview', 'export', 'exportDrawings'].includes(String(value))
  ) {
    throw new TypeError('Invalid compiler response kind.');
  }
  return value as ServiceResponse['kind'];
}
