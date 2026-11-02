/**
 * @author Aidan Boissonneault
 * @file parallel-corpus.integration.test.ts
 * @purpose Tests parallel corpus integration behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceResponse } from '../../src/dto/types.js';
import {
  interactionContract,
  meshContract,
} from '../fixtures/parallel-preview-contract.js';

const runIntegration = process.env['BUSHSCAD_RUN_OCCT_INTEGRATION'] === '1';
const integrationIt = runIntegration ? it : it.skip;
const testDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDir, '../../../..');
const suiteDir = resolve(repositoryRoot, 'examples/test_suite');
const cliEntry = resolve(testDir, '../../dist/index.js');
let service: ChildProcessWithoutNullStreams | undefined;

afterEach(() => service?.kill());

describe('parallel compilation equivalence corpus', () => {
  integrationIt(
    'matches classic preview contracts for every released-language model',
    async () => {
      const client = startService();
      service = client.process;
      await client.ready;
      const cases = suiteCases();
      for (let index = 0; index < cases.length; index++) {
        const filePath = resolve(suiteDir, cases[index].file);
        const parallel = await client.preview(index * 2 + 1, filePath);
        const classic = await client.preview(
          index * 2 + 2,
          filePath,
          'classic',
        );
        expect(
          parallel.ok,
          `${cases[index].id}: ${responseErrors(parallel)}`,
        ).toBe(true);
        expect(
          classic.ok,
          `${cases[index].id}: ${responseErrors(classic)}`,
        ).toBe(true);
        if (!parallel.ok || !classic.ok) continue;
        expect(
          parallel.meshes?.map(meshContract),
          `${cases[index].id}: meshes`,
        ).toEqual(classic.meshes?.map(meshContract));
        expect(
          interactionContract(parallel.interaction),
          `${cases[index].id}: interaction`,
        ).toEqual(interactionContract(classic.interaction));
        expect(parallel.drawings, `${cases[index].id}: drawings`).toEqual(
          classic.drawings,
        );
        expect(parallel.validations, `${cases[index].id}: validations`).toEqual(
          classic.validations,
        );
        expect(parallel.joints, `${cases[index].id}: joints`).toEqual(
          classic.joints,
        );
      }
    },
    600_000,
  );
});

/**
 * Suite case, including identifier and file.
 */
type SuiteCase = { id: string; file: string };

/**
 * Handles suite cases in the service flow.
 */
function suiteCases(): SuiteCase[] {
  const suite = JSON.parse(
    readFileSync(resolve(suiteDir, 'suite.json'), 'utf8'),
  ) as { cases: SuiteCase[] };
  const requested = process.env['BUSHSCAD_CORPUS_CASE'];
  return requested
    ? suite.cases.filter((testCase) => testCase.id === requested)
    : suite.cases;
}

/**
 * Starts service with the supplied configuration.
 */
function startService(): {
  process: ChildProcessWithoutNullStreams;
  ready: Promise<void>;
  preview: (
    id: number,
    filePath: string,
    engine?: 'classic',
  ) => Promise<ServiceResponse>;
} {
  const child = spawn(process.execPath, [cliEntry, '--service'], {
    env: {
      ...process.env,
      BUSHSCAD_OCCT_WORKERS: '2',
    },
    windowsHide: true,
  });
  const pending = new Map<number, (response: ServiceResponse) => void>();
  /**
   * Updates state to record ready.
   */
  let markReady = (): void => undefined;
  const ready = new Promise<void>((resolvePromise) => {
    markReady = resolvePromise;
  });
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line) as Record<string, unknown>;
    if (
      message.kind === 'pool-status' &&
      isRecord(message.status) &&
      message.status.state === 'ready'
    ) {
      markReady();
    }
    if (typeof message.id === 'number' && message.kind === 'preview') {
      pending.get(message.id)?.(message as unknown as ServiceResponse);
      pending.delete(message.id);
    }
  });
  return {
    process: child,
    ready,
    preview: (id, filePath, engine) =>
      new Promise((resolvePromise) => {
        pending.set(id, resolvePromise);
        child.stdin.write(
          `${JSON.stringify({
            id,
            kind: 'preview',
            filePath,
            rootPath: repositoryRoot,
            entrypointMode: 'requested-file',
            ...(engine ? { engine } : {}),
          })}\n`,
        );
      }),
  };
}

/**
 * Returns whether the input meets the `record` condition.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Handles response errors in the service flow.
 */
function responseErrors(response: ServiceResponse): string {
  return JSON.stringify(response.ok ? [] : response.errors);
}
