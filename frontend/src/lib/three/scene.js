import * as THREE from "three";

const surfacePresets = {
  wall: { roughness: 0.68, metalness: 0.04, clearcoat: 0.04 },
  roof: { roughness: 0.48, metalness: 0.16, clearcoat: 0.12 },
  frame: { roughness: 0.34, metalness: 0.5, clearcoat: 0.08 },
  ground: { roughness: 0.92, metalness: 0 },
  shell: { roughness: 0.38, metalness: 0.2, clearcoat: 0.08 },
};

export function createSurfaceMaterial(preset, options = {}) {
  const settings = surfacePresets[preset];
  if (!settings) throw new Error(`Unknown Three.js surface preset: ${preset}`);
  return new THREE.MeshPhysicalMaterial({ ...settings, ...options });
}

export function createSceneRenderer(mount) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);
  return renderer;
}

export function addLightingRig(scene, {
  nightMode = false,
  sunPosition = [6, 9, 6],
  daySunIntensity = 2.4,
  nightSunIntensity = 2,
} = {}) {
  const sky = new THREE.HemisphereLight(
    nightMode ? 0x78998b : 0xffffff,
    nightMode ? 0x07100b : 0xa8b59f,
    nightMode ? 1.1 : 1.6
  );
  const sun = new THREE.DirectionalLight(nightMode ? 0xf4ba7a : 0xffffff, nightMode ? nightSunIntensity : daySunIntensity);
  sun.position.set(...sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 30;
  sun.shadow.normalBias = 0.025;
  scene.add(sky, sun);
  return { sky, sun };
}

export function addContactShadow(scene, { size = 5.8, y = 0.011, nightMode = false } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: nightMode ? 0.22 : 0.16 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float uOpacity; varying vec2 vUv; void main() { float d = distance(vUv, vec2(.5)); float alpha = (1.0 - smoothstep(.12, .5, d)) * uOpacity; gl_FragColor = vec4(0.02, 0.05, 0.03, alpha); }",
    transparent: true,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.58), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = y;
  scene.add(shadow);
  return shadow;
}

export function observeRendererSize(mount, camera, renderer) {
  const resize = () => {
    const { width, height } = mount.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();
  return observer;
}

export function disposeObject3D(object) {
  object.traverse((item) => {
    item.geometry?.dispose();
    const materials = Array.isArray(item.material) ? item.material : [item.material];
    materials.filter(Boolean).forEach((material) => material.dispose());
  });
}
