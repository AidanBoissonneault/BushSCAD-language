import type { CommonArgs, ParsedCommand } from '../../types.js';

/**
 * Parses compare from the supplied source into the cli representation.
 */
export function parseCompare(args: CommonArgs): ParsedCommand {
  if (!args.baseline)
    return { kind: 'error', message: 'compare requires --baseline <name>' };
  if (!args.outDir)
    return { kind: 'error', message: 'compare requires --out <dir>' };
  return {
    kind: 'compare',
    filePath: args.filePath,
    baseline: args.baseline,
    outDir: args.outDir,
    env: args.env,
    width: args.width,
    height: args.height,
    json: args.json,
    failOnWarning: args.failOnWarning,
  };
}
