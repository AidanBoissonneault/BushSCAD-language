/**
 * @author Aidan Boissonneault
 * @file compilation-graph-corpus.test.ts
 * @purpose Tests compilation graph corpus behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileFileToIr } from '../../../src/platform/node/node.js';
import {
  buildCompilationGraph,
  compilationGraphToJson,
  simulateCompilationSchedule,
} from '../../../src/index.js';
import { readyWorkerPool } from '../../fixtures/parallel-compilation/scheduler-graphs.js';

/**
 * Type used for suite manifest.
 */
type SuiteManifest = Readonly<{
  cases: readonly Readonly<{ id: string; file: string }>[];
}>;

const suiteDirectory = fileURLToPath(
  new URL('../../../../../examples/test_suite/', import.meta.url),
);
const suite = JSON.parse(
  readFileSync(join(suiteDirectory, 'suite.json'), 'utf8'),
) as SuiteManifest;

describe('parallel compilation graph corpus', () => {
  it('lowers and simulates every released-language graph deterministically', async () => {
    for (const testCase of suite.cases) {
      const filePath = join(suiteDirectory, testCase.file);
      const compiled = compileFileToIr({
        filePath,
        rootPath: dirname(filePath),
        entrypointMode: 'requested-file',
      });
      expect(compiled.ok, testCase.id).toBe(true);
      if (!compiled.ok) continue;

      const first = buildCompilationGraph(compiled.program, {
        entrypoint: filePath,
      });
      const second = buildCompilationGraph(compiled.program, {
        entrypoint: filePath,
      });
      expect(first.diagnostics, testCase.id).toEqual([]);
      expect(compilationGraphToJson(first.graph), testCase.id).toBe(
        compilationGraphToJson(second.graph),
      );
      const simulation = await simulateCompilationSchedule(
        first.graph,
        { workerPool: readyWorkerPool(4), metadataConcurrency: 4 },
        ({ node }) => ({ kind: 'completed', artifact: node.id }),
      );
      expect(simulation.errors, testCase.id).toEqual([]);
      expect(
        simulation.nodes.every(({ status }) => status === 'completed'),
      ).toBe(true);
      expect(simulation.artifacts.map(({ nodeId }) => nodeId)).toEqual(
        first.graph.nodes.map(({ id }) => id),
      );
    }
  }, 90_000);
});
