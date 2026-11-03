/**
 * @author Aidan Boissonneault
 * @file sketch-preview.ts
 * @purpose Provides sketch preview behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { IRPrimitive, SketchPreviewModel } from '@bushscad/ir';
import { sketchPreviewPrimitiveBounds } from '@bushscad/ir';
import {
  SKETCH_BG_COLOR,
  SKETCH_GRID_CENTER,
  SKETCH_GRID_LINES,
} from './sketch-preview-theme.js';
import { drawSketchPrimitive } from './sketch-preview-primitive-dispatch.js';

/**
 * Handles preview max dim in the sketch preview flow.
 */
function previewMaxDim(preview: SketchPreviewModel): number {
  return Math.max(preview.bounds.width, preview.bounds.height, 10);
}

/**
 * Handles model from primitive in the sketch preview flow.
 */
function modelFromPrimitive(primitive: IRPrimitive): SketchPreviewModel {
  const bounds = sketchPreviewPrimitiveBounds(primitive);
  return {
    name: 'sketch',
    line: 1,
    col: 1,
    filePath: '',
    componentPath: [],
    kind: primitive.kind,
    primitive,
    bounds,
    details: [],
  };
}

/**
 * Owns `SketchPreviewRenderer` state and behavior for the sketch preview layer.
 */
export class SketchPreviewRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private content = new THREE.Group();
  private resizeObserver: ResizeObserver;
  private viewHalf = 80;
  private homeViewHalf = 80;
  private pointerId: number | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private animationFrame: number | null = null;

  /**
   * Initializes the `SketchPreviewRenderer` instance with the values supplied by its caller.
   */
  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKETCH_BG_COLOR);

    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 200;
    const asp = w / h;
    const vh = this.viewHalf;
    this.camera = new THREE.OrthographicCamera(
      -vh * asp,
      vh * asp,
      vh,
      -vh,
      -1000,
      1000,
    );
    this.camera.position.set(0, 0, 10);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h, false);

    const grid = new THREE.GridHelper(
      600,
      60,
      SKETCH_GRID_CENTER,
      SKETCH_GRID_LINES,
    );
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);
    this.scene.add(this.content);

    this.resizeObserver = new ResizeObserver(() => {
      const nw = canvas.clientWidth;
      const nh = canvas.clientHeight;
      if (!nw || !nh) return;
      this.fitCamera(nw / nh);
      this.renderer.setSize(nw, nh, false);
    });
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    for (const [type, handler] of this.pointerListeners()) {
      canvas.addEventListener(type, handler);
    }
    this.animate();
  }

  /**
   * Updates while preserving unrelated state.
   */
  update(preview: SketchPreviewModel | IRPrimitive | null): void {
    this.content.clear();
    if (!preview) return;

    const model = 'bounds' in preview ? preview : modelFromPrimitive(preview);
    this.homeViewHalf = Math.max(previewMaxDim(model) * 0.95, 12);
    this.resetCameraToHome();
    this.draw(model);
  }

  /**
   * Handles draw in the sketch preview flow.
   */
  private draw(preview: SketchPreviewModel): void {
    drawSketchPrimitive(this.content, preview.primitive, preview, this.viewHalf);
  }

  /**
   * Handles fit camera in the sketch preview flow.
   */
  private fitCamera(asp: number): void {
    const v = this.viewHalf;
    this.camera.left = -v * asp;
    this.camera.right = v * asp;
    this.camera.top = v;
    this.camera.bottom = -v;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Handles zoom in in the sketch preview flow.
   */
  zoomIn(): void {
    this.setZoom(this.viewHalf * 0.8);
  }

  /**
   * Handles zoom out in the sketch preview flow.
   */
  zoomOut(): void {
    this.setZoom(this.viewHalf * 1.25);
  }

  // fallow-ignore-next-line unused-class-member
  /**
   * Handles pan in the sketch preview flow.
   */
  pan(dx: number, dy: number): void {
    this.camera.position.x += dx * this.viewHalf * 0.18;
    this.camera.position.y += dy * this.viewHalf * 0.18;
  }

  /**
   * Handles home in the sketch preview flow.
   */
  home(): void {
    this.resetCameraToHome();
  }

  /**
   * Resets camera to home to its initial state.
   */
  private resetCameraToHome(): void {
    this.viewHalf = this.homeViewHalf;
    this.camera.position.set(0, 0, 10);
    const canvas = this.renderer.domElement;
    this.fitCamera((canvas.clientWidth || 400) / (canvas.clientHeight || 200));
  }

  /**
   * Sets zoom on the owning state.
   */
  private setZoom(nextViewHalf: number): void {
    this.viewHalf = Math.max(
      this.homeViewHalf * 0.18,
      Math.min(nextViewHalf, this.homeViewHalf * 8),
    );
    const canvas = this.renderer.domElement;
    this.fitCamera((canvas.clientWidth || 400) / (canvas.clientHeight || 200));
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.setZoom(this.viewHalf * (event.deltaY < 0 ? 0.88 : 1.12));
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerId = event.pointerId;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId || !this.lastPointer) return;
    const canvas = this.renderer.domElement;
    const height = canvas.clientHeight || 1;
    const dx =
      ((event.clientX - this.lastPointer.x) / height) * this.viewHalf * -2;
    const dy =
      ((event.clientY - this.lastPointer.y) / height) * this.viewHalf * 2;
    this.camera.position.x += dx;
    this.camera.position.y += dy;
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
    this.lastPointer = null;
    this.renderer.domElement.releasePointerCapture(event.pointerId);
  };

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('wheel', this.onWheel);
    for (const [type, handler] of this.pointerListeners()) {
      canvas.removeEventListener(type, handler);
    }
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.renderer.dispose();
  }

  /**
   * Handles pointer listeners in the sketch preview flow.
   */
  private pointerListeners(): [string, EventListener][] {
    return [
      ['pointerdown', this.onPointerDown as EventListener],
      ['pointermove', this.onPointerMove as EventListener],
      ['pointerup', this.onPointerUp as EventListener],
      ['pointercancel', this.onPointerUp as EventListener],
    ];
  }

  /**
   * Handles animate in the sketch preview flow.
   */
  private animate(): void {
    this.animationFrame = requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}
