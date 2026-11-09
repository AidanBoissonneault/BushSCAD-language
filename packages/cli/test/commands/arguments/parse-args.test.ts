/**
 * @author Aidan Boissonneault
 * @file args.test.ts
 * @purpose Tests args behavior in the commands in cli package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  parseArgs,
  usage,
} from '../../../src/commands/arguments/parse-args.js';
import type { CliOptions } from '../../../src/commands/arguments/types.js';

/**
 * Handles options in the commands flow.
 */
function options(args: string[]): CliOptions {
  const parsed = parseArgs(args);
  if ('service' in parsed || 'error' in parsed) {
    throw new Error(`Expected CLI options, got ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

/**
 * Handles error in the commands flow.
 */
function error(args: string[]): string {
  const parsed = parseArgs(args);
  if (!('error' in parsed)) {
    throw new Error(`Expected parse error, got ${JSON.stringify(parsed)}`);
  }
  return parsed.error;
}

describe('parseArgs', () => {
  it('parses service mode', () => {
    expect(parseArgs(['--service'])).toEqual({ service: true });
  });

  it('returns usage for help', () => {
    expect(error(['--help'])).toBe(usage());
    expect(error(['-h'])).toBe(usage());
  });

  it('rejects unknown flags', () => {
    expect(error(['--verbose'])).toBe("Unknown option '--verbose'");
  });

  it('parses --format as separate and inline forms', () => {
    expect(options(['model.bscd', '--format', 'stl']).format).toBe('stl');
    expect(options(['model.bscd', '--format=step']).format).toBe('step');
  });

  it('rejects invalid formats', () => {
    expect(error(['model.bscd', '--format', 'obj'])).toBe(
      "Invalid --format 'obj'",
    );
  });

  it('parses --out as separate and inline forms', () => {
    expect(options(['model.bscd', '--out', 'build/model.step']).out).toBe(
      'build/model.step',
    );
    expect(options(['model.bscd', '--out=build/model.stl']).out).toBe(
      'build/model.stl',
    );
  });

  it('requires a path after --out', () => {
    expect(error(['model.bscd', '--out'])).toBe('--out requires a path');
  });

  it('parses repeated env overrides', () => {
    expect(
      options(['model.bscd', '--env', 'mode=release', '--env=count=8']).env,
    ).toEqual({ mode: 'release', count: '8' });
  });

  it('preserves valid names that are special JavaScript object properties', () => {
    const parsed = parseArgs(['model.bscd', '--env', '__proto__=value']);

    expect(parsed).toMatchObject({ filePath: 'model.bscd' });
    if ('error' in parsed || 'service' in parsed) return;
    expect(Object.hasOwn(parsed.env, '__proto__')).toBe(true);
    expect(parsed.env['__proto__']).toBe('value');
  });

  it('rejects invalid env names', () => {
    expect(error(['model.bscd', '--env', '1bad=value'])).toBe(
      "Invalid env name '1bad'",
    );
  });

  it('requires a file path', () => {
    expect(error([])).toBe(usage());
  });

  it('rejects extra positional arguments', () => {
    expect(error(['one.bscd', 'two.bscd'])).toBe(
      "Unexpected extra argument 'two.bscd'",
    );
  });

  it('parses check and json flags', () => {
    expect(options(['model.bscd', '--check', '--json'])).toMatchObject({
      filePath: 'model.bscd',
      check: true,
      json: true,
    });
  });
});
