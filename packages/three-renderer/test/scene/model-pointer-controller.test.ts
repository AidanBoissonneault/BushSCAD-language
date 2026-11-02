/**
 * @author Aidan Boissonneault
 * @file model-pointer-controller.test.ts
 * @purpose Tests model pointer controller behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ModelPointerController } from '../../src/scene/model-pointer-controller.js';
import type { ModelHit } from '../../src/scene/model-hit-testing.js';

const HIT: ModelHit = {
  meshIndex: 0,
  triangleIndex: 0,
  topologyId: 'face',
  ownerEntityId: 'body',
  semanticTargetIds: [],
  partEntityId: 'part',
  point: [0, 0, 0],
};

describe('model pointer controller', () => {
  it('hovers and activates primary clicks plus keyboard Enter', () => {
    const canvas = new FakeCanvas();
    const activated = vi.fn();
    const hovered = vi.fn();
    const controller = createController(canvas);
    controller.setCallbacks({ onHover: hovered, onActivate: activated });

    canvas.emit('pointermove', pointer({ clientX: 40, clientY: 25 }));
    canvas.emit('pointerdown', pointer({ clientX: 40, clientY: 25 }));
    canvas.emit('pointerup', pointer({ clientX: 42, clientY: 27 }));
    canvas.emit('keydown', { key: 'Enter', preventDefault: vi.fn() });

    expect(hovered).toHaveBeenLastCalledWith(HIT, { x: 30, y: 5 });
    expect(activated).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it('rejects drags, modifiers, mismatched pointers, and cancellation', () => {
    const canvas = new FakeCanvas();
    const activated = vi.fn();
    const controller = createController(canvas);
    controller.setCallbacks({ onActivate: activated });

    canvas.emit('pointerdown', pointer({ pointerId: 1 }));
    canvas.emit('pointermove', pointer({ pointerId: 1, clientX: 10 }));
    canvas.emit('pointerup', pointer({ pointerId: 1, clientX: 10 }));
    canvas.emit('pointerdown', pointer({ pointerId: 2, ctrlKey: true }));
    canvas.emit('pointerup', pointer({ pointerId: 2, ctrlKey: true }));
    canvas.emit('pointerdown', pointer({ pointerId: 3 }));
    canvas.emit('pointerup', pointer({ pointerId: 4 }));
    canvas.emit('pointerdown', pointer({ pointerId: 5 }));
    canvas.emit('pointercancel', pointer({ pointerId: 5 }));
    canvas.emit('pointerup', pointer({ pointerId: 5 }));

    expect(activated).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('coalesces rapid pointer moves and cancels queued work on leave or dispose', () => {
    const canvas = new FakeCanvas();
    const scheduler = new FakeFrameScheduler();
    const hitTest = vi.fn(() => HIT);
    const hovered = vi.fn();
    const controller = new ModelPointerController(
      canvas as unknown as HTMLCanvasElement,
      new THREE.Camera(),
      () => [],
      () => null,
      hitTest,
      scheduler,
    );
    controller.setCallbacks({ onHover: hovered });

    canvas.emit('pointermove', pointer({ clientX: 20, clientY: 30 }));
    canvas.emit('pointermove', pointer({ clientX: 60, clientY: 70 }));
    expect(hitTest).not.toHaveBeenCalled();
    scheduler.flush();
    expect(hitTest).toHaveBeenCalledOnce();
    expect(hitTest).toHaveBeenCalledWith(60, 70);

    canvas.emit('pointermove', pointer({ clientX: 80, clientY: 90 }));
    canvas.emit('pointerleave', { relatedTarget: null });
    scheduler.flush();
    expect(hitTest).toHaveBeenCalledOnce();
    expect(hovered).toHaveBeenLastCalledWith(null, null);

    canvas.emit('pointermove', pointer());
    controller.dispose();
    scheduler.flush();
    expect(hitTest).toHaveBeenCalledOnce();
  });
});

/**
 * Creates controller with the supplied values.
 */
function createController(canvas: FakeCanvas): ModelPointerController {
  return new ModelPointerController(
    canvas as unknown as HTMLCanvasElement,
    new THREE.Camera(),
    () => [],
    () => null,
    () => HIT,
  );
}

/**
 * Handles pointer in the scene flow.
 */
function pointer(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

/**
 * Owns `FakeCanvas` state and behavior for the scene layer.
 */
class FakeCanvas {
  tabIndex = -1;
  private readonly listeners = new Map<string, EventListener[]>();

  /**
   * Adds event listener to its owning collection.
   */
  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  /**
   * Removes event listener from its owning collection.
   */
  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (candidate) => candidate !== listener,
      ),
    );
  }

  /**
   * Removes attribute from its owning collection.
   */
  removeAttribute(): void {}
  /**
   * Handles dispatch event in the scene flow.
   */
  dispatchEvent(): boolean {
    return true;
  }
  /**
   * Returns bounding client rect from the supplied input.
   */
  getBoundingClientRect(): Pick<DOMRect, 'left' | 'top'> {
    return { left: 10, top: 20 };
  }

  /**
   * Emits the result into the current output.
   */
  emit(type: string, event: Record<string, unknown>): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as unknown as Event);
    }
  }
}

/**
 * Owns `FakeFrameScheduler` state and behavior for the scene layer.
 */
class FakeFrameScheduler {
  private nextId = 0;
  private readonly callbacks = new Map<number, () => void>();

  /**
   * Handles request in the scene flow.
   */
  request(callback: () => void): number {
    const id = ++this.nextId;
    this.callbacks.set(id, callback);
    return id;
  }

  /**
   * Cancels and restores the prior state.
   */
  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  /**
   * Flushes pending to its owning output.
   */
  flush(): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback());
  }
}
