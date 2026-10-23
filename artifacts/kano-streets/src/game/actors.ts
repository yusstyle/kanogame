import * as THREE from "three";
import { makeSignMaterial } from "./materials";
import type { GameMaterials } from "./types";

const unitBox = new THREE.BoxGeometry(1, 1, 1);

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  castShadow = true,
) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function capsule(
  parent: THREE.Object3D,
  material: THREE.Material,
  radius: number,
  length: number,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 3, 8),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export type PlayerModel = {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
};

export function createPlayerModel(materials: GameMaterials): PlayerModel {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: "#754c35", roughness: 0.88 });
  const tunic = new THREE.MeshStandardMaterial({ color: "#55736e", roughness: 0.94 });
  const trousers = new THREE.MeshStandardMaterial({ color: "#483d32", roughness: 0.95 });
  const cap = new THREE.MeshStandardMaterial({ color: "#c0a36e", roughness: 0.95 });
  const embroidery = new THREE.MeshStandardMaterial({ color: "#d0b277", roughness: 0.88 });
  const leather = new THREE.MeshStandardMaterial({ color: "#332a23", roughness: 0.92 });

  const tunicHem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 0.76, 14, 1, true),
    tunic,
  );
  tunicHem.position.y = 0.92;
  tunicHem.castShadow = true;
  tunicHem.receiveShadow = true;
  root.add(tunicHem);
  capsule(root, tunic, 0.29, 0.54, 0, 1.1, 0);
  capsule(root, skin, 0.105, 0.3, 0, 1.46, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skin);
  head.position.set(0, 1.77, 0);
  head.castShadow = true;
  root.add(head);
  const fila = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 12), cap);
  fila.position.set(0, 1.96, -0.01);
  fila.castShadow = true;
  root.add(fila);
  const filaBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.205, 0.018, 5, 18),
    embroidery,
  );
  filaBand.position.set(0, 1.925, -0.01);
  filaBand.rotation.x = Math.PI / 2;
  root.add(filaBand);

  const neckTrim = new THREE.MeshStandardMaterial({ color: "#d0b277", roughness: 0.9 });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 14), neckTrim);
  collar.position.set(0, 1.48, 0);
  collar.rotation.x = Math.PI / 2;
  root.add(collar);
  addBox(root, neckTrim, 0, 1.11, 0.285, 0.035, 0.32, 0.026, false);
  const hemBand = new THREE.Mesh(new THREE.CylinderGeometry(0.394, 0.404, 0.055, 14, 1, true), embroidery);
  hemBand.position.y = 0.56;
  root.add(hemBand);
  const waistBand = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.075, 14, 1, true), trousers);
  waistBand.position.y = 0.69;
  root.add(waistBand);
  addBox(root, embroidery, 0, 1.14, 0.304, 0.16, 0.43, 0.026, false);
  for (let i = 0; i < 5; i += 1) {
    const stitch = addBox(root, embroidery, 0, 1.03 + i * 0.085, 0.324, 0.06, 0.035, 0.02, false);
    stitch.rotation.z = i % 2 ? Math.PI / 4 : -Math.PI / 4;
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 1.35, 0);
  capsule(leftArm, tunic, 0.105, 0.38, 0, -0.2, 0);
  capsule(leftArm, skin, 0.085, 0.18, 0, -0.48, 0);
  root.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 1.35, 0);
  capsule(rightArm, tunic, 0.105, 0.38, 0, -0.2, 0);
  capsule(rightArm, skin, 0.085, 0.18, 0, -0.48, 0);
  root.add(rightArm);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.72, 0);
  capsule(leftLeg, trousers, 0.11, 0.52, 0, -0.31, 0);
  addBox(leftLeg, leather, 0, -0.66, 0.08, 0.23, 0.12, 0.38);
  addBox(leftLeg, embroidery, 0, -0.61, 0.16, 0.22, 0.035, 0.12, false);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.72, 0);
  capsule(rightLeg, trousers, 0.11, 0.52, 0, -0.31, 0);
  addBox(rightLeg, leather, 0, -0.66, 0.08, 0.23, 0.12, 0.38);
  addBox(rightLeg, embroidery, 0, -0.61, 0.16, 0.22, 0.035, 0.12, false);
  root.add(rightLeg);

  const eye = new THREE.MeshBasicMaterial({ color: "#201b18" });
  for (const x of [-0.075, 0.075]) {
    const point = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), eye);
    point.position.set(x, 1.8, 0.193);
    root.add(point);
  }

  return { root, leftArm, rightArm, leftLeg, rightLeg };
}

export type CarModel = {
  root: THREE.Group;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  proceduralBody: THREE.Group;
  gltfBody?: THREE.Group;
  wheelRig: "procedural" | "asset";
  attachGLTFBody: (gltf: THREE.Group) => void;
};

