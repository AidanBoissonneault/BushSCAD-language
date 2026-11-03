/**
 * @author Aidan Boissonneault
 * @file renderer-frame-loop.ts
 * @purpose Runs synchronized model and gizmo frames and handles renderer resize callbacks.
 * @last-edited October 6, 2026
 */

/**
 * Renderer frame callbacks, including resize and render.
 */

type RendererFrameCallbacks = {
  resize(width: number, height: number): void;
  render(): void;
};

/** Renders one synchronized model and orientation-gizmo frame. */
export function renderFrame(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  gizmo: GizmoRenderer | null,
  beforeRender?: () => void,
): void {
  controls.update();
  beforeRender?.();
  renderer.render(scene, camera);
  if (!gizmo) return;
  gizmo.syncCamera(camera, controls.target);
  gizmo.render();
}

/** Owns ResizeObserver and animation-frame lifetime for one WebGL canvas. */
export class RendererFrameLoop {
  private readonly resizeObserver: ResizeObserver;
  private width = 0;
  private height = 0;
  private disposed = false;

  /**
   * Initializes the `RendererFrameLoop` instance with the values supplied by its caller.
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: RendererFrameCallbacks,
  ) {
    this.resizeObserver = new ResizeObserver(() => this.resizeToCanvas());
    this.resizeObserver.observe(canvas);
    this.resizeToCanvas();
    this.animate();
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
  }

  /**
   * Handles animate in the core flow.
   */
  private animate(): void {
    requestAnimationFrame(() => {
      if (this.disposed) return;
      this.animate();
    });
    this.resizeToCanvas();
    this.callbacks.render();
  }

  /**
   * Handles resize to canvas in the core flow.
   */
  private resizeToCanvas(): void {
    const size = resizeCanvasIfNeeded(
      this.canvas,
      { width: this.width, height: this.height },
      this.callbacks.resize,
    );
    this.width = size.width;
    this.height = size.height;
  }
}
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GizmoRenderer } from '../scene/gizmo.js';
import { resizeCanvasIfNeeded } from './renderer-canvas-sizing.js';
