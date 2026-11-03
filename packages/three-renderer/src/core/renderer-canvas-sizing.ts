/**
 * Current canvas dimensions used to avoid redundant renderer resizes.
 */
export type RendererCanvasSize = {
  width: number;
  height: number;
};

/**
 * Applies a canvas resize only when both dimensions are positive and changed.
 */
export function resizeCanvasIfNeeded(
  canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'>,
  previous: RendererCanvasSize,
  resize: (width: number, height: number) => void,
): RendererCanvasSize {
  const { clientWidth: width, clientHeight: height } = canvas;
  if (
    width <= 0 ||
    height <= 0 ||
    (width === previous.width && height === previous.height)
  ) {
    return previous;
  }
  resize(width, height);
  return { width, height };
}
