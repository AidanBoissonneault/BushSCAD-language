import type { CommonArgs, ParsedCommand } from '../../types.js';

/**
 * Parses suite from the supplied source into the cli representation.
 */
export function parseSuite(args: CommonArgs): ParsedCommand {
  if (!args.outDir)
    return { kind: 'error', message: 'suite requires --out <dir>' };
  return {
    kind: 'suite',
    suiteRoot: args.filePath,
    outDir: args.outDir,
    width: args.width,
    height: args.height,
    json: args.json,
  };
}
