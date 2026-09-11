"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const PALETTE = [0x9d7658, 0xe2bd5d, 0x8295a3, 0xb16a50, 0x6f9e73, 0xc6b398];

export function ThreeMaterialsPreview({ layers, materials, target, reduceMotion = false }) {
  const mountRef = useRef(null); const [nightMode, setNightMode] = useState(false);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(nightMode ? 0x0c1511 : 0xe7ebe0, 8, 26); const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    scene.add(new THREE.HemisphereLight(nightMode ? 0x78998b : 0xffffff, nightMode ? 0x07100b : 0xa8b59f, nightMode ? 1.05 : 1.55)); const sun = new THREE.DirectionalLight(nightMode ? 0xf4ba7a : 0xffffff, nightMode ? 2 : 2.25); sun.position.set(6, 8, 6); sun.castShadow = true; scene.add(sun);
    const stack = new THREE.Group(); scene.add(stack); const totalThickness = layers.reduce((sum, layer) => sum + layer.thickness_m, 0); const scale = 2.8 / Math.max(.04, totalThickness);
    let offset = -totalThickness * scale / 2;
    const layerMeshes = [];
    layers.forEach((layer, index) => { const material = materials.get(layer.material_id); const thickness = Math.max(.08, layer.thickness_m * scale); const color = PALETTE[index % PALETTE.length]; const meshMaterial = new THREE.MeshPhysicalMaterial({ color, roughness: material?.k && material.k < .1 ? .82 : .45, metalness: material?.category?.toLowerCase().includes("metal") ? .5 : .08, clearcoat: .15 }); const geometry = target === "wall" ? new THREE.BoxGeometry(thickness, 3.25, 3.8) : new THREE.BoxGeometry(4.8, thickness, 3.8); const mesh = new THREE.Mesh(geometry, meshMaterial); if (target === "wall") mesh.position.x = offset + thickness / 2; else mesh.position.y = 1.5 + offset + thickness / 2; mesh.castShadow = true; mesh.receiveShadow = true; stack.add(mesh); layerMeshes.push(mesh); offset += thickness; });
    const outline = new THREE.Box3().setFromObject(stack); const center = outline.getCenter(new THREE.Vector3()); stack.position.sub(center);
    const fluxGroup = new THREE.Group(); scene.add(fluxGroup);
    const fluxColor = new THREE.Color(target === "wall" ? 0xf4ba7a : 0xd95c31);
    const fluxMaterial = new THREE.MeshBasicMaterial({ color: fluxColor, transparent: true, opacity: .78 });
    const fluxLength = target === "wall" ? 5.8 : 4.8;
    [-.75, 0, .75].forEach((crossAxis) => {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, fluxLength, 8), fluxMaterial);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.085, .22, 8), fluxMaterial);
      if (target === "wall") { shaft.rotation.z = Math.PI / 2; shaft.position.set(0, crossAxis + 1.1, 2.25); tip.rotation.z = -Math.PI / 2; tip.position.set(fluxLength / 2, crossAxis + 1.1, 2.25); }
      else { shaft.position.set(crossAxis * 1.35, 0, 1.9); tip.position.set(crossAxis * 1.35, fluxLength / 2, 1.9); }
      fluxGroup.add(shaft, tip);
    });
    const glow = new THREE.PointLight(0xf4ba7a, nightMode ? 9 : 4, 10); glow.position.set(target === "wall" ? -2.6 : 0, 3, 2); scene.add(glow);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: nightMode ? 0x09100c : 0xdce1d6, roughness: .92 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground); const grid = new THREE.GridHelper(30, 30, nightMode ? 0x5c9673 : 0x93a890, nightMode ? 0x284734 : 0xc3ccc0); grid.position.y = .005; const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]; gridMaterials.forEach((m) => { m.transparent = true; m.opacity = nightMode ? .3 : .5; }); scene.add(grid);
    const orbit = { theta: .62, phi: 1.05, radius: 10.5, target: new THREE.Vector3(0, 1.25, 0) }; const cameraUpdate = () => { const p = Math.max(.3, Math.min(Math.PI / 2 - .04, orbit.phi)); camera.position.set(orbit.radius * Math.sin(p) * Math.sin(orbit.theta), orbit.target.y + orbit.radius * Math.cos(p), orbit.radius * Math.sin(p) * Math.cos(orbit.theta)); camera.lookAt(orbit.target); }; cameraUpdate(); const pointer = { active: false, x: 0, y: 0 }; const down = (e) => { pointer.active = true; pointer.x = e.clientX; pointer.y = e.clientY; }; const move = (e) => { if (!pointer.active) return; orbit.theta -= (e.clientX - pointer.x) * .009; orbit.phi -= (e.clientY - pointer.y) * .009; pointer.x = e.clientX; pointer.y = e.clientY; cameraUpdate(); }; const up = () => { pointer.active = false; }; const wheel = (e) => { e.preventDefault(); orbit.radius = Math.max(6, Math.min(16, orbit.radius + e.deltaY * .012)); cameraUpdate(); };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointerleave", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false }); const resize = () => { const rect = mount.getBoundingClientRect(); if (!rect.width || !rect.height) return; camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height, false); }; const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame; const render = (time) => { frame = requestAnimationFrame(render); if (!reduceMotion && !pointer.active) { stack.rotation.y = Math.sin(time * .00022) * .12; layerMeshes.forEach((mesh, index) => { mesh.position.z = Math.sin(time * .0014 + index * .65) * .035; }); fluxGroup.position[target === "wall" ? "x" : "y"] = Math.sin(time * .0015) * .18; fluxMaterial.opacity = .52 + (Math.sin(time * .002) + 1) * .16; } renderer.render(scene, camera); }; render(0);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointerleave", up); renderer.domElement.removeEventListener("wheel", wheel); layerMeshes.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); }); fluxGroup.children.forEach((item) => { item.geometry.dispose(); }); fluxMaterial.dispose(); ground.geometry.dispose(); ground.material.dispose(); grid.geometry.dispose(); gridMaterials.forEach((m) => m.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, [layers, materials, target, nightMode, reduceMotion]);
  return <div className="three-shelter three-materials" aria-label="Interactive three-dimensional material assembly preview"><div ref={mountRef} className="three-shelter-canvas" /><div className="three-shelter-topline"><span><i /> {target === "wall" ? "WALL LAYER STACK" : "ROOF LAYER STACK"}</span><button type="button" onClick={() => setNightMode((value) => !value)}>{nightMode ? "Night mode" : "Day mode"}</button></div><div className="three-shelter-hint">DRAG TO ORBIT · SCROLL TO ZOOM · {layers.length} LAYERS</div></div>;
}