export type KekeModel = {
  root: THREE.Group;
  frontFork: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheels: THREE.Mesh[];
};

export function createCarModel(materials: GameMaterials): CarModel {
  const root = new THREE.Group();
  const bodyColor = new THREE.MeshPhysicalMaterial({
    color: "#a85435",
    roughness: 0.43,
    metalness: 0.16,
    clearcoat: 0.22,
    clearcoatRoughness: 0.34,
  });
  const bodyAccent = new THREE.MeshPhysicalMaterial({
    color: "#d4bf9a",
    roughness: 0.47,
    metalness: 0.12,
    clearcoat: 0.18,
    clearcoatRoughness: 0.36,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: "#262827", roughness: 0.97 });
  const rim = new THREE.MeshStandardMaterial({
    color: "#9c9685",
    roughness: 0.44,
    metalness: 0.43,
  });
  const lamp = new THREE.MeshStandardMaterial({
    color: "#f2d99f",
    emissive: "#907445",
    emissiveIntensity: 0.45,
    roughness: 0.34,
  });
  const tailLamp = new THREE.MeshStandardMaterial({
    color: "#81362a",
    emissive: "#581c16",
    emissiveIntensity: 0.32,
    roughness: 0.44,
  });
  const licensePlate = makeSignMaterial("KN 247 KNA", "#e0d8c1");

  // A complete, original procedural sedan silhouette—not a downloaded or
  // photorealistic model. The proportions and visible mechanical parts are
  // built as a reusable Three.js model so it can be driven and inspected.
  addBox(root, materials.black, 0, 0.42, 0, 1.96, 0.26, 4.18);
  addBox(root, bodyColor, 0, 0.7, 0, 2.0, 0.56, 4.08);
  addBox(root, bodyAccent, 0, 0.99, 1.15, 1.98, 0.28, 1.49);
  addBox(root, bodyColor, 0, 0.98, -1.43, 1.94, 0.3, 1.2);
  addBox(root, bodyColor, 0, 1.25, -0.12, 1.74, 0.72, 2.15);

  // Side and rear glazing, with sturdy pillars and clear window separation.
  const cabinGlass = materials.glass;
  for (const side of [-1, 1]) {
    const pane1 = addBox(root, cabinGlass, side * 0.84, 1.43, -0.64, 0.07, 0.45, 0.77, false);
    pane1.rotation.x = -0.08;
    const pane2 = addBox(root, cabinGlass, side * 0.84, 1.43, 0.33, 0.07, 0.45, 0.77, false);
    pane2.rotation.x = 0.06;
    addBox(root, bodyAccent, side * 0.9, 1.42, -0.12, 0.08, 0.66, 0.1);
    addBox(root, bodyAccent, side * 0.9, 1.42, -1.12, 0.08, 0.68, 0.12);
    addBox(root, bodyAccent, side * 0.9, 1.42, 0.88, 0.08, 0.68, 0.12);
    addBox(root, bodyAccent, side * 0.93, 1.02, 0.12, 0.08, 0.06, 0.55);
    addBox(root, materials.metal, side * 1.03, 1.46, 0.68, 0.2, 0.12, 0.24);
  }

  const windshield = addBox(root, cabinGlass, 0, 1.47, 0.99, 1.47, 0.48, 0.08, false);
  windshield.rotation.x = -0.42;
  const rearGlass = addBox(root, cabinGlass, 0, 1.45, -1.17, 1.47, 0.43, 0.08, false);
  rearGlass.rotation.x = 0.42;

  // Door seams, bumpers, grille, mirrors, lamp clusters and underbody.
  for (const side of [-1, 1]) {
    addBox(root, materials.darkTrim, side * 0.98, 0.73, -0.28, 0.025, 0.43, 1.76, false);
    addBox(root, materials.metal, side * 1.01, 1.01, -0.55, 0.045, 0.055, 0.22, false);
    addBox(root, materials.black, side * 0.94, 0.36, 1.05, 0.28, 0.15, 0.6);
    addBox(root, materials.black, side * 0.94, 0.36, -1.1, 0.28, 0.15, 0.6);
  }
  addBox(root, materials.metal, 0, 0.56, 2.06, 1.95, 0.2, 0.16);
  addBox(root, materials.metal, 0, 0.55, -2.05, 1.95, 0.2, 0.16);
  addBox(root, materials.black, 0, 0.77, 2.09, 0.8, 0.26, 0.06);
  addBox(root, materials.trim, 0, 0.81, 2.13, 0.48, 0.12, 0.04);
  addBox(root, licensePlate, 0, 0.53, 2.16, 0.62, 0.18, 0.035, false);
  addBox(root, licensePlate, 0, 0.53, -2.12, 0.62, 0.18, 0.035, false);
  for (const x of [-0.68, 0.68]) {
    addBox(root, lamp, x, 0.98, 2.07, 0.45, 0.24, 0.09);
    addBox(root, tailLamp, x, 0.97, -2.04, 0.35, 0.24, 0.09);
    addBox(root, materials.white, x, 0.67, 2.11, 0.28, 0.08, 0.055, false);
  }

  for (const side of [-1, 1]) {
    addBox(root, bodyAccent, side * 0.96, 0.56, 0, 0.13, 0.14, 2.85, false);
    addBox(root, materials.black, side * 1.005, 0.43, 0, 0.09, 0.13, 2.8, false);
    for (const z of [-1.3, 1.3]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.045, 6, 20, Math.PI), bodyAccent);
      arch.position.set(side * 0.985, 0.42, z);
      arch.rotation.y = Math.PI / 2;
      arch.castShadow = true;
      root.add(arch);
    }
  }
  for (let grille = 0; grille < 7; grille += 1) {
    addBox(root, materials.metal, -0.29 + grille * 0.096, 0.79, 2.16, 0.035, 0.2, 0.035, false);
  }
  for (const side of [-1, 1]) {
    const wiper = addBox(root, materials.black, side * 0.37, 1.69, 0.97, 0.045, 0.045, 0.76, false);
    wiper.rotation.x = -0.42;
  }

  const proceduralBody = new THREE.Group();
  proceduralBody.name = "procedural-sedan-body-fallback";
  while (root.children.length > 0) {
    proceduralBody.add(root.children[0]);
  }
  root.add(proceduralBody);

  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  for (const x of [-0.91, 0.91]) {
    for (const z of [-1.3, 1.3]) {
      const steeringPivot = new THREE.Group();
      steeringPivot.position.set(x, 0.42, z);
      root.add(steeringPivot);

      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16), rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      steeringPivot.add(wheel);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.255, 12), rim);
      hub.rotation.z = Math.PI / 2;
      hub.position.x = x > 0 ? -0.01 : 0.01;
      hub.castShadow = true;
      steeringPivot.add(hub);

      for (let spoke = 0; spoke < 6; spoke += 1) {
        const angle = (Math.PI * 2 * spoke) / 6;
        const spokeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.22, 0.04),
          materials.white,
        );
        spokeMesh.position.set(hub.position.x * 1.1, Math.sin(angle) * 0.09, Math.cos(angle) * 0.09);
        spokeMesh.rotation.x = angle;
        steeringPivot.add(spokeMesh);
      }

      wheels.push(steeringPivot);
      if (z > 0) frontWheels.push(steeringPivot);
    }
  }

  // A dark interior, dashboard and headrests remain visible through the glass.
  addBox(proceduralBody, materials.black, 0, 1.03, -0.08, 1.52, 0.17, 1.5);
  for (const x of [-0.43, 0.43]) {
    addBox(proceduralBody, materials.wood, x, 1.18, -0.02, 0.55, 0.34, 0.61);
    addBox(proceduralBody, materials.black, x, 1.49, -0.12, 0.36, 0.36, 0.12);
  }
  addBox(proceduralBody, materials.black, 0, 1.2, 0.68, 1.52, 0.18, 0.28);

  const attachGLTFBody = (gltf: THREE.Group) => {
    proceduralBody.visible = false;
    wheels.forEach((pivot) => {
      pivot.visible = false;
    });
    gltf.rotation.y = Math.PI / 2;
    gltf.position.set(0, 0.31, 0);
    root.add(gltf);
  };

  return { root, wheels, frontWheels, proceduralBody, wheelRig: "procedural", attachGLTFBody };
}

