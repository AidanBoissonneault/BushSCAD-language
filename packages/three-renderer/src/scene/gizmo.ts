/**
 * @author Aidan Boissonneault
 * @file gizmo.ts
 * @purpose Provides gizmo behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import {
  AXES,
  CORNERS,
  EDGES,
  FACE_LABELS,
  invisMat,
  makeAxisTexture,
  makeFaceTexture,
} from './gizmo-assets.js';
import {
  alignPlaneToNormal,
  directionKey,
  snapPreset,
} from './gizmo-orientation.js';

/**
 * Gizmo pick, including hit and dir.
 */
type GizmoPick = {
  hit: THREE.Intersection;
  dir: THREE.Vector3;
};

/**
 * Releases the object held by this object.
 */
function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}

/**
 * Owns `GizmoRenderer` state and behavior for the scene layer.
 */
export class GizmoRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private cube: THREE.Mesh;
  private hoverGroup = new THREE.Group();
  private hitTargets: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private currentDir = new THREE.Vector3(1, -1, 0.75).normalize();
  private drag: {
    pointerId: number;
    x: number;
    y: number;
    dir: THREE.Vector3;
    up: THREE.Vector3;
    moved: boolean;
  } | null = null;
  private hoverKey = '';

  private readonly onPointerDown = (e: PointerEvent): void =>
    this.handlePointerDown(e);
  private readonly onPointerMove = (e: PointerEvent): void =>
    this.handlePointerMove(e);
  private readonly onPointerUp = (e: PointerEvent): void =>
    this.handlePointerUp(e);
  private readonly onPointerLeave = (): void => this.handlePointerLeave();

  /**
   * Initializes the `GizmoRenderer` instance with the values supplied by its caller.
   */
  constructor(
    canvas: HTMLCanvasElement,
    private onSnap: (dir: THREE.Vector3) => void,
    private onOrbit: (dir: THREE.Vector3) => void,
  ) {
    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.OrthographicCamera(
      -1.08,
      1.08,
      1.08,
      -1.08,
      0.1,
      100,
    );
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.resize();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.86));
    const key = new THREE.DirectionalLight(0xffffff, 1.45);
    key.position.set(3, -4, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x95b8e6, 0.34);
    fill.position.set(-4, 5, -2);
    this.scene.add(fill);

    const cubeGeo = new RoundedBoxGeometry(1, 1, 1, 8, 0.08);
    const cubeMat = new THREE.MeshPhongMaterial({
      color: 0xd9dee5,
      specular: 0xffffff,
      shininess: 72,
    });
    this.cube = new THREE.Mesh(cubeGeo, cubeMat);
    this.hitTargets.push(this.cube);
    this.scene.add(this.cube);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
      new THREE.LineBasicMaterial({
        color: 0x7f8996,
        transparent: true,
        opacity: 0.72,
      }),
    );
    this.scene.add(outline);

    for (const f of FACE_LABELS) {
      const sticker = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 0.78),
        new THREE.MeshBasicMaterial({
          map: makeFaceTexture(f.label, f.textRotation),
          transparent: true,
          depthTest: true,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      sticker.position.copy(f.n.clone().multiplyScalar(0.506));
      alignPlaneToNormal(sticker, f.n);
      this.scene.add(sticker);
    }

    this.addAxisTriad();
    this.addHitZones();
    this.scene.add(this.hoverGroup);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  // fallow-ignore-next-line unused-class-member
  /**
   * Synchronizes camera with its current source.
   */
  syncCamera(mainCam: THREE.Camera, target: THREE.Vector3): void {
    const dir = mainCam.position.clone().sub(target).normalize();
    this.currentDir.copy(dir);
    this.camera.position.copy(dir.multiplyScalar(5));
    this.camera.up.copy(mainCam.up);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Handles render in the scene flow.
   */
  render(): void {
    this.resize();
    this.renderer.render(this.scene, this.camera);
  }

  // fallow-ignore-next-line unused-class-member
  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.renderer.dispose();
  }

  /**
   * Adds axis triad to its owning collection.
   */
  private addAxisTriad(): void {
    const positions: number[] = [];
    const colors: number[] = [];
    for (const axis of AXES) {
      positions.push(
        0,
        0,
        0,
        axis.dir.x * 0.84,
        axis.dir.y * 0.84,
        axis.dir.z * 0.84,
      );
      const c = new THREE.Color(axis.color);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeAxisTexture(axis.label, axis.color),
          transparent: true,
          depthTest: false,
        }),
      );
      sprite.position.copy(axis.dir.clone().multiplyScalar(1.02));
      sprite.scale.set(0.22, 0.22, 0.22);
      this.scene.add(sprite);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.scene.add(
      new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ vertexColors: true }),
      ),
    );
  }

  /**
   * Adds hit zones to its owning collection.
   */
  private addHitZones(): void {
    for (const dir of CORNERS) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 8, 8),
        invisMat(),
      );
      m.position.copy(dir.clone().multiplyScalar(0.62));
      m.userData.gizmoDir = dir;
      this.hitTargets.push(m);
      this.scene.add(m);
    }

    for (const dir of EDGES) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        invisMat(),
      );
      m.position.copy(dir.clone().multiplyScalar(0.59));
      m.userData.gizmoDir = dir;
      this.hitTargets.push(m);
      this.scene.add(m);
    }
  }

  /**
   * Handles resize in the scene flow.
   */
  private resize(): void {
    const canvas = this.renderer.domElement;
    const width = Math.max(1, canvas.clientWidth || 150);
    const height = Math.max(1, canvas.clientHeight || 150);
    const dpr = window.devicePixelRatio || 1;
    if (
      canvas.width !== Math.floor(width * dpr) ||
      canvas.height !== Math.floor(height * dpr)
    ) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(width, height, false);
    }
  }

  /**
   * Handles pick in the scene flow.
   */
  private pick(e: PointerEvent): GizmoPick | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hits = this.raycaster.intersectObjects(this.hitTargets, false);
    const hit = hits[0];
    if (!hit) return null;

    const preset =
      hit.object.userData.gizmoDir instanceof THREE.Vector3
        ? hit.object.userData.gizmoDir.clone()
        : snapPreset(hit.point);
    return { hit, dir: preset.normalize() };
  }

  /**
   * Handles pointer down in the current scene flow.
   */
  private handlePointerDown(e: PointerEvent): void {
    const pick = this.pick(e);
    if (!pick) return;
    this.drag = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dir: this.currentDir.clone(),
      up: this.camera.up.clone().normalize(),
      moved: false,
    };
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.setHover(pick.dir);
    e.preventDefault();
  }

  /**
   * Handles pointer move in the current scene flow.
   */
  private handlePointerMove(e: PointerEvent): void {
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 3) this.drag.moved = true;
      if (this.drag.moved) this.onOrbit(this.dragDirection(dx, dy));
      return;
    }

    const pick = this.pick(e);
    this.renderer.domElement.style.cursor = pick ? 'grab' : 'default';
    this.setHover(pick?.dir ?? null);
  }

  /**
   * Handles pointer up in the current scene flow.
   */
  private handlePointerUp(e: PointerEvent): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.renderer.domElement.releasePointerCapture(e.pointerId);

    if (!drag.moved) {
      const pick = this.pick(e);
      if (pick) this.onSnap(pick.dir);
    }
  }

  /**
   * Handles pointer leave in the current scene flow.
   */
  private handlePointerLeave(): void {
    if (!this.drag) {
      this.renderer.domElement.style.cursor = 'default';
      this.setHover(null);
    }
  }

  /**
   * Handles drag direction in the scene flow.
   */
  private dragDirection(dx: number, dy: number): THREE.Vector3 {
    const yaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -dx * 0.012,
    );
    const yawed = this.drag!.dir.clone().applyQuaternion(yaw).normalize();
    const right = new THREE.Vector3()
      .crossVectors(this.drag!.up, yawed)
      .normalize();
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    const pitch = new THREE.Quaternion().setFromAxisAngle(right, -dy * 0.012);
    return yawed.applyQuaternion(pitch).normalize();
  }

  /**
   * Sets hover on the owning state.
   */
  private setHover(dir: THREE.Vector3 | null): void {
    const key = directionKey(dir);
    if (key === this.hoverKey) return;
    this.hoverKey = key;

    for (const child of [...this.hoverGroup.children]) {
      this.hoverGroup.remove(child);
      disposeObject(child);
    }
    if (!dir) return;

    const snapped = snapPreset(dir);
    const activeAxes = [snapped.x, snapped.y, snapped.z].filter(
      (v) => Math.abs(v) > 0.01,
    ).length;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2f80ed,
      transparent: true,
      opacity: activeAxes === 1 ? 0.22 : 0.52,
      depthTest: false,
    });

    if (activeAxes === 1) {
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), mat);
      marker.position.copy(snapped.clone().multiplyScalar(0.512));
      alignPlaneToNormal(marker, snapped);
      this.hoverGroup.add(marker);
    } else {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(activeAxes === 2 ? 0.12 : 0.15, 16, 16),
        mat,
      );
      marker.position.copy(
        snapped.clone().multiplyScalar(activeAxes === 2 ? 0.61 : 0.64),
      );
      this.hoverGroup.add(marker);
    }
  }
}
