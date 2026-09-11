"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const orientationAngles = { North: 0, East: Math.PI / 2, South: Math.PI, West: -Math.PI / 2 };

export function ThreeAnalysisHouse({ geometry, wallLayers, roofLayers, windows, vents, occupants, hvac, isRunning, reduceMotion = false }) {
  const mountRef = useRef(null); const [nightMode, setNightMode] = useState(false);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.domElement.dataset.analysisHouseCapture = "true"; mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(nightMode ? 0x0b1510 : 0xe6eadf, 10, 37); const camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
    const length = geometry?.length_m ?? 6, width = geometry?.width_m ?? 4, height = geometry?.height_m ?? 2.8; const scale = 5.5 / Math.max(length, width, height, 1); const L = length * scale, W = width * scale, H = height * scale;
    scene.add(new THREE.HemisphereLight(nightMode ? 0x829f94 : 0xffffff, nightMode ? 0x07100b : 0xa8b59f, nightMode ? 1.1 : 1.65)); const sun = new THREE.DirectionalLight(nightMode ? 0xf4ba7a : 0xffffff, nightMode ? 2.1 : 2.5); sun.position.set(7, 10, 6); sun.castShadow = true; scene.add(sun); const interior = new THREE.PointLight(windows?.kind === "open" ? 0x70c6a8 : 0xf4ba7a, nightMode ? 13 : 5.5, 14); interior.position.set(0, H * .55, 0); scene.add(interior);
    const house = new THREE.Group(); house.rotation.y = orientationAngles[geometry?.orientation ?? "North"] ?? 0; scene.add(house);
    const wallTone = wallLayers.length > 2 ? 0x4c725b : 0x67806b; const shell = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), [new THREE.MeshPhysicalMaterial({ color: wallTone, roughness: .58, metalness: .14 }), new THREE.MeshPhysicalMaterial({ color: 0x365641, roughness: .65 }), new THREE.MeshPhysicalMaterial({ color: roofLayers.length > 1 ? 0x7e9b75 : 0x677c60, roughness: .5, metalness: .16 }), new THREE.MeshStandardMaterial({ color: 0x203527 }), new THREE.MeshPhysicalMaterial({ color: 0x6d9279, roughness: .55 }), new THREE.MeshPhysicalMaterial({ color: 0x486852, roughness: .62 })]); shell.position.y = H / 2; shell.castShadow = true; shell.receiveShadow = true; house.add(shell); const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry), new THREE.LineBasicMaterial({ color: 0x1c3527, transparent: true, opacity: .9 })); edges.position.copy(shell.position); house.add(edges);
    const roofOverhang = .22;
    const roofLength = L + roofOverhang * 2;
    const roofWidth = W + roofOverhang * 2;
    const roofRise = Math.max(.38, H * .28);
    const roofGeometry = new THREE.BufferGeometry();
    roofGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -roofLength / 2, 0, -roofWidth / 2,  roofLength / 2, 0, -roofWidth / 2,
       roofLength / 2, 0,  roofWidth / 2, -roofLength / 2, 0,  roofWidth / 2,
      -roofLength / 2, roofRise, 0,        roofLength / 2, roofRise, 0,
    ], 3));
    roofGeometry.setIndex([
      0, 1, 5, 0, 5, 4, // front slope
      3, 4, 5, 3, 5, 2, // rear slope
      0, 4, 3,           // left gable
      1, 2, 5,           // right gable
      0, 3, 2, 0, 2, 1, // underside
    ]);
    roofGeometry.computeVertexNormals();
    const roof = new THREE.Mesh(
      roofGeometry,
      new THREE.MeshPhysicalMaterial({ color: roofLayers.length > 1 ? 0x78946f : 0x526a52, roughness: .48, metalness: .16, clearcoat: .08, side: THREE.DoubleSide })
    );
    roof.position.y = H;
    roof.castShadow = true;
    roof.receiveShadow = true;
    house.add(roof);
    const roofEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(roofGeometry),
      new THREE.LineBasicMaterial({ color: 0x29422f, transparent: true, opacity: .8 })
    );
    roofEdges.position.copy(roof.position);
    house.add(roofEdges);
    if (windows?.area_m2 && windows.area_m2 > .01) { const visibleArea = windows.area_m2 * scale * scale; const paneW = Math.min(L * .68, Math.max(L * .15, Math.sqrt(visibleArea * 1.55))); const paneH = Math.min(H * .62, Math.max(H * .14, visibleArea / paneW)); const frame = new THREE.Group(); frame.position.set(0, H * .55, W / 2 + .03); house.add(frame); const inset = new THREE.Mesh(new THREE.PlaneGeometry(paneW * 1.08, paneH * 1.08), new THREE.MeshBasicMaterial({ color: windows.kind === "open" ? 0x0b1811 : 0x153b42 })); inset.position.z = -.02; frame.add(inset); if (windows.kind === "glazed") { const glass = new THREE.Mesh(new THREE.PlaneGeometry(paneW, paneH), new THREE.MeshPhysicalMaterial({ color: 0x9bdde8, transparent: true, opacity: .45, roughness: .05, metalness: .06, side: THREE.DoubleSide, emissive: nightMode ? 0x215b63 : 0x000000, emissiveIntensity: .45 })); glass.position.z = .01; frame.add(glass); } const trimMat = new THREE.MeshStandardMaterial({ color: 0x1d3427, metalness: .45, roughness: .35 }); [[paneW,.07,0,paneH/2],[paneW,.07,0,-paneH/2],[.07,paneH,paneW/2,0],[.07,paneH,-paneW/2,0]].forEach(([x,y,px,py]) => { const piece = new THREE.Mesh(new THREE.BoxGeometry(x,y,.07),trimMat); piece.position.set(px,py,.04); frame.add(piece); }); }
    if (vents?.open) { [-1, 1].forEach((side) => { const vent = new THREE.Mesh(new THREE.BoxGeometry(.12, H * .16, W * .23), new THREE.MeshStandardMaterial({ color: 0x58b08e, emissive: 0x164c37, emissiveIntensity: .8 })); vent.position.set(side * (L / 2 + .03), H * .63, 0); house.add(vent); }); }
    const plant = new THREE.Mesh(new THREE.BoxGeometry(.52,.65,1.1), new THREE.MeshStandardMaterial({ color: 0x273d2f, metalness: .5, roughness: .36 })); plant.position.set(-L * .34, H * .45, -W * .22); if (hvac?.mode === "setpoint") house.add(plant);
    const people = new THREE.Group(); house.add(people); const count = Math.min(occupants ?? 0, 6); const personMat = new THREE.MeshStandardMaterial({ color: 0xf4ba7a, roughness: .55, emissive: nightMode ? 0x4c2915 : 0x000000, emissiveIntensity: .35 }); for (let i=0;i<count;i+=1) { const person = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.09,.28,4,8), personMat); body.position.y=.3; const head = new THREE.Mesh(new THREE.SphereGeometry(.1,12,8), personMat); head.position.y=.57; person.add(body,head); person.position.set(((i%3)-1)*.38,0,(Math.floor(i/3)-.25)*.52); people.add(person); }
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(L*.9,W*.9),new THREE.MeshBasicMaterial({color:0xf4ba7a,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false})); scan.rotation.x=-Math.PI/2; scan.position.y=H+.03; house.add(scan);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(34,34),new THREE.MeshStandardMaterial({color:nightMode?0x08100c:0xdce1d6,roughness:.92})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true;scene.add(ground); const grid=new THREE.GridHelper(34,34,nightMode?0x5c9673:0x93a890,nightMode?0x284734:0xc3ccc0);grid.position.y=.004; const gridMaterials=Array.isArray(grid.material)?grid.material:[grid.material];gridMaterials.forEach((m)=>{m.transparent=true;m.opacity=nightMode ? .3 : .48;});scene.add(grid);
    const orbit={theta:.64,phi:1.06,radius:12,target:new THREE.Vector3(0,H*.5,0)}; const cameraUpdate=()=>{const p=Math.max(.3,Math.min(Math.PI/2-.04,orbit.phi));camera.position.set(orbit.radius*Math.sin(p)*Math.sin(orbit.theta),orbit.target.y+orbit.radius*Math.cos(p),orbit.radius*Math.sin(p)*Math.cos(orbit.theta));camera.lookAt(orbit.target);};cameraUpdate(); const pointer={active:false,x:0,y:0};const down=(e)=>{pointer.active=true;pointer.x=e.clientX;pointer.y=e.clientY;};const move=(e)=>{if(!pointer.active)return;orbit.theta-=(e.clientX-pointer.x)*.009;orbit.phi-=(e.clientY-pointer.y)*.009;pointer.x=e.clientX;pointer.y=e.clientY;cameraUpdate();};const up=()=>{pointer.active=false;};const wheel=(e)=>{e.preventDefault();orbit.radius=Math.max(8,Math.min(19,orbit.radius+e.deltaY*.012));cameraUpdate();};renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointerleave",up);renderer.domElement.addEventListener("wheel",wheel,{passive:false});const resize=()=>{const rect=mount.getBoundingClientRect();if(!rect.width||!rect.height)return;camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);};const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    let frame;const render=(time)=>{frame=requestAnimationFrame(render);if(!reduceMotion&&!pointer.active)house.rotation.y=(orientationAngles[geometry?.orientation??"North"]??0)+Math.sin(time*.0002)*.04;if(!reduceMotion){scan.material.opacity=.06+(Math.sin(time*.002)+1)*.045;people.children.forEach((person,i)=>{person.position.y=Math.sin(time*.0015+i)*.015;});if(isRunning)scan.position.y=H+.03+Math.sin(time*.004)*.18;}renderer.render(scene,camera);};render(0);return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointerleave",up);renderer.domElement.removeEventListener("wheel",wheel);scene.traverse((item)=>{item.geometry?.dispose();if(Array.isArray(item.material))item.material.forEach((m)=>m.dispose());else item.material?.dispose();});renderer.dispose();renderer.domElement.remove();};
  },[geometry,wallLayers,roofLayers,windows,vents,occupants,hvac,isRunning,nightMode,reduceMotion]);
  return <div className={`three-shelter three-analysis-house ${isRunning?"three-analysis-running":""}`} aria-label="Interactive complete shelter simulation model"><div ref={mountRef} className="three-shelter-canvas"/><div className="three-shelter-topline"><span><i/> {isRunning?"SOLVER VISUALIZATION ACTIVE":"ASSEMBLED SYSTEM MODEL"}</span><button type="button" onClick={()=>setNightMode((value)=>!value)}>{nightMode?"Night mode":"Day mode"}</button></div><div className="three-shelter-hint">DRAG TO ORBIT · SCROLL TO ZOOM · {wallLayers.length + roofLayers.length} ENVELOPE LAYERS</div></div>;
}
