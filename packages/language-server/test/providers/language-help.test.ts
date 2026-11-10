/**
 * @author Aidan Boissonneault
 * @file language-help.test.ts
 * @purpose Tests language help behavior in the providers in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { BushScadLanguageServer } from '../../src/protocol/BushScadLanguageServer.js';
import { completionItems } from '../../src/providers/completions.js';
import { completionSpecs } from '../../src/providers/completion-specs.js';

describe('rich language help in protocol providers', () => {
  it('explains a previously undocumented command with syntax, behavior, and examples', async () => {
    const server = new BushScadLanguageServer();
    const uri = 'file:///project/main.bscd';
    server.updateDocument(uri, 'obj body = loft(first, second);');
    const hover = await server.getHover(uri, { line: 1, col: 13 });
    expect(hover?.contents[0]).toBe('`loft`');
    expect(hover?.contents[1]).toContain('**Syntax**');
    expect(hover?.contents[1]).toContain('**Examples**');
    expect(hover?.contents[1]).not.toContain('language construct');
  });

  it('documents anonymous operations and inline @ operation targets', async () => {
    const server = new BushScadLanguageServer();
    const uri = 'file:///project/main.bscd';
    server.updateDocument(uri, 'obj body = cube(10);');
    const hover = await server.getHover(uri, { line: 1, col: 2 });

    expect(hover?.contents[0]).toBe('`obj`');
    expect(hover?.contents[1]).toContain('operation;');
    expect(hover?.contents[1]).toContain('@cube(10).top');
    expect(hover?.contents[1]).toContain(
      'without creating a reusable object name',
    );
  });

  it('shows inline operation target syntax in primitive help', async () => {
    const server = new BushScadLanguageServer();
    const uri = 'file:///project/main.bscd';
    server.updateDocument(uri, 'fillet(@cube(10).top, 2);');
    const hover = await server.getHover(uri, { line: 1, col: 12 });

    expect(hover?.contents[0]).toBe('`cube`');
    expect(hover?.contents[1]).toContain('cube(size);');
    expect(hover?.contents[1]).toContain('@cube(size).top');
  });

  it('preserves authored symbol hover instead of attaching command documentation', async () => {
    const server = new BushScadLanguageServer();
    const uri = 'file:///project/main.bscd';
    server.updateDocument(
      uri,
      'var width = 20;\nsketch plate = rect(width, 10);',
    );
    const hover = await server.getHover(uri, { line: 2, col: 22 });
    expect(hover?.contents[0]).toBe('**var** `width`');
    expect(hover?.contents.join('\n')).not.toContain('**Syntax**');
  });

  it('adds shared Markdown to contextual completions without changing their snippets', () => {
    const specs = completionSpecs('', '', 'statement', []);
    const fn = specs.find((spec) => spec.label === 'fn');
    expect(fn?.insertText).toContain('${1:name}');
    expect(fn?.documentation).toContain('**Arguments**');
    const items = completionItems('', { line: 1, col: 1 }, []);
    expect(items.find((item) => item.label === 'fn')?.documentation).toBe(
      fn?.documentation,
    );
    const refs = completionSpecs('@body.', '@body.', 'surfaceRef', []);
    expect(
      refs.find((spec) => spec.label === 'perimeter')?.documentation,
    ).toContain('inner');
    const origin = completionSpecs('', '', 'default', []).find(
      (spec) => spec.label === 'origin',
    );
    expect(origin?.documentation).toContain('workplane');
    const originDirections = completionSpecs(
      '@origin.',
      '@origin.',
      'surfaceRef',
      [],
    );
    expect(originDirections.map((spec) => spec.label)).toContain('top');
  });

  it('offers compact type-led joint declarations with @ spatial arguments', () => {
    const slider = completionSpecs('', '', 'statement', []).find(
      (spec) => spec.label === 'slider joint',
    );

    expect(slider?.insertText).toContain(
      'slider ${1:name}(@${2:moving.reference}, @${3:support.reference})',
    );
    expect(slider?.insertText).toContain('range = ${4:0mm}..${5:80mm}');
    expect(slider?.documentation).toContain('translation along');
  });

  it('does not attach a language keyword meaning to a named sketch body', () => {
    const source =
      'sketch outline = path(outer = rect(20, 10), top = loop(outer));\noutline.';
    const specs = completionSpecs(source, source, 'surfaceRef', []);
    expect(
      specs.find((spec) => spec.label === 'top')?.documentation,
    ).toBeUndefined();
  });
});
