import * as THREE from "three";
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

  const neckTrim = new THREE.MeshStandardMaterial({ color: "#d0b277", roughness: 0.9 });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 14), neckTrim);
  collar.position.set(0, 1.48, 0);
  collar.rotation.x = Math.PI / 2;
  root.add(collar);
  addBox(root, neckTrim, 0, 1.11, 0.285, 0.035, 0.32, 0.026, false);

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
  addBox(leftLeg, materials.wood, 0, -0.66, 0.08, 0.22, 0.12, 0.36);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.72, 0);
  capsule(rightLeg, trousers, 0.11, 0.52, 0, -0.31, 0);
  addBox(rightLeg, materials.wood, 0, -0.66, 0.08, 0.22, 0.12, 0.36);
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
};

export function createCarModel(materials: GameMaterials): CarModel {
  const root = new THREE.Group();
  const bodyColor = new THREE.MeshStandardMaterial({
    color: "#b6a06f",
    roughness: 0.66,
    metalness: 0.12,
  });
  const bodyAccent = new THREE.MeshStandardMaterial({
    color: "#d1bc8e",
    roughness: 0.64,
    metalness: 0.12,
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
  for (const x of [-0.68, 0.68]) {
    addBox(root, lamp, x, 0.98, 2.07, 0.45, 0.24, 0.09);
    addBox(root, tailLamp, x, 0.97, -2.04, 0.35, 0.24, 0.09);
  }

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
  addBox(root, materials.black, 0, 1.03, -0.08, 1.52, 0.17, 1.5);
  for (const x of [-0.43, 0.43]) {
    addBox(root, materials.wood, x, 1.18, -0.02, 0.55, 0.34, 0.61);
    addBox(root, materials.black, x, 1.49, -0.12, 0.36, 0.36, 0.12);
  }
  addBox(root, materials.black, 0, 1.2, 0.68, 1.52, 0.18, 0.28);

  return { root, wheels, frontWheels };
}
