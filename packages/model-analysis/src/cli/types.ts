/** Public command results and private argument-parser contracts. */
/**
 * @author Aidan Boissonneault
 * @file cliArgs.ts
 * @purpose Defines model-analysis CLI commands and parses their arguments.
 * @last-edited October 6, 2026
 */

/**
 * Analyze command, including operation kind, source file path, out dir, env, and width.
 */

export type AnalyzeCommand = {
  kind: 'analyze';
  filePath: string;
  outDir: string;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
  failOnWarning: boolean;
};

/**
 * Baseline command, including operation kind, source file path, name, env, and width.
 */
export type BaselineCommand = {
  kind: 'baseline';
  filePath: string;
  name: string;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
};

/**
 * Compare command, including operation kind, source file path, baseline, out dir, and env.
 */
export type CompareCommand = {
  kind: 'compare';
  filePath: string;
  baseline: string;
  outDir: string;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
  failOnWarning: boolean;
};

/**
 * Suite command, including operation kind, suite root, out dir, width, and height.
 */
export type SuiteCommand = {
  kind: 'suite';
  suiteRoot: string;
  outDir: string;
  width: number;
  height: number;
  json: boolean;
};

/**
 * Parsed command accepts AnalyzeCommand, BaselineCommand, CompareCommand, SuiteCommand, and {
 * kind: 'error'; message: string }.
 */
export type ParsedCommand =
  | AnalyzeCommand
  | BaselineCommand
  | CompareCommand
  | SuiteCommand
  | { kind: 'error'; message: string };

/** Shared parsed inputs passed from the CLI tokenizer to a command parser. */
export type CommonArgs = {
  filePath: string;
  outDir: string | null;
  name: string | null;
  baseline: string | null;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
  failOnWarning: boolean;
};
