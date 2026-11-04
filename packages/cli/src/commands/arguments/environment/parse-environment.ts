import type { CliOptions, ArgHandlerResult } from '../types.js';

/** Parses --env and -env overrides in separate-value and inline-value forms. */
export function parseEnvironment(
  args: string[],
  index: number,
  options: CliOptions,
): ArgHandlerResult | null {
  const arg = args[index];
  if (arg === '--env' || arg === '-env') {
    const value = args[index + 1];
    if (!value)
      return {
        handled: true,
        index: index + 1,
        error: `${arg} requires name=value`,
      };
    return assignEnvironment(value, index + 1, options);
  }
  if (arg.startsWith('--env=')) {
    return assignEnvironment(arg.slice('--env='.length), index, options);
  }
  return null;
}

/** Validates and stores a single environment override. */
function assignEnvironment(
  raw: string,
  index: number,
  options: CliOptions,
): ArgHandlerResult {
  const parsed = parseEnvironmentValue(raw);
  if (!parsed.ok) return { handled: true, index, error: parsed.error };
  options.env[parsed.name] = parsed.value;
  return { handled: true, index };
}

/** Parses the name=value form and validates the environment variable name. */
function parseEnvironmentValue(
  raw: string,
): { ok: true; name: string; value: string } | { ok: false; error: string } {
  const equalsIndex = raw.indexOf('=');
  if (equalsIndex <= 0)
    return {
      ok: false,
      error: `Invalid env override '${raw}'; expected name=value`,
    };
  const name = raw.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    return { ok: false, error: `Invalid env name '${name}'` };
  return { ok: true, name, value: raw.slice(equalsIndex + 1) };
}
