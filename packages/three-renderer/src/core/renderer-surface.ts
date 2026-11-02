/**
 * @author Aidan Boissonneault
 * @file renderer-surface.ts
 * @purpose Provides renderer surface behavior for the core in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Renderer surface, including scene, camera, and renderer.
 */
export interface RendererSurface {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

/**
 * Creates the WebGL scene, camera, and renderer owned by a BushSCAD viewport.
 * Keeping graphics-platform initialization together leaves the public
 * renderer focused on coordinating model, interaction, and navigation systems.
 */
export function createRendererSurface(
  canvas: HTMLCanvasElement,
): RendererSurface {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    10000,
  );
  camera.position.set(200, -200, 150);
  camera.up.set(0, 0, 1);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return { scene, camera, renderer };
}

/** Creates the viewport's standard rotate/pan control mapping. */
export function createViewportControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.update();
  return controls;
}