export function createKekeModel(materials: GameMaterials): KekeModel {
  const root = new THREE.Group();
  root.name = "keke-napep-root";

  const yellow = materials.kekeYellow;
  const green = materials.kekeGreen;
  const black = materials.black;
  const metal = materials.metal;
  const rubber = new THREE.MeshStandardMaterial({ color: "#222423", roughness: 0.96 });
  const rim = new THREE.MeshStandardMaterial({ color: "#8a867b", roughness: 0.45, metalness: 0.5 });
  const lamp = new THREE.MeshStandardMaterial({
    color: "#fff3cf",
    emissive: "#a4884c",
    emissiveIntensity: 0.75,
    roughness: 0.28,
  });
  const tailLamp = new THREE.MeshStandardMaterial({
    color: "#89271e",
    emissive: "#5b140e",
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  const licensePlate = makeSignMaterial("KMC 318 KAN", "#e5aa24");

  // 1. Lower Chassis & Floor
  addBox(root, black, 0, 0.24, 0, 1.28, 0.14, 2.55);

  // 2. Yellow & Green Main Bodywork (Kano commercial tricycle livery)
  addBox(root, yellow, 0, 0.55, 0.98, 0.88, 0.52, 0.72);
  addBox(root, green, 0, 0.56, 1.345, 0.86, 0.14, 0.04);
  addBox(root, lamp, 0, 0.62, 1.35, 0.32, 0.22, 0.06);

  // Rear passenger cabin side panels with green stripe
  for (const side of [-1, 1]) {
    addBox(root, yellow, side * 0.62, 0.56, -0.22, 0.08, 0.54, 1.88);
    addBox(root, green, side * 0.625, 0.64, -0.22, 0.08, 0.12, 1.88);
    addBox(root, black, side * 0.63, 0.42, -0.72, 0.14, 0.24, 0.68);
  }
  // Rear back panel & bumper
  addBox(root, yellow, 0, 0.62, -1.14, 1.28, 0.66, 0.08);
  addBox(root, green, 0, 0.72, -1.145, 1.26, 0.14, 0.04);
  addBox(root, black, 0, 0.32, -1.2, 1.32, 0.12, 0.08);
  addBox(root, licensePlate, 0, 0.52, -1.19, 0.56, 0.16, 0.03, false);
  addBox(root, tailLamp, -0.52, 0.62, -1.185, 0.16, 0.12, 0.04);
  addBox(root, tailLamp, 0.52, 0.62, -1.185, 0.16, 0.12, 0.04);

  // 3. Cabin Tubular Frame & Roll-cage
  for (const side of [-1, 1]) {
    const frontPillar = addBox(root, black, side * 0.42, 1.15, 0.76, 0.05, 0.78, 0.05);
    frontPillar.rotation.x = -0.28;
    addBox(root, black, side * 0.58, 1.18, 0.12, 0.05, 0.82, 0.05);
    addBox(root, black, side * 0.58, 1.18, -1.1, 0.05, 0.82, 0.05);
    addBox(root, black, side * 0.52, 1.62, -0.2, 0.05, 0.05, 1.95);
  }

  // 4. Windshield & Canvas Roof Canopy
  const windshield = addBox(root, materials.glass, 0, 1.18, 0.82, 0.82, 0.64, 0.04, false);
  windshield.rotation.x = -0.28;
  addBox(root, black, 0, 1.12, 0.85, 0.03, 0.34, 0.03, false);

  addBox(root, materials.darkTrim, 0, 1.66, -0.18, 1.24, 0.08, 2.05);
  addBox(root, materials.cloth, 0, 1.69, -0.18, 1.18, 0.05, 1.95);

  // 5. Seating & Handlebars
  addBox(root, black, 0, 0.56, 0.28, 0.48, 0.22, 0.38);
  addBox(root, black, 0, 0.54, -0.74, 1.14, 0.25, 0.46);
  addBox(root, black, 0, 0.82, -0.98, 1.14, 0.34, 0.14);

  const handlebarStem = addBox(root, metal, 0, 0.82, 0.84, 0.045, 0.34, 0.045);
  handlebarStem.rotation.x = -0.24;
  addBox(root, metal, 0, 0.96, 0.82, 0.58, 0.04, 0.04);
  addBox(root, black, -0.26, 0.96, 0.82, 0.08, 0.055, 0.055);
  addBox(root, black, 0.26, 0.96, 0.82, 0.08, 0.055, 0.055);

  // 6. Steerable Front Fork & Wheel
  const frontFork = new THREE.Group();
  frontFork.position.set(0, 0.28, 1.12);
  root.add(frontFork);

  const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 16), rubber);
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.castShadow = true;
  frontWheel.receiveShadow = true;
  frontFork.add(frontWheel);

  const frontHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.17, 12), rim);
  frontHub.rotation.z = Math.PI / 2;
  frontFork.add(frontHub);

  const frontGuard = addBox(frontFork, black, 0, 0.22, 0.02, 0.22, 0.12, 0.38);
  frontGuard.rotation.x = -0.22;

  // 7. Dual Rear Wheels
  const rearWheels: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const rearWheelGroup = new THREE.Group();
    rearWheelGroup.position.set(side * 0.58, 0.28, -0.72);
    root.add(rearWheelGroup);

    const rWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 16), rubber);
    rWheel.rotation.z = Math.PI / 2;
    rWheel.castShadow = true;
    rWheel.receiveShadow = true;
    rearWheelGroup.add(rWheel);

    const rHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.17, 12), rim);
    rHub.rotation.z = Math.PI / 2;
    rearWheelGroup.add(rHub);

    rearWheels.push(rWheel);
  }

  return {
    root,
    frontFork,
    frontWheel,
    rearWheels,
  };
}
