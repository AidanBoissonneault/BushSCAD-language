import type { CliOptions, ArgHandlerResult } from '../types.js';

/** Parses --out in separate-value and inline-value forms. */
export function parseOutput(
  args: string[],
  index: number,
  options: CliOptions,
): ArgHandlerResult | null {
  const arg = args[index];
  if (arg === '--out') {
    options.out = args[index + 1] ?? null;
    return options.out
      ? { handled: true, index: index + 1 }
      : { handled: true, index: index + 1, error: '--out requires a path' };
  }
  if (arg.startsWith('--out=')) {
    options.out = arg.slice('--out='.length);
    return { handled: true, index };
  }
  return null;
}
