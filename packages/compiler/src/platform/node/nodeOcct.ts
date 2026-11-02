/**
 * @author Aidan Boissonneault
 * @file nodeOcct.ts
 * @purpose Provides node OpenCascade behavior for the platform node in compiler package.
 * @last-edited October 6, 2026
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { OcctBridge } from '@bushscad/occt-bridge';
import { normalizePath } from '../../core/paths.js';
import { installFallbackFonts } from './nodeFonts.js';
import type {
  OpenCascadeFactory,
  OpenCascadeModule,
} from '@bushscad/occt-bridge/opencascade-types';

const require = createRequire(import.meta.url);
let bridgePromise: Promise<OcctBridge> | null = null;

/**
 * Initializes and caches the OpenCascade bridge for Node execution.
 * Loading OpenCascade is expensive and needs Node-specific fetch handling for
 * wasm files, so all preview/export calls share this bridge.
 */
function opencascadeDistDir(): string {
  return dirname(require.resolve('opencascade.js/dist/opencascade.js'));
}

/**
 * Handles load open cascade factory in the platform node flow.
 */
function loadOpenCascadeFactory(distDir: string): OpenCascadeFactory {
  const filename = join(distDir, 'opencascade.js');
  const source = readFileSync(filename, 'utf8').replace(
    /\s*export default Module;\s*$/,
    '\nmodule.exports = Module;\n',
  );
  const module = { exports: {} as unknown };
  const localRequire = createRequire(filename);
  const run = new Function(
    'module',
    'exports',
    'require',
    '__dirname',
    '__filename',
    source,
  );
  run(module, module.exports, localRequire, distDir, filename);
  return module.exports as OpenCascadeFactory;
}

/**
 * Handles buffer to array buffer in the platform node flow.
 */
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

/**
 * Handles with file fetch in the platform node flow.
 */
function withFileFetch<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  try {
    (globalThis as { fetch?: typeof fetch }).fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const target =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      try {
        const filePath = target.startsWith('file://')
          ? fileURLToPath(target)
          : target;
        const data = bufferToArrayBuffer(readFileSync(filePath));
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => data,
        } as Response;
      } catch {
        if (originalFetch) return originalFetch(input, init);
        throw new Error(`Cannot fetch '${target}'`);
      }
    }) as typeof fetch;
    return fn().finally(() => {
      (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    });
  } catch (error) {
    (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    throw error;
  }
}

/**
 * Handles init open cascade for node in the platform node flow.
 */
function initOpenCascadeForNode(): Promise<OpenCascadeModule> {
  const distDir = opencascadeDistDir();
  const mainJS = loadOpenCascadeFactory(distDir);

  return withFileFetch(() =>
    new mainJS({
      wasmBinary: new Uint8Array(
        readFileSync(join(distDir, 'opencascade.wasm')),
      ),
      print: (message) => process.stderr.write(`${message}\n`),
      printErr: (message) => process.stderr.write(`${message}\n`),
      /**
       * Handles locate file in the platform node flow.
       */
      locateFile(path: string): string {
        return normalizePath(join(distDir, path));
      },
    }).then(async (oc) => {
      for (const lib of [
        'opencascade.core.wasm',
        'opencascade.modelingAlgorithms.wasm',
        'opencascade.visualApplication.wasm',
        'opencascade.dataExchangeBase.wasm',
        'opencascade.dataExchangeExtra.wasm',
      ]) {
        await oc.loadDynamicLibrary(normalizePath(join(distDir, lib)), {
          loadAsync: true,
          global: true,
          nodelete: true,
          allowUndefined: false,
        });
      }
      installFallbackFonts(oc);
      return oc;
    }),
  );
}

/**
 * Returns bridge from the supplied input.
 */
export function getBridge(): Promise<OcctBridge> {
  if (!bridgePromise) {
    bridgePromise = OcctBridge.init(initOpenCascadeForNode).catch((err) => {
      bridgePromise = null;
      throw err;
    });
  }

  return bridgePromise;
}
