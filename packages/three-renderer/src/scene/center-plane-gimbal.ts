/**
 * @author Aidan Boissonneault
 * @file center-plane-gimbal.ts
 * @purpose Provides center plane gimbal behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';

/**
 * Accepted values for center plane gimbal style are 'planes', 'triad', and 'minimal'.
 */
export type CenterPlaneGimbalStyle = 'planes' | 'triad' | 'minimal';

/**
 * Options for center plane gimbal, including style, scale, and opacity.
 */
export type CenterPlaneGimbalOptions = {
  style: CenterPlaneGimbalStyle;
  scale: number;
  opacity: number;
};

export const DEFAULT_CENTER_PLANE_GIMBAL_OPTIONS: CenterPlaneGimbalOptions = {
  style: 'planes',
  scale: 1,
  opacity: 1,
};

const PARTS = {
  planes: 'axis-viewer-planes',
  planeLabels: 'axis-viewer-plane-labels',
  axisLabels: 'axis-viewer-axis-labels',
  axes: 'axis-viewer-axes',
  origin: 'axis-viewer-origin',
} as const;

/**
 * Gimbal presentation, including planes, plane labels, axis labels, axes, and origin.
 */
type GimbalPresentation = {
  planes: boolean;
  planeLabels: boolean;
  axisLabels: boolean;
  axes: boolean;
  origin: boolean;
  scale: number;
  opacity: number;
};

/**
 * Center axis endpoints, including x, y, and z.
 */
export type CenterAxisEndpoints = {
  x: readonly [number, number, number];
  y: readonly [number, number, number];
  z: readonly [number, number, number];
};

/** Uses the same +X, -Y, +Z convention as the ViewCube and named camera faces. */
export function centerPlaneAxisEndpoints(half: number): CenterAxisEndpoints {
  return {
    x: [half, 0, 0],
    y: [0, -half, 0],
    z: [0, 0, half],
  };
}

/** Resolves the visible parts for each center-axis viewer style. */
export function centerPlaneGimbalPresentation(
  options: CenterPlaneGimbalOptions,
): GimbalPresentation {
  return {
    planes: options.style === 'planes',
    planeLabels: options.style === 'planes',
    axisLabels: options.style === 'triad',
    axes: true,
    origin: options.style !== 'minimal',
    scale: options.scale,
    opacity: options.opacity,
  };
}

/**
 * Constructs label sprite from the supplied values.
 */
function makeLabelSprite(
  label: string,
  color: string,
  width = 22,
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 104, 40, 9);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = '700 26px Segoe UI, system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 33);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = opacityMaterial(
    new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    1,
  );
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, width / 2, 1);
  return sprite;
}

/**
 * Handles opacity material in the scene flow.
 */
function opacityMaterial<T extends THREE.Material>(
  material: T,
  opacity: number,
): T {
  material.transparent = true;
  material.opacity = opacity;
  material.userData.axisViewerBaseOpacity = opacity;
  return material;
}

/**
 * Handles named group in the scene flow.
 */
