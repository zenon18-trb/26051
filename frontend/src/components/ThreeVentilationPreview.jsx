"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { addContactShadow, addLightingRig, createSceneRenderer, createSurfaceMaterial, disposeObject3D, observeRendererSize } from "@/lib/three/scene";
import { createFlowMaterial } from "@/lib/three/shaders/materials";

export function ThreeVentilationPreview({ isOpen, occupantsCount, length, width, height, reduceMotion = false }) {
  const mountRef = useRef(null);
  const [nightMode, setNightMode] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = createSceneRenderer(mount);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(nightMode ? 0x0c1511 : 0xe7ebe0, 8, 28);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const scale = 5.2 / Math.max(length, width, height, 1); const L = length * scale; const W = width * scale; const H = height * scale;
    addLightingRig(scene, { nightMode, sunPosition: [6, 9, 6], daySunIntensity: 2.35, nightSunIntensity: 2 });
    const ambientFlow = new THREE.PointLight(isOpen ? 0x6ec6ad : 0x7c9d8b, isOpen ? 8 : 2, 14); ambientFlow.position.set(0, H * 0.6, 0); scene.add(ambientFlow);
    const shelter = new THREE.Group(); scene.add(shelter);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), createSurfaceMaterial("shell", { color: 0x597a65, transparent: true, opacity: 0.24, side: THREE.DoubleSide })); shell.position.y = H / 2; shelter.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry), new THREE.LineBasicMaterial({ color: 0x203b2d, transparent: true, opacity: 0.9 })); edges.position.copy(shell.position); shelter.add(edges);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L * .94, .08, W * .94), new THREE.MeshStandardMaterial({ color: 0x334d3d, roughness: .84 })); floor.position.y = .04; shelter.add(floor);
    const ventMaterial = createSurfaceMaterial("frame", { color: isOpen ? 0x78c0a6 : 0x59645e, textureSet: "metalPlate", metalness: .62, roughness: .35, emissive: isOpen ? 0x174a36 : 0x000000, emissiveIntensity: .8 });
    [-1, 1].forEach((side) => { const vent = new THREE.Mesh(new THREE.BoxGeometry(.12, H * .22, W * .26), ventMaterial); vent.position.set(side * (L / 2 + .025), H * .62, 0); shelter.add(vent); });
    const occupantGroup = new THREE.Group(); shelter.add(occupantGroup);
    const displayCount = Math.min(occupantsCount, 8);
    const personMaterial = new THREE.MeshStandardMaterial({ color: 0xf4ba7a, metalness: .08, roughness: .55, emissive: nightMode ? 0x552c15 : 0x000000, emissiveIntensity: .35 });
    for (let i = 0; i < displayCount; i += 1) { const person = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .32, 4, 8), personMaterial); body.position.y = .35; const head = new THREE.Mesh(new THREE.SphereGeometry(.105, 12, 8), personMaterial); head.position.y = .63; person.add(body, head); const columns = Math.min(4, displayCount); person.position.set(((i % columns) - (columns - 1) / 2) * .42, 0, (Math.floor(i / columns) - .3) * .52); occupantGroup.add(person); }
    const arrows = new THREE.Group(); shelter.add(arrows);
    const flowMaterials = [];
    if (isOpen) { [-.32, 0, .32].forEach((y) => { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-L * .65, H * (.52 + y * .12), y * W), new THREE.Vector3(0, H * (.58 - y * .08), -y * W * .2), new THREE.Vector3(L * .65, H * (.52 + y * .12), y * W)]); const flowMaterial = createFlowMaterial(); flowMaterials.push(flowMaterial); const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .025, 6, false), flowMaterial); arrows.add(tube); const tip = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 8), new THREE.MeshBasicMaterial({ color: 0x6ed4b5 })); tip.rotation.z = -Math.PI / 2; tip.position.set(L * .65, H * (.52 + y * .12), y * W); arrows.add(tip); }); }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), createSurfaceMaterial("ground", { color: nightMode ? 0x59615c : 0xffffff, textureSet: "concrete" })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    addContactShadow(scene, { size: Math.max(L, W) * 1.2, nightMode });
    const grid = new THREE.GridHelper(30, 30, nightMode ? 0x5c9673 : 0x93a890, nightMode ? 0x284734 : 0xc3ccc0); grid.position.y = .005; const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]; gridMaterials.forEach((m) => { m.transparent = true; m.opacity = nightMode ? .3 : .5; }); scene.add(grid);
    const orbit = { theta: .64, phi: 1.08, radius: 11, target: new THREE.Vector3(0, H * .42, 0) }; const updateCamera = () => { const phi = Math.max(.3, Math.min(Math.PI / 2 - .04, orbit.phi)); camera.position.set(orbit.radius * Math.sin(phi) * Math.sin(orbit.theta), orbit.target.y + orbit.radius * Math.cos(phi), orbit.radius * Math.sin(phi) * Math.cos(orbit.theta)); camera.lookAt(orbit.target); }; updateCamera();
    const pointer = { active: false, x: 0, y: 0 }; const down = (e) => { pointer.active = true; pointer.x = e.clientX; pointer.y = e.clientY; }; const move = (e) => { if (!pointer.active) return; orbit.theta -= (e.clientX - pointer.x) * .009; orbit.phi -= (e.clientY - pointer.y) * .009; pointer.x = e.clientX; pointer.y = e.clientY; updateCamera(); }; const up = () => { pointer.active = false; }; const wheel = (e) => { e.preventDefault(); orbit.radius = Math.max(7, Math.min(17, orbit.radius + e.deltaY * .012)); updateCamera(); };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointerleave", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    const observer = observeRendererSize(mount, camera, renderer);
    let frame; const render = (time) => { frame = requestAnimationFrame(render); if (!reduceMotion && !pointer.active) shelter.rotation.y = Math.sin(time * .00022) * .055; if (!reduceMotion) { occupantGroup.children.forEach((person, i) => { person.position.y = Math.sin(time * .0017 + i) * .018; }); if (isOpen) arrows.position.x = Math.sin(time * .001) * .09; flowMaterials.forEach((material) => { material.uniforms.uTime.value = time * .001; }); } renderer.render(scene, camera); }; render(0);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointerleave", up); renderer.domElement.removeEventListener("wheel", wheel); disposeObject3D(scene); renderer.dispose(); renderer.domElement.remove(); };
  }, [isOpen, occupantsCount, length, width, height, nightMode, reduceMotion]);
  return <div className={`three-shelter three-ventilation ${isOpen ? "three-ventilation-open" : ""}`} aria-label="Interactive three-dimensional ventilation and occupants preview"><div ref={mountRef} className="three-shelter-canvas" /><div className="three-shelter-topline"><span><i /> {isOpen ? "CROSS FLOW ACTIVE" : "INFILTRATION ONLY"}</span><button type="button" onClick={() => setNightMode((value) => !value)}>{nightMode ? "Night mode" : "Day mode"}</button></div><div className="three-shelter-hint">DRAG TO ORBIT · SCROLL TO ZOOM · {occupantsCount} PERSONS{occupantsCount > 8 ? " · MODEL SHOWS 8" : ""}</div></div>;
}
