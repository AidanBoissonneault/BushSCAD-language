import { describe, expect, it, vi } from 'vitest';
import { resizeCanvasIfNeeded } from '../../src/core/renderer-canvas-sizing.js';

describe('resizeCanvasIfNeeded', () => {
  it('ignores zero-sized and unchanged canvases', () => {
    const resize = vi.fn();
    const previous = { width: 640, height: 480 };

    expect(
      resizeCanvasIfNeeded(
        { clientWidth: 0, clientHeight: 480 },
        previous,
        resize,
      ),
    ).toBe(previous);
    expect(
      resizeCanvasIfNeeded(
        { clientWidth: 640, clientHeight: 480 },
        previous,
        resize,
      ),
    ).toBe(previous);
    expect(resize).not.toHaveBeenCalled();
  });

  it('reports changed dimensions and returns the new size', () => {
    const resize = vi.fn();

    expect(
      resizeCanvasIfNeeded(
        { clientWidth: 800, clientHeight: 600 },
        { width: 640, height: 480 },
        resize,
      ),
    ).toEqual({ width: 800, height: 600 });
    expect(resize).toHaveBeenCalledWith(800, 600);
  });
});