function namedGroup(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

/**
 * Builds the configurable origin-plane widget used in the 3D viewport.
 * Plane, triad, and minimal presentations share geometry and live opacity/scale
 * updates, so one scene asset owns their construction and style switching.
 */
export function createCenterPlaneGimbal(
  options: CenterPlaneGimbalOptions = DEFAULT_CENTER_PLANE_GIMBAL_OPTIONS,
): THREE.Group {
  const group = new THREE.Group();
  const size = 58;
  const half = size / 2;
  const planes = namedGroup(PARTS.planes);
  const planeLabels = namedGroup(PARTS.planeLabels);
  const axisLabels = namedGroup(PARTS.axisLabels);
  const axes = namedGroup(PARTS.axes);
  const origin = namedGroup(PARTS.origin);

  const planeDefinitions = [
    {
      label: 'XY',
      color: '#2f76c8',
      rotation: new THREE.Euler(0, 0, 0),
      labelPos: new THREE.Vector3(half * 0.6, half * 0.6, 1.2),
    },
    {
      label: 'XZ',
      color: '#269b54',
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      labelPos: new THREE.Vector3(half * 0.6, -1.2, half * 0.6),
    },
    {
      label: 'YZ',
      color: '#d63b2f',
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      labelPos: new THREE.Vector3(1.2, half * 0.6, half * 0.6),
    },
  ];

  for (const plane of planeDefinitions) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      opacityMaterial(
        new THREE.MeshBasicMaterial({
          color: plane.color,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        0.07,
      ),
    );
    mesh.rotation.copy(plane.rotation);
    planes.add(mesh);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size)),
      opacityMaterial(
        new THREE.LineBasicMaterial({ color: plane.color, depthWrite: false }),
        0.34,
      ),
    );
    edge.rotation.copy(plane.rotation);
    planes.add(edge);

    const label = makeLabelSprite(plane.label, plane.color);
    label.position.copy(plane.labelPos);
    planeLabels.add(label);
  }

  axes.add(createAxes(half));
  const endpoints = centerPlaneAxisEndpoints(half);
  for (const axis of [
    { label: 'X', color: '#d63b2f', endpoint: endpoints.x },
    { label: 'Y', color: '#269b54', endpoint: endpoints.y },
    { label: 'Z', color: '#2f76c8', endpoint: endpoints.z },
  ] as const) {
    const label = makeLabelSprite(axis.label, axis.color, 12);
    label.position
      .set(axis.endpoint[0], axis.endpoint[1], axis.endpoint[2])
      .multiplyScalar((half + 6) / half);
    axisLabels.add(label);
  }

  origin.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 18, 12),
      opacityMaterial(new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.92),
    ),
  );

  group.add(planes, planeLabels, axes, axisLabels, origin);
  applyCenterPlaneGimbalOptions(group, options);
  return group;
}

/**
 * Creates axes with the supplied values.
 */
function createAxes(half: number): THREE.LineSegments {
  const endpoints = centerPlaneAxisEndpoints(half);
  const positions = [
    0,
    0,
    0,
    ...endpoints.x,
    0,
    0,
    0,
    ...endpoints.y,
    0,
    0,
    0,
    ...endpoints.z,
  ];
  const colors = [
    0.84, 0.23, 0.18, 0.84, 0.23, 0.18, 0.15, 0.61, 0.33, 0.15, 0.61, 0.33,
    0.18, 0.46, 0.78, 0.18, 0.46, 0.78,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.LineSegments(
    geometry,
    opacityMaterial(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        depthWrite: false,
      }),
      0.64,
    ),
  );
}

/** Applies live style, scale, and opacity changes without rebuilding geometry. */
export function applyCenterPlaneGimbalOptions(
  group: THREE.Group,
  options: CenterPlaneGimbalOptions,
): void {
  const presentation = centerPlaneGimbalPresentation(options);
  group.scale.setScalar(presentation.scale);
  group.getObjectByName(PARTS.planes)!.visible = presentation.planes;
  group.getObjectByName(PARTS.planeLabels)!.visible = presentation.planeLabels;
  group.getObjectByName(PARTS.axisLabels)!.visible = presentation.axisLabels;
  group.getObjectByName(PARTS.axes)!.visible = presentation.axes;
  group.getObjectByName(PARTS.origin)!.visible = presentation.origin;
  group.traverse((object) => applyObjectOpacity(object, presentation.opacity));
}

/**
 * Applies object opacity to the supplied state or geometry.
 */
function applyObjectOpacity(object: THREE.Object3D, opacity: number): void {
  const mesh = object as THREE.Mesh;
  if (!mesh.material) return;
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  for (const material of materials) {
    const base = material.userData.axisViewerBaseOpacity;
    if (typeof base === 'number') material.opacity = base * opacity;
  }
}
