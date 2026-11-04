import type { CommonArgs, ParsedCommand } from '../../types.js';

/**
 * Parses analyze from the supplied source into the cli representation.
 */
export function parseAnalyze(args: CommonArgs): ParsedCommand {
  if (!args.outDir)
    return { kind: 'error', message: 'analyze requires --out <dir>' };
  return {
    kind: 'analyze',
    filePath: args.filePath,
    outDir: args.outDir,
    env: args.env,
    width: args.width,
    height: args.height,
    json: args.json,
    failOnWarning: args.failOnWarning,
  };
}
