/**
 * @author Aidan Boissonneault
 * @file workspace-sketches.test.ts
 * @purpose Tests workspace sketches behavior in the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  findActiveSketchPreview,
  findSketchPreviews,
} from '../../src/sketch-preview/sketchPreview.js';
import { WorkspaceLanguageServices } from '../../src/platform/lsp/workspace-services.js';

const uri = 'file:///C:/workspace/model.bscd';
const file = 'C:/workspace/model.bscd';
const source = `import { size } from './library.bscd';
part shell_smoke {
  sketch body = rect(size, 10);
  obj body = extrude(body, 10);
}`;

describe('workspace sketch previews', () => {
  it('resolves imports and updates geometry from unsaved dependency buffers', async () => {
    const workspace = new WorkspaceLanguageServices();
    workspace.updateDocument(uri, source, 1);
    const dependency = 'file:///C:/workspace/library.bscd';
    workspace.updateDocument(dependency, 'export var size = 12;', 1);
    /**
     * Handles list in the sketch preview flow.
     */
    const list = () =>
      findSketchPreviews(source, file, workspace.sketchFiles(uri));
    expect(list()).toEqual([
      expect.objectContaining({
        name: 'body',
        bounds: expect.objectContaining({ width: 12 }),
      }),
    ]);
    workspace.updateDocument(dependency, 'export var size = 24;', 2);
    expect(list()[0]?.bounds.width).toBe(24);
    expect(
      findActiveSketchPreview(source, file, 3, 5, workspace.sketchFiles(uri))
        ?.bounds.width,
    ).toBe(24);
    await workspace.dispose();
  });
});
