/**
 * @author Aidan Boissonneault
 * @file eval-param-spans.test.ts
 * @purpose Tests eval param spans behavior in the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRCut, IRExtrude, IRFillet } from '@bushscad/ir';
import { evalOk, opsOfKind } from '../core/test-support.js';

describe('IR paramSpans (M35 timeline parameter edits)', () => {
  it('records a paramSpan for an extrude depth given as a numeric literal', () => {
    const { program } = evalOk(`
base_unit = mm;
part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
}
`);
    const extrude = program.ops.find(
      (o): o is IRExtrude => o.kind === 'extrude',
    );
    expect(extrude?.paramSpans?.depth).toBeDefined();
    expect(extrude?.paramSpans?.depth?.span.line).toBeGreaterThan(0);
    expect(extrude?.paramSpans?.depth?.literal).toBe('10');
  });

  it('omits the paramSpan when the depth comes , @a variable', () => {
    const { program } = evalOk(`
base_unit = mm;
var plate_d = 8;
part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, plate_d);
}
`);
    const extrude = program.ops.find(
      (o): o is IRExtrude => o.kind === 'extrude',
    );
    expect(extrude?.paramSpans?.depth).toBeUndefined();
  });

  it('records a paramSpan for a fillet radius literal', () => {
    const { program } = evalOk(`
base_unit = mm;
part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    fillet(@base.top.edges, 1.5);
}
`);
    const fillet = program.ops.find((o): o is IRFillet => o.kind === 'fillet');
    expect(fillet?.paramSpans?.radius).toBeDefined();
    expect(fillet?.paramSpans?.radius?.literal).toBe('1.5');
  });

  it('records a paramSpan with literal "auto" for a pos offset', () => {
    const { program } = evalOk(`
base_unit = mm;
part plate {
    sketch base = rect(120, 80);
    obj base = extrude(base, 10);
    for i in range(3) within base.top.width {
        sketch h = circle(3);
        obj h = cut(h, through base , @base.top(x: auto, y: 12));
    }
}
`);
    const cut = opsOfKind<IRCut>(program.ops, 'cut')[0];
    expect(cut?.paramSpans?.x).toBeDefined();
    expect(cut?.paramSpans?.x?.literal).toBe('auto');
    expect(cut?.paramSpans?.y?.literal).toBe('12');
  });
});
