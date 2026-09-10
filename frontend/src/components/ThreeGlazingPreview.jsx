"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const orientationAngles = { North: 0, East: Math.PI / 2, South: Math.PI, West: -Math.PI / 2 };

export function ThreeGlazingPreview({ length, width, height, orientation, windowArea, kind, reduceMotion = false }) {
  const mountRef = useRef(null);
  const [nightMode, setNightMode] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(nightMode ? 0x0c1511 : 0xe6eadf, 9, 28);
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
    const scale = 5.2 / Math.max(length, width, height, 1);
    const L = length * scale;
    const W = width * scale;
    const H = height * scale;
    const shelter = new THREE.Group();
    shelter.rotation.y = orientationAngles[orientation] ?? 0;
    scene.add(shelter);

    scene.add(new THREE.HemisphereLight(nightMode ? 0x76928a : 0xffffff, nightMode ? 0x07100b : 0x9fad98, nightMode ? 1.1 : 1.6));
    const sun = new THREE.DirectionalLight(nightMode ? 0xf4ba7a : 0xffffff, nightMode ? 1.9 : 2.4);
    sun.position.set(5, 8, 6); sun.castShadow = true; scene.add(sun);
    const windowLight = new THREE.PointLight(kind === "open" ? 0x8fc7b4 : 0xa9ddec, nightMode ? 11 : 6, 12);
    windowLight.position.set(0, H * 0.55, W / 2 + 1.2); scene.add(windowLight);

    const wallMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x5e7d68, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x385642, roughness: 0.76 }),
      new THREE.MeshStandardMaterial({ color: 0x8ca77d, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0x203527, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x6f9279, roughness: 0.66 }),
      new THREE.MeshStandardMaterial({ color: 0x456550, roughness: 0.75 }),
    ];
    const house = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), wallMaterials);
    house.position.y = H / 2; house.castShadow = true; house.receiveShadow = true; shelter.add(house);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(house.geometry), new THREE.LineBasicMaterial({ color: 0x203b2d, transparent: true, opacity: 0.86 }));
    edges.position.copy(house.position); shelter.add(edges);

    const visibleArea = Math.max(0, windowArea) * scale * scale;
    const paneWidth = Math.min(L * 0.72, Math.max(L * 0.16, Math.sqrt(Math.max(visibleArea, 0.08) * 1.55)));
    const paneHeight = Math.min(H * 0.68, Math.max(H * 0.16, visibleArea / paneWidth));
    const hasWindow = windowArea > 0.01;
    const windowGroup = new THREE.Group();
    windowGroup.position.set(0, H * 0.53, W / 2 + 0.025);
    shelter.add(windowGroup);
    if (hasWindow) {
      const recess = new THREE.Mesh(new THREE.PlaneGeometry(paneWidth * 1.08, paneHeight * 1.08), new THREE.MeshBasicMaterial({ color: kind === "open" ? 0x0c1712 : 0x183f46 }));
      recess.position.z = -0.03; windowGroup.add(recess);
      if (kind === "glazed") {
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(paneWidth, paneHeight), new THREE.MeshPhysicalMaterial({ color: 0x8fd5e5, metalness: 0.08, roughness: 0.06, transparent: true, opacity: 0.48, side: THREE.DoubleSide, emissive: nightMode ? 0x356c66 : 0x000000, emissiveIntensity: nightMode ? 0.5 : 0 }));
        glass.position.z = 0.012; windowGroup.add(glass);
      } else {
        const apertureGlow = new THREE.Mesh(new THREE.PlaneGeometry(paneWidth * 0.9, paneHeight * 0.9), new THREE.MeshBasicMaterial({ color: 0x4b9c85, transparent: true, opacity: 0.16 }));
        apertureGlow.position.z = 0.014; windowGroup.add(apertureGlow);
      }
      const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1c3024, metalness: 0.48, roughness: 0.38 });
      const frameDepth = 0.06;
      [[paneWidth, 0.07, 0, paneHeight / 2], [paneWidth, 0.07, 0, -paneHeight / 2], [0.07, paneHeight, paneWidth / 2, 0], [0.07, paneHeight, -paneWidth / 2, 0]].forEach(([frameW, frameH, x, y]) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameH, frameDepth), frameMaterial);
        frame.position.set(x, y, 0.055); windowGroup.add(frame);
      });
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.035, paneHeight * 0.92, frameDepth), frameMaterial);
      cross.position.z = 0.06; windowGroup.add(cross);
    }

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: nightMode ? 0x09100c : 0xdce1d6, roughness: 0.92 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(30, 30, nightMode ? 0x5c9673 : 0x93a890, nightMode ? 0x284734 : 0xc3ccc0);
    grid.position.y = 0.005;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = nightMode ? 0.3 : 0.5; });
    scene.add(grid);

    const orbit = { theta: 0.62, phi: 1.05, radius: 11, target: new THREE.Vector3(0, H * 0.45, 0) };
    const updateCamera = () => { const phi = Math.max(0.3, Math.min(Math.PI / 2 - 0.04, orbit.phi)); camera.position.set(orbit.radius * Math.sin(phi) * Math.sin(orbit.theta), orbit.target.y + orbit.radius * Math.cos(phi), orbit.radius * Math.sin(phi) * Math.cos(orbit.theta)); camera.lookAt(orbit.target); };
    updateCamera();
    const pointer = { active: false, x: 0, y: 0 };
    const onPointerDown = (event) => { pointer.active = true; pointer.x = event.clientX; pointer.y = event.clientY; };
    const onPointerMove = (event) => { if (!pointer.active) return; orbit.theta -= (event.clientX - pointer.x) * 0.009; orbit.phi -= (event.clientY - pointer.y) * 0.009; pointer.x = event.clientX; pointer.y = event.clientY; updateCamera(); };
    const onPointerUp = () => { pointer.active = false; };
    const onWheel = (event) => { event.preventDefault(); orbit.radius = Math.max(7, Math.min(17, orbit.radius + event.deltaY * 0.012)); updateCamera(); };
    renderer.domElement.addEventListener("pointerdown", onPointerDown); renderer.domElement.addEventListener("pointermove", onPointerMove); renderer.domElement.addEventListener("pointerup", onPointerUp); renderer.domElement.addEventListener("pointerleave", onPointerUp); renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    const resize = () => { const rect = mount.getBoundingClientRect(); if (!rect.width || !rect.height) return; camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height, false); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frameId;
    const render = (time) => { frameId = requestAnimationFrame(render); if (!reduceMotion && !pointer.active) shelter.rotation.y = (orientationAngles[orientation] ?? 0) + Math.sin(time * 0.00025) * 0.05; if (!reduceMotion && hasWindow) windowLight.intensity = (nightMode ? 10 : 5.5) + (Math.sin(time * 0.002) + 1) * 0.6; renderer.render(scene, camera); };
    render(0);
    return () => { cancelAnimationFrame(frameId); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onPointerDown); renderer.domElement.removeEventListener("pointermove", onPointerMove); renderer.domElement.removeEventListener("pointerup", onPointerUp); renderer.domElement.removeEventListener("pointerleave", onPointerUp); renderer.domElement.removeEventListener("wheel", onWheel); house.geometry.dispose(); wallMaterials.forEach((material) => material.dispose()); edges.geometry.dispose(); edges.material.dispose(); ground.geometry.dispose(); ground.material.dispose(); grid.geometry.dispose(); gridMaterials.forEach((material) => material.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, [length, width, height, orientation, windowArea, kind, nightMode, reduceMotion]);

  return <div className={`three-shelter three-glazing ${kind === "open" ? "three-glazing-open" : ""}`} aria-label="Interactive three-dimensional window and glazing preview"><div ref={mountRef} className="three-shelter-canvas" /><div className="three-shelter-topline"><span><i /> {kind === "glazed" ? "GLASS RESPONSE" : "OPEN APERTURE"}</span><button type="button" onClick={() => setNightMode((value) => !value)}>{nightMode ? "Night mode" : "Day mode"}</button></div><div className="three-shelter-hint">DRAG TO ORBIT · SCROLL TO ZOOM</div></div>;
}
