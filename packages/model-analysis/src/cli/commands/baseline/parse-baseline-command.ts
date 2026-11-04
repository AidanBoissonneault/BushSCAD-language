import type { CommonArgs, ParsedCommand } from '../../types.js';

/**
 * Parses baseline from the supplied source into the cli representation.
 */
export function parseBaseline(args: CommonArgs): ParsedCommand {
  if (!args.name)
    return { kind: 'error', message: 'baseline requires --name <name>' };
  return {
    kind: 'baseline',
    filePath: args.filePath,
    name: args.name,
    env: args.env,
    width: args.width,
    height: args.height,
    json: args.json,
  };
}
