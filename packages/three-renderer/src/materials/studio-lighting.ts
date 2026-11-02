/**
 * @author Aidan Boissonneault
 * @file studio-lighting.ts
 * @purpose Provides studio lighting behavior for the materials in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { RenderingStyle } from './materials.js';

/**
 * Rendering style settings, including environment, tone mapping, tone mapping exposure, shadows
 * enabled, and hemisphere intensity.
 */
type RenderingStyleSettings = {
  environment: THREE.Texture | null;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  shadowsEnabled: boolean;
  hemisphereIntensity: number;
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
};

/**
 * Handles rendering style settings in the materials flow.
 */
function renderingStyleSettings(
  style: RenderingStyle,
  environmentTarget: THREE.WebGLRenderTarget | null,
): RenderingStyleSettings {
  if (style === 'realism') {
    return {
      environment: environmentTarget?.texture ?? null,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.04,
      shadowsEnabled: true,
      hemisphereIntensity: 0.92,
      keyIntensity: 2.45,
      fillIntensity: 0.78,
      rimIntensity: 1.1,
    };
  }
  return {
    environment: null,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    shadowsEnabled: false,
    hemisphereIntensity: 1.6,
    keyIntensity: 1.05,
    fillIntensity: 0.95,
    rimIntensity: 0.34,
  };
}

/**
 * Owns the viewport's studio lighting, environment map, and contact shadow.
 *
 * Lighting state changes with bounds and rendering style, but it is independent
 * from mesh creation, camera control, and gizmo syncing.
 */
export class StudioLighting {
  private hemisphereLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private readonly studioLightTarget = new THREE.Object3D();
  private readonly contactShadow = this.createContactShadow();
  private environmentTarget: THREE.WebGLRenderTarget | null = null;

  /**
   * Initializes the `StudioLighting` instance with the values supplied by its caller.
   */
  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    this.scene.add(this.studioLightTarget);
    this.installStudioEnvironment();
    this.setupStudioLighting();
    this.scene.add(this.contactShadow);
  }

  /**
   * Applies rendering style to the supplied state or geometry.
   */
  applyRenderingStyle(style: RenderingStyle): void {
    const settings = renderingStyleSettings(style, this.environmentTarget);
    this.scene.environment = settings.environment;
    this.renderer.toneMapping = settings.toneMapping;
    this.renderer.toneMappingExposure = settings.toneMappingExposure;
    this.renderer.shadowMap.enabled = settings.shadowsEnabled;

    this.hemisphereLight.intensity = settings.hemisphereIntensity;
    this.keyLight.intensity = settings.keyIntensity;
    this.fillLight.intensity = settings.fillIntensity;
    this.rimLight.intensity = settings.rimIntensity;
    this.keyLight.castShadow = settings.shadowsEnabled;
    this.contactShadow.visible =
      settings.shadowsEnabled && this.contactShadow.visible;
  }

  /**
   * Updates bounds while preserving unrelated state.
   */
  updateBounds(meshGroup: THREE.Group, style: RenderingStyle): void {
    const box = new THREE.Box3().setFromObject(meshGroup);
    if (box.isEmpty()) {
      this.contactShadow.visible = false;
      this.studioLightTarget.position.set(0, 0, 0);
      return;
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const footprint = Math.max(size.x, size.y, 40);
    const radius = Math.max(size.length() * 0.5, footprint, 80);
    const shadowDrop = Math.max(radius * 0.002, 0.02);

    this.contactShadow.visible = style === 'realism';
    this.contactShadow.position.set(center.x, center.y, box.min.z - shadowDrop);
    this.contactShadow.scale.set(footprint * 1.7, footprint * 1.7, 1);

    this.studioLightTarget.position.copy(center);
    this.keyLight.position
      .copy(center)
      .add(new THREE.Vector3(-radius * 1.35, -radius * 1.2, radius * 1.65));
    this.fillLight.position
      .copy(center)
      .add(new THREE.Vector3(radius * 1.55, radius * 1.1, radius * 1.05));
    this.rimLight.position
      .copy(center)
      .add(new THREE.Vector3(radius * 0.55, radius * 1.6, radius * 1.35));

    const shadowCamera = this.keyLight.shadow.camera;
    const shadowExtent = Math.max(radius * 1.25, 120);
    shadowCamera.left = -shadowExtent;
    shadowCamera.right = shadowExtent;
    shadowCamera.top = shadowExtent;
    shadowCamera.bottom = -shadowExtent;
    shadowCamera.near = 1;
    shadowCamera.far = radius * 5;
    shadowCamera.updateProjectionMatrix();
    this.keyLight.shadow.needsUpdate = true;
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.contactShadow.geometry.dispose();
    this.contactShadow.material.dispose();
  }

  /**
   * Installs studio environment and registers its resources.
   */
  private installStudioEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment(this.renderer);
    this.environmentTarget = pmrem.fromScene(environment, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    environment.dispose();
    pmrem.dispose();
  }

  /**
   * Handles setup studio lighting in the materials flow.
   */
  private setupStudioLighting(): void {
    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xd2c4ad, 0.92);
    this.scene.add(this.hemisphereLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.45);
    this.keyLight.position.set(-260, -320, 420);
    this.keyLight.target = this.studioLightTarget;
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.00012;
    this.keyLight.shadow.normalBias = 0.035;
    this.keyLight.shadow.radius = 4;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xdcecff, 0.78);
    this.fillLight.position.set(360, 260, 240);
    this.fillLight.target = this.studioLightTarget;
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xfff1d6, 1.1);
    this.rimLight.position.set(120, 360, 320);
    this.rimLight.target = this.studioLightTarget;
    this.scene.add(this.rimLight);
  }

  /**
   * Creates contact shadow with the supplied values.
   */
  private createContactShadow(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.ShadowMaterial
  > {
    const material = new THREE.ShadowMaterial({
      color: 0x111827,
      opacity: 0.18,
      transparent: true,
    });
    material.depthWrite = false;

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    shadow.receiveShadow = true;
    shadow.visible = false;
    return shadow;
  }
}
