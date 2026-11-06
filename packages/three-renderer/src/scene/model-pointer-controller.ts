/**
 * @author Aidan Boissonneault
 * @file model-pointer-controller.ts
 * @purpose Provides model pointer controller behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { InteractionSnapshot } from '@bushscad/ir';
import { hitTestModel, type ModelHit } from './model-hit-testing.js';

/**
 * Pointer coordinates in the model viewport.
 */
export type ModelPointerPosition = { readonly x: number; readonly y: number };

/**
 * Handlers invoked when the pointer hovers over or activates a model target.
 */
export type ModelPointerCallbacks = {
  readonly onHover?: (
    hit: ModelHit | null,
    position: ModelPointerPosition | null,
  ) => void;
  readonly onActivate?: (hit: ModelHit) => void;
  /** Called when an eligible click lands on empty viewport space. */
  readonly onClear?: () => void;
};

/**
 * Pointer-down state used to distinguish a click from a drag.
 */
type PointerPress = {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly eligible: boolean;
  moved: boolean;
};

/**
 * Defines the `ModelHitTest` callback contract used by the scene layer.
 */
type ModelHitTest = (clientX: number, clientY: number) => ModelHit | null;

/**
 * Animation-frame request and cancellation methods used to coalesce pointer updates.
 */
export type ModelPointerFrameScheduler = {
  request(callback: () => void): number;
  cancel(handle: number): void;
};

const DRAG_THRESHOLD_PX = 5;

/** Owns model hover and activation without treating camera gestures as clicks. */
export class ModelPointerController {
  private readonly raycaster = new THREE.Raycaster();
  private callbacks: ModelPointerCallbacks = {};
  private press: PointerPress | null = null;
  private hovered: ModelHit | null = null;
  private addedTabIndex = false;
  private hoverFrame: number | null = null;
  private pendingHover: { clientX: number; clientY: number } | null = null;
  private disposed = false;

  /**
   * Initializes the `ModelPointerController` instance with the values supplied by its caller.
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly meshes: () => readonly THREE.Object3D[],
    private readonly snapshot: () => InteractionSnapshot | null,
    private readonly injectedHitTest?: ModelHitTest,
    private readonly frameScheduler: ModelPointerFrameScheduler = browserFrameScheduler(
      canvas,
    ),
  ) {
    if (canvas.tabIndex < 0) {
      canvas.tabIndex = 0;
      this.addedTabIndex = true;
    }
    canvas.addEventListener('contextmenu', preventContextMenu);
    canvas.addEventListener('pointerdown', this.remapShiftMiddle, {
      capture: true,
    });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('keydown', this.onKeyDown);
  }

  /**
   * Sets callbacks on the owning state.
   */
  setCallbacks(callbacks: ModelPointerCallbacks): void {
    this.callbacks = callbacks;
  }

  /** Removes every listener installed on the shared WebGL canvas. */
  dispose(): void {
    this.disposed = true;
    this.cancelPendingHover();
    this.canvas.removeEventListener('contextmenu', preventContextMenu);
    this.canvas.removeEventListener('pointerdown', this.remapShiftMiddle, true);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('keydown', this.onKeyDown);
    if (this.addedTabIndex) this.canvas.removeAttribute('tabindex');
  }

  private readonly remapShiftMiddle = (event: PointerEvent): void => {
    if (event.button !== 1 || !event.shiftKey) return;
    event.stopImmediatePropagation();
    this.canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        button: 2,
        buttons: 2,
      }),
    );
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.press = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      eligible: event.button === 0 && !hasModifier(event),
      moved: false,
    };
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.press?.pointerId === event.pointerId) {
      const distance = Math.hypot(
        event.clientX - this.press.clientX,
        event.clientY - this.press.clientY,
      );
      if (distance > DRAG_THRESHOLD_PX) this.press.moved = true;
    }
    this.pendingHover = { clientX: event.clientX, clientY: event.clientY };
    if (this.hoverFrame !== null) return;
    this.hoverFrame = -1;
    const handle = this.frameScheduler.request(this.flushHover);
    if (this.hoverFrame !== null) this.hoverFrame = handle;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const press = this.press;
    this.press = null;
    if (
      !press ||
      press.pointerId !== event.pointerId ||
      !press.eligible ||
      press.moved ||
      event.button !== 0 ||
      hasModifier(event)
    ) {
      return;
    }
    dispatchPointerActivation(
      this.hit(event.clientX, event.clientY),
      this.callbacks,
    );
  };

  private readonly onPointerCancel = (): void => {
    this.press = null;
  };

  private readonly onPointerLeave = (event: PointerEvent): void => {
    if (isInteractionOverlay(event.relatedTarget)) return;
    this.cancelPendingHover();
    this.hovered = null;
    this.callbacks.onHover?.(null, null);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || hasModifier(event) || !this.hovered) return;
    event.preventDefault();
    this.callbacks.onActivate?.(this.hovered);
  };

  /**
   * Handles hit in the scene flow.
   */
  private hit(clientX: number, clientY: number): ModelHit | null {
    if (this.injectedHitTest) return this.injectedHitTest(clientX, clientY);
    return hitTestModel(
      this.raycaster,
      this.camera,
      this.canvas,
      clientX,
      clientY,
      this.meshes(),
      this.snapshot(),
    );
  }

  private readonly flushHover = (): void => {
    this.hoverFrame = null;
    const pending = this.pendingHover;
    this.pendingHover = null;
    if (this.disposed || !pending) return;
    this.hovered = this.hit(pending.clientX, pending.clientY);
    this.callbacks.onHover?.(
      this.hovered,
      canvasPosition(this.canvas, pending.clientX, pending.clientY),
    );
  };

  /**
   * Cancels pending hover and restores the prior state.
   */
  private cancelPendingHover(): void {
    if (this.hoverFrame !== null) this.frameScheduler.cancel(this.hoverFrame);
    this.hoverFrame = null;
    this.pendingHover = null;
  }
}

/**
 * Handles browser frame scheduler in the scene flow.
 */
function browserFrameScheduler(
  canvas: HTMLCanvasElement,
): ModelPointerFrameScheduler {
  const view = canvas.ownerDocument?.defaultView;
  if (view?.requestAnimationFrame) {
    return {
      request: (callback) => view.requestAnimationFrame(callback),
      cancel: (handle) => view.cancelAnimationFrame(handle),
    };
  }
  return {
    request: (callback) => {
      callback();
      return 0;
    },
    cancel: () => undefined,
  };
}

/**
 * Checks whether the input has modifier.
 */
function hasModifier(event: MouseEvent | KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/**
 * Handles canvas position in the scene flow.
 */
function canvasPosition(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): ModelPointerPosition {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/**
 * Returns whether the input meets the `interaction overlay` condition.
 */
function isInteractionOverlay(target: EventTarget | null): boolean {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.closest('[data-model-interaction-overlay]') !== null
  );
}

/**
 * Handles prevent context menu in the scene flow.
 */
function preventContextMenu(event: Event): void {
  event.preventDefault();
}

/** Sends a valid viewport click to its hit or empty-space callback. */
function dispatchPointerActivation(
  hit: ModelHit | null,
  callbacks: ModelPointerCallbacks,
): void {
  if (hit) callbacks.onActivate?.(hit);
  else callbacks.onClear?.();
}
