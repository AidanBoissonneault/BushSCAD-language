import type { ExportFormat } from '@bushscad/ir';

/** Parsed options passed from the CLI entrypoint to build/check/export actions. */
export type CliOptions = {
  filePath: string;
  env: Record<string, string>;
  format: ExportFormat;
  out: string | null;
  check: boolean;
  build: boolean;
  json: boolean;
};

/** Result returned by CLI argument parsing. */
export type ParsedArgs =
  | CliOptions
  | { service: true }
  | { error: string };

/** Shared result shape used by independent argument option handlers. */
export type ArgHandlerResult =
  | { handled: true; index: number; error?: string }
  | { handled: false };
