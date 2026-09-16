import * as THREE from "three";

const fresnelVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fresnelFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEdgeColor;
  uniform float uOpacity;
  uniform float uEdgeStrength;
  uniform float uNightGlow;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    float facing = max(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0);
    float fresnel = pow(1.0 - facing, uEdgeStrength);
    vec3 colour = mix(uColor, uEdgeColor, fresnel * 0.82) + uEdgeColor * uNightGlow;
    gl_FragColor = vec4(colour, uOpacity * (0.42 + fresnel * 0.58));
  }
`;

export function createFresnelGlassMaterial({
  color = 0x8fd5e5,
  edgeColor = 0xe9fcff,
  opacity = 0.52,
  edgeStrength = 2.6,
  nightGlow = 0,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uEdgeColor: { value: new THREE.Color(edgeColor) },
      uOpacity: { value: opacity },
      uEdgeStrength: { value: edgeStrength },
      uNightGlow: { value: nightGlow },
    },
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

const flowVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    float band = sin((vUv.x - uTime * uSpeed) * 24.0) * 0.5 + 0.5;
    float pulse = smoothstep(0.30, 0.82, band);
    float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(0.0, 0.18, 1.0 - vUv.y);
    float alpha = mix(0.28, 0.92, pulse) * edge * uIntensity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createFlowMaterial({ color = 0x6ed4b5, speed = 0.42, intensity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uIntensity: { value: intensity },
    },
    vertexShader: flowVertexShader,
    fragmentShader: flowFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
