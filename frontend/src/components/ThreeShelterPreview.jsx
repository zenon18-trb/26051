"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const orientationAngles = { North: 0, East: Math.PI / 2, South: Math.PI, West: -Math.PI / 2 };

export function ThreeShelterPreview({ length, width, height, orientation, reduceMotion = false }) {
  const mountRef = useRef(null);
  const [nightMode, setNightMode] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(nightMode ? 0x101914 : 0xe8ebdf, 10, 31);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const scale = 5.2 / Math.max(length, width, height, 1);
    const shelter = new THREE.Group();
    shelter.rotation.y = orientationAngles[orientation] ?? 0;
    scene.add(shelter);

    const ambient = new THREE.HemisphereLight(nightMode ? 0x8ca6a1 : 0xffffff, nightMode ? 0x07100b : 0xa9b5a2, nightMode ? 1.15 : 1.65);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(nightMode ? 0xf4ba7a : 0xffffff, nightMode ? 2.2 : 2.6);
    key.position.set(6, 10, 7);
    key.castShadow = true;
    scene.add(key);
    const accent = new THREE.PointLight(nightMode ? 0xd95c31 : 0x416a4c, nightMode ? 18 : 8, 15);
    accent.position.set(-4, 3, -3);
    scene.add(accent);

    const L = length * scale;
    const W = width * scale;
    const H = height * scale;
    const faceMaterials = [
      new THREE.MeshPhysicalMaterial({ color: 0x567866, metalness: 0.18, roughness: 0.56 }),
      new THREE.MeshPhysicalMaterial({ color: 0x314d3e, metalness: 0.24, roughness: 0.48 }),
      new THREE.MeshPhysicalMaterial({ color: 0x89a478, metalness: 0.16, roughness: 0.4, clearcoat: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0x1e3026, roughness: 0.9 }),
      new THREE.MeshPhysicalMaterial({ color: 0x6d967c, metalness: 0.15, roughness: 0.5 }),
      new THREE.MeshPhysicalMaterial({ color: 0x456652, metalness: 0.18, roughness: 0.58 }),
    ];
    const house = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), faceMaterials);
    house.position.y = H / 2;
    house.castShadow = true;
    house.receiveShadow = true;
    shelter.add(house);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(house.geometry),
      new THREE.LineBasicMaterial({ color: nightMode ? 0xf4ba7a : 0x203b2d, transparent: true, opacity: 0.86 })
    );
    edges.position.copy(house.position);
    shelter.add(edges);

    const roofScan = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 0.94, W * 0.94),
      new THREE.MeshBasicMaterial({ color: 0xf4ba7a, transparent: true, opacity: nightMode ? 0.18 : 0.11, side: THREE.DoubleSide, depthWrite: false })
    );
    roofScan.rotation.x = -Math.PI / 2;
    roofScan.position.y = H + 0.012;
    shelter.add(roofScan);

    const scanLine = new THREE.Mesh(
      new THREE.BoxGeometry(L * 0.96, 0.025, 0.035),
      new THREE.MeshBasicMaterial({ color: 0xfffaf0, transparent: true, opacity: 0.8 })
    );
    scanLine.position.y = H + 0.04;
    shelter.add(scanLine);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.MeshStandardMaterial({ color: nightMode ? 0x0b120e : 0xdce2d5, metalness: 0.1, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(30, 30, nightMode ? 0x5c9673 : 0x95a890, nightMode ? 0x284734 : 0xc4cec0);
    grid.position.y = 0.006;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = nightMode ? 0.3 : 0.5; });
    scene.add(grid);

    const orbit = { theta: 0.62, phi: 1.08, radius: 11, target: new THREE.Vector3(0, H * 0.42, 0) };
    const updateCamera = () => {
      const phi = Math.max(0.28, Math.min(Math.PI / 2 - 0.04, orbit.phi));
      camera.position.set(
        orbit.target.x + orbit.radius * Math.sin(phi) * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * Math.cos(phi),
        orbit.target.z + orbit.radius * Math.sin(phi) * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.target);
    };
    updateCamera();

    const pointer = { active: false, x: 0, y: 0 };
    const onPointerDown = (event) => { pointer.active = true; pointer.x = event.clientX; pointer.y = event.clientY; renderer.domElement.setPointerCapture?.(event.pointerId); };
    const onPointerMove = (event) => {
      if (!pointer.active) return;
      orbit.theta -= (event.clientX - pointer.x) * 0.009;
      orbit.phi -= (event.clientY - pointer.y) * 0.009;
      pointer.x = event.clientX; pointer.y = event.clientY;
      updateCamera();
    };
    const onPointerUp = () => { pointer.active = false; };
    const onWheel = (event) => { event.preventDefault(); orbit.radius = Math.max(7, Math.min(17, orbit.radius + event.deltaY * 0.012)); updateCamera(); };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const { width: canvasWidth, height: canvasHeight } = mount.getBoundingClientRect();
      if (!canvasWidth || !canvasHeight) return;
      camera.aspect = canvasWidth / canvasHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasWidth, canvasHeight, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frameId;
    const render = (time) => {
      frameId = requestAnimationFrame(render);
      if (!reduceMotion && !pointer.active) shelter.rotation.y = (orientationAngles[orientation] ?? 0) + Math.sin(time * 0.00025) * 0.055;
      if (!reduceMotion) {
        roofScan.material.opacity = (nightMode ? 0.15 : 0.09) + (Math.sin(time * 0.002) + 1) * 0.04;
        scanLine.position.z = Math.sin(time * 0.0011) * W * 0.43;
      }
      renderer.render(scene, camera);
    };
    render(0);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      house.geometry.dispose();
      faceMaterials.forEach((material) => material.dispose());
      edges.geometry.dispose(); edges.material.dispose();
      roofScan.geometry.dispose(); roofScan.material.dispose();
      scanLine.geometry.dispose(); scanLine.material.dispose();
      ground.geometry.dispose(); ground.material.dispose();
      grid.geometry.dispose(); gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [length, width, height, orientation, nightMode, reduceMotion]);

  return (
    <div className="three-shelter" aria-label="Interactive three-dimensional shelter preview">
      <div ref={mountRef} className="three-shelter-canvas" />
      <div className="three-shelter-topline"><span><i /> WEBGL LIVE</span><button type="button" onClick={() => setNightMode((value) => !value)}>{nightMode ? "Night mode" : "Day mode"}</button></div>
      <div className="three-shelter-hint">DRAG TO ORBIT · SCROLL TO ZOOM</div>
    </div>
  );
}
