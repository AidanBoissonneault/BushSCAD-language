/**
 * @author Aidan Boissonneault
 * @file handleServiceRequest.test.ts
 * @purpose Tests handle service request behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import { fileURLToPath } from 'node:url';
import type { DrawingResult } from '@bushscad/ir';
import type { PreviewResult } from '@bushscad/compiler/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleServiceRequest } from '../../src/service/handleServiceRequest';

const writeDrawingFiles = vi.hoisted(() => vi.fn(() => []));
vi.mock('../../src/cli/writeDrawingFiles.js', () => ({ writeDrawingFiles }));

const drawing: DrawingResult = {
  name: 'plate',
  dxfContent: 'DXF-CONTENT',
  svgContent: '<svg/>',
  exportDxfPath: './out/plate.dxf',
  exportSvgPath: './out/plate.svg',
  errors: [],
};

describe('compiler service requests', () => {
  beforeEach(() => vi.clearAllMocks());
  it('forwards requested-file entrypoint mode to the compiler', async () => {
    const rootPath = fileURLToPath(
      new URL('../../../../examples/m14', import.meta.url),
    );
    const filePath = fileURLToPath(
      new URL(
        '../../../../examples/m14/src/parts/foot.bscd',
        import.meta.url,
      ),
    );

    const response = await handleServiceRequest({
      id: 17,
      kind: 'check',
      filePath,
      rootPath,
      entrypointMode: 'requested-file',
    });

    expect(response).toMatchObject({ id: 17, kind: 'check', ok: true });
    expect(response.env).toEqual([]);
  });

  it('returns drawing content without service-owned writes when requested', async () => {
    const response = await handleServiceRequest(
      {
        id: 18,
        kind: 'exportDrawings',
        filePath: 'C:/project/main.bscd',
        drawingOutputMode: 'return-content',
      },
      { preview: previewWithDrawing },
    );

    expect(response).toMatchObject({ ok: true, drawings: [drawing] });
    expect(writeDrawingFiles).not.toHaveBeenCalled();
  });

  it('preserves service-owned drawing writes by default', async () => {
    await handleServiceRequest(
      {
        id: 19,
        kind: 'exportDrawings',
        filePath: 'C:/project/main.bscd',
      },
      { preview: previewWithDrawing },
    );
    expect(writeDrawingFiles).toHaveBeenCalledWith(
      [drawing],
      'C:/project/main.bscd',
    );
  });
});

/**
 * Handles preview with drawing in the service flow.
 */
async function previewWithDrawing(): Promise<{
  result: PreviewResult;
}> {
  return {
    result: {
      ok: true,
      program: {} as PreviewResult extends { program: infer T } ? T : never,
      meshes: [],
      drawings: [drawing],
      validations: [],
      joints: [],
      env: [],
      dependents: {},
      elapsedMs: 1,
    } as unknown as PreviewResult,
  };
}
