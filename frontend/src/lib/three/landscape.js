import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import { disposeObject3D } from "@/lib/three/scene";

const LANDSCAPE_ASSETS = [
  {
    url: "/models/3dassets/pine-tree.glb",
    placements: [
      { position: [7.2, 0, -5.4], scale: 0.48, rotation: 0.4 },
      { position: [-7.8, 0, 4.8], scale: 0.36, rotation: -0.7 },
      { position: [4.8, 0, 7.1], scale: 0.3, rotation: 1.2 },
    ],
  },
  {
    url: "/models/3dassets/apple-tree.glb",
    placements: [
      { position: [-6.8, 0, -5.6], scale: 0.45, rotation: 0.7 },
      { position: [8.1, 0, 3.7], scale: 0.32, rotation: -0.45 },
    ],
  },
];

export function addLandscapeContext(scene) {
  const group = new THREE.Group();
  group.name = "cc0-landscape-context";
  scene.add(group);
  const loader = new GLTFLoader();
  let disposed = false;

  LANDSCAPE_ASSETS.forEach(({ url, placements }) => {
    loader.load(url, (gltf) => {
      if (disposed) {
        disposeObject3D(gltf.scene);
        return;
      }
      placements.forEach(({ position, scale, rotation }) => {
        const asset = gltf.scene.clone(true);
        asset.position.set(...position);
        asset.scale.setScalar(scale);
        asset.rotation.y = rotation;
        asset.traverse((item) => {
          if (!item.isMesh) return;
          item.castShadow = true;
          item.receiveShadow = true;
        });
        group.add(asset);
      });
    });
  });

  return () => {
    disposed = true;
    scene.remove(group);
    disposeObject3D(group);
  };
}
