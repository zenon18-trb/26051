"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function ThreeVentilationPreview({ isOpen, occupantsCount, length, width, height, reduceMotion = false }) {
  const mountRef = useRef(null);
  const [nightMode, setNightMode] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(nightMode ? 0x0c1511 : 0xe7ebe0, 8, 28);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const scale = 5.2 / Math.max(length, width, height, 1); const L = length * scale; const W = width * scale; const H = height * scale;
    scene.add(new THREE.HemisphereLight(nightMode ? 0x79968b : 0xffffff, nightMode ? 0x07100b : 0xa8b59f, nightMode ? 1.1 : 1.55));
    const sun = new THREE.DirectionalLight(nightMode ? 0xf4ba7a : 0xffffff, nightMode ? 2 : 2.35); sun.position.set(6, 9, 6); sun.castShadow = true; scene.add(sun);
    const ambientFlow = new THREE.PointLight(isOpen ? 0x6ec6ad : 0x7c9d8b, isOpen ? 8 : 2, 14); ambientFlow.position.set(0, H * 0.6, 0); scene.add(ambientFlow);
    const shelter = new THREE.Group(); scene.add(shelter);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), new THREE.MeshPhysicalMaterial({ color: 0x597a65, transparent: true, opacity: 0.24, roughness: 0.38, metalness: 0.2, side: THREE.DoubleSide })); shell.position.y = H / 2; shelter.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry), new THREE.LineBasicMaterial({ color: 0x203b2d, transparent: true, opacity: 0.9 })); edges.position.copy(shell.position); shelter.add(edges);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L * .94, .08, W * .94), new THREE.MeshStandardMaterial({ color: 0x334d3d, roughness: .84 })); floor.position.y = .04; shelter.add(floor);
    const ventMaterial = new THREE.MeshStandardMaterial({ color: isOpen ? 0x55af8c : 0x6a766d, metalness: .35, roughness: .35, emissive: isOpen ? 0x174a36 : 0x000000, emissiveIntensity: .8 });
    [-1, 1].forEach((side) => { const vent = new THREE.Mesh(new THREE.BoxGeometry(.12, H * .22, W * .26), ventMaterial); vent.position.set(side * (L / 2 + .025), H * .62, 0); shelter.add(vent); });
    const occupantGroup = new THREE.Group(); shelter.add(occupantGroup);
    const displayCount = Math.min(occupantsCount, 8);
    const personMaterial = new THREE.MeshStandardMaterial({ color: 0xf4ba7a, metalness: .08, roughness: .55, emissive: nightMode ? 0x552c15 : 0x000000, emissiveIntensity: .35 });
    for (let i = 0; i < displayCount; i += 1) { const person = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .32, 4, 8), personMaterial); body.position.y = .35; const head = new THREE.Mesh(new THREE.SphereGeometry(.105, 12, 8), personMaterial); head.position.y = .63; person.add(body, head); const columns = Math.min(4, displayCount); person.position.set(((i % columns) - (columns - 1) / 2) * .42, 0, (Math.floor(i / columns) - .3) * .52); occupantGroup.add(person); }
    const arrows = new THREE.Group(); shelter.add(arrows);
    if (isOpen) { [-.32, 0, .32].forEach((y) => { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-L * .65, H * (.52 + y * .12), y * W), new THREE.Vector3(0, H * (.58 - y * .08), -y * W * .2), new THREE.Vector3(L * .65, H * (.52 + y * .12), y * W)]); const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .025, 6, false), new THREE.MeshBasicMaterial({ color: 0x6ed4b5, transparent: true, opacity: .86 })); arrows.add(tube); const tip = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 8), new THREE.MeshBasicMaterial({ color: 0x6ed4b5 })); tip.rotation.z = -Math.PI / 2; tip.position.set(L * .65, H * (.52 + y * .12), y * W); arrows.add(tip); }); }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: nightMode ? 0x09100c : 0xdce1d6, roughness: .92 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new THREE.GridHelper(30, 30, nightMode ? 0x5c9673 : 0x93a890, nightMode ? 0x284734 : 0xc3ccc0); grid.position.y = .005; const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]; gridMaterials.forEach((m) => { m.transparent = true; m.opacity = nightMode ? .3 : .5; }); scene.add(grid);
    const orbit = { theta: .64, phi: 1.08, radius: 11, target: new THREE.Vector3(0, H * .42, 0) }; const updateCamera = () => { const phi = Math.max(.3, Math.min(Math.PI / 2 - .04, orbit.phi)); camera.position.set(orbit.radius * Math.sin(phi) * Math.sin(orbit.theta), orbit.target.y + orbit.radius * Math.cos(phi), orbit.radius * Math.sin(phi) * Math.cos(orbit.theta)); camera.lookAt(orbit.target); }; updateCamera();
    const pointer = { active: false, x: 0, y: 0 }; const down = (e) => { pointer.active = true; pointer.x = e.clientX; pointer.y = e.clientY; }; const move = (e) => { if (!pointer.active) return; orbit.theta -= (e.clientX - pointer.x) * .009; orbit.phi -= (e.clientY - pointer.y) * .009; pointer.x = e.clientX; pointer.y = e.clientY; updateCamera(); }; const up = () => { pointer.active = false; }; const wheel = (e) => { e.preventDefault(); orbit.radius = Math.max(7, Math.min(17, orbit.radius + e.deltaY * .012)); updateCamera(); };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointerleave", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    const resize = () => { const rect = mount.getBoundingClientRect(); if (!rect.width || !rect.height) return; camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height, false); }; const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame; const render = (time) => { frame = requestAnimationFrame(render); if (!reduceMotion && !pointer.active) shelter.rotation.y = Math.sin(time * .00022) * .055; if (!reduceMotion) { occupantGroup.children.forEach((person, i) => { person.position.y = Math.sin(time * .0017 + i) * .018; }); if (isOpen) arrows.position.x = Math.sin(time * .001) * .09; } renderer.render(scene, camera); }; render(0);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointerleave", up); renderer.domElement.removeEventListener("wheel", wheel); shell.geometry.dispose(); shell.material.dispose(); edges.geometry.dispose(); edges.material.dispose(); floor.geometry.dispose(); floor.material.dispose(); ventMaterial.dispose(); personMaterial.dispose(); arrows.traverse((item) => { item.geometry?.dispose(); item.material?.dispose(); }); ground.geometry.dispose(); ground.material.dispose(); grid.geometry.dispose(); gridMaterials.forEach((m) => m.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, [isOpen, occupantsCount, length, width, height, nightMode, reduceMotion]);
  return <div className={`three-shelter three-ventilation ${isOpen ? "three-ventilation-open" : ""}`} aria-label="Interactive three-dimensional ventilation and occupants preview"><div ref={mountRef} className="three-shelter-canvas" /><div className="three-shelter-topline"><span><i /> {isOpen ? "CROSS FLOW ACTIVE" : "INFILTRATION ONLY"}</span><button type="button" onClick={() => setNightMode((value) => !value)}>{nightMode ? "Night mode" : "Day mode"}</button></div><div className="three-shelter-hint">DRAG TO ORBIT · SCROLL TO ZOOM · {occupantsCount} PERSONS{occupantsCount > 8 ? " · MODEL SHOWS 8" : ""}</div></div>;
}
