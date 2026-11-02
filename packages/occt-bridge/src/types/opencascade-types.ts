/**
 * @author Aidan Boissonneault
 * @file opencascade-types.ts
 * @purpose Describes the OpenCascade.js module API used by the OCCT bridge.
 * @last-edited October 6, 2026
 */

/**
 * Open cascade module, including load dynamic library and fs.
 */

export type OpenCascadeModule = {
  loadDynamicLibrary: (
    lib: string,
    options: {
      loadAsync: boolean;
      global: boolean;
      nodelete: boolean;
      allowUndefined: boolean;
    },
  ) => Promise<void>;
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
  };
};

/**
 * open cascade factory represented by new (module?: { locateFile?: (path: string) => string;
 * wasmBinary?: Uint8Array; .
 */
export type OpenCascadeFactory = new (module?: {
  locateFile?: (path: string) => string;
  wasmBinary?: Uint8Array;
  print?: (message: string) => void;
  printErr?: (message: string) => void;
}) => Promise<OpenCascadeModule>;
