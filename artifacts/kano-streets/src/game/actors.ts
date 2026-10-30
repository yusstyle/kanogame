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

function addCyl(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radiusTop: number,
  radiusBottom: number,
  height: number,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

let cachedContactShadowTexture: THREE.CanvasTexture | null = null;

function getContactShadowTexture(): THREE.CanvasTexture | null {
  if (cachedContactShadowTexture) return cachedContactShadowTexture;
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx && typeof ctx.createRadialGradient === "function") {
      const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 58);
      grad.addColorStop(0, "rgba(22, 18, 14, 0.60)");
      grad.addColorStop(0.3, "rgba(22, 18, 14, 0.38)");
      grad.addColorStop(0.65, "rgba(22, 18, 14, 0.14)");
      grad.addColorStop(1, "rgba(22, 18, 14, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    cachedContactShadowTexture = tex;
    return tex;
  } catch {
    return null;
  }
}

function addContactShadow(root: THREE.Group, width: number, length: number, opacity = 0.36) {
  const tex = getContactShadowTexture();
  if (!tex) return;
  try {
    const geo = new THREE.PlaneGeometry(width, length);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.035;
    mesh.renderOrder = 1;
    root.add(mesh);
  } catch {
    // Stub fallback
  }
}

export type PlayerModel = {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head?: THREE.Mesh;
  proceduralBody: THREE.Group;
  riggedCharacter?: THREE.Group;
  currentActionName?: "idle" | "walk" | "run" | "drive";
  attachRiggedCharacter: (
    characterGroup: THREE.Group,
    animations: Record<string, THREE.AnimationClip>,
  ) => void;
  playAction: (name: "idle" | "walk" | "run" | "drive", crossFadeDuration?: number) => void;
  setTimeScale?: (scale: number) => void;
  updateAnimation: (dt: number) => void;
};

export type PedestrianOptions = {
  skinColor?: string;
  tunicColor?: string;
  trousersColor?: string;
  capColor?: string;
  embroideryColor?: string;
  hasCap?: boolean;
};

export function createPedestrianModel(
  materials: GameMaterials,
  options: PedestrianOptions = {},
): PlayerModel {
  const root = new THREE.Group();
  const proceduralBody = new THREE.Group();
  proceduralBody.name = "procedural-body";
  root.add(proceduralBody);

  const skin = new THREE.MeshStandardMaterial({
    color: options.skinColor || "#754c35",
    roughness: 0.88,
  });
  const tunic = new THREE.MeshStandardMaterial({
    color: options.tunicColor || "#55736e",
    roughness: 0.94,
  });
  const trousers = new THREE.MeshStandardMaterial({
    color: options.trousersColor || "#483d32",
    roughness: 0.95,
  });
  const cap = new THREE.MeshStandardMaterial({
    color: options.capColor || "#c0a36e",
    roughness: 0.95,
  });
  const embroidery = new THREE.MeshStandardMaterial({
    color: options.embroideryColor || "#d0b277",
    roughness: 0.88,
  });
  const leather = new THREE.MeshStandardMaterial({ color: "#332a23", roughness: 0.92 });

  const tunicHem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 0.76, 14, 1, true),
    tunic,
  );
  tunicHem.position.y = 0.92;
  tunicHem.castShadow = true;
  tunicHem.receiveShadow = true;
  proceduralBody.add(tunicHem);
  capsule(proceduralBody, tunic, 0.29, 0.54, 0, 1.1, 0);
  capsule(proceduralBody, skin, 0.105, 0.3, 0, 1.46, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skin);
  head.position.set(0, 1.77, 0);
  head.castShadow = true;
  proceduralBody.add(head);

  if (options.hasCap !== false) {
    const fila = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 12), cap);
    fila.position.set(0, 1.96, -0.01);
    fila.castShadow = true;
    proceduralBody.add(fila);
    const filaBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.018, 5, 18),
      embroidery,
    );
    filaBand.position.set(0, 1.925, -0.01);
    filaBand.rotation.x = Math.PI / 2;
    proceduralBody.add(filaBand);
  }

  const neckTrim = new THREE.MeshStandardMaterial({
    color: options.embroideryColor || "#d0b277",
    roughness: 0.9,
  });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 14), neckTrim);
  collar.position.set(0, 1.48, 0);
  collar.rotation.x = Math.PI / 2;
  proceduralBody.add(collar);
  addBox(proceduralBody, neckTrim, 0, 1.11, 0.285, 0.035, 0.32, 0.026, false);
  const hemBand = new THREE.Mesh(new THREE.CylinderGeometry(0.394, 0.404, 0.055, 14, 1, true), embroidery);
  hemBand.position.y = 0.56;
  proceduralBody.add(hemBand);
  const waistBand = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.075, 14, 1, true), trousers);
  waistBand.position.y = 0.69;
  proceduralBody.add(waistBand);
  addBox(proceduralBody, embroidery, 0, 1.14, 0.304, 0.16, 0.43, 0.026, false);
  for (let i = 0; i < 5; i += 1) {
    const stitch = addBox(proceduralBody, embroidery, 0, 1.03 + i * 0.085, 0.324, 0.06, 0.035, 0.02, false);
    stitch.rotation.z = i % 2 ? Math.PI / 4 : -Math.PI / 4;
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 1.35, 0);
  capsule(leftArm, tunic, 0.105, 0.38, 0, -0.2, 0);
  capsule(leftArm, skin, 0.085, 0.18, 0, -0.48, 0);
  proceduralBody.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 1.35, 0);
  capsule(rightArm, tunic, 0.105, 0.38, 0, -0.2, 0);
  capsule(rightArm, skin, 0.085, 0.18, 0, -0.48, 0);
  proceduralBody.add(rightArm);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.72, 0);
  capsule(leftLeg, trousers, 0.11, 0.52, 0, -0.31, 0);
  addBox(leftLeg, leather, 0, -0.66, 0.08, 0.23, 0.12, 0.38);
  addBox(leftLeg, embroidery, 0, -0.61, 0.16, 0.22, 0.035, 0.12, false);
  proceduralBody.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.72, 0);
  capsule(rightLeg, trousers, 0.11, 0.52, 0, -0.31, 0);
  addBox(rightLeg, leather, 0, -0.66, 0.08, 0.23, 0.12, 0.38);
  addBox(rightLeg, embroidery, 0, -0.61, 0.16, 0.22, 0.035, 0.12, false);
  proceduralBody.add(rightLeg);

  const eye = new THREE.MeshBasicMaterial({ color: "#201b18" });
  for (const x of [-0.075, 0.075]) {
    const point = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), eye);
    point.position.set(x, 1.8, 0.193);
    proceduralBody.add(point);
  }

  let mixer: THREE.AnimationMixer | null = null;
  const actions: Partial<Record<"idle" | "walk" | "run" | "drive", THREE.AnimationAction>> = {};
  let currentAction: THREE.AnimationAction | null = null;
  let currentActionName: "idle" | "walk" | "run" | "drive" = "idle";

  const model: PlayerModel = {
    root,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    proceduralBody,
    currentActionName: "idle",
    playAction: (name: "idle" | "walk" | "run" | "drive", crossFadeDuration = 0.2) => {
      if (!mixer) return;
      const targetAction = actions[name] || actions["idle"];
      if (!targetAction) {
        proceduralBody.visible = true;
        return;
      }
      const targetName = actions[name] ? name : "idle";
      if (currentActionName === targetName && currentAction?.isRunning()) return;

      targetAction.reset();
      targetAction.enabled = true;
      if (currentAction && currentAction !== targetAction) {
        targetAction.crossFadeFrom(currentAction, crossFadeDuration, true);
      }
      targetAction.play();
      currentAction = targetAction;
      currentActionName = targetName;
      model.currentActionName = targetName;
    },
    setTimeScale: (scale: number) => {
      if (currentAction) {
        currentAction.setEffectiveTimeScale(scale);
      }
    },
    updateAnimation: (dt: number) => {
      if (mixer) {
        mixer.update(dt);
      }
    },
    attachRiggedCharacter: (
      characterGroup: THREE.Group,
      animations: Record<string, THREE.AnimationClip>,
    ) => {
      proceduralBody.visible = false;
      model.riggedCharacter = characterGroup;

      characterGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      root.add(characterGroup);

      mixer = new THREE.AnimationMixer(characterGroup);
      for (const [clipName, clip] of Object.entries(animations)) {
        if (["idle", "walk", "run", "drive"].includes(clipName)) {
          const action = mixer.clipAction(clip);
          action.setEffectiveTimeScale(1);
          action.setEffectiveWeight(1);
          actions[clipName as "idle" | "walk" | "run" | "drive"] = action;
        }
      }

      if (actions.idle) {
        actions.idle.play();
        currentAction = actions.idle;
        currentActionName = "idle";
        model.currentActionName = "idle";
      }
    },
  };

  return model;
}

export function createPlayerModel(materials: GameMaterials): PlayerModel {
  return createPedestrianModel(materials, {
    skinColor: "#754c35",
    tunicColor: "#55736e",
    trousersColor: "#483d32",
    capColor: "#c0a36e",
    embroideryColor: "#d0b277",
    hasCap: true,
  });
}

export type CarModel = {
  root: THREE.Group;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  proceduralBody: THREE.Group;
  gltfBody?: THREE.Group;
  wheelRig: "procedural" | "asset";
  attachGLTFBody: (gltf: THREE.Group, colorHex?: string) => void;
};

export type KekeModel = {
  root: THREE.Group;
  frontFork: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheels: THREE.Mesh[];
};

export function createCarModel(
  materials: GameMaterials,
  bodyColorHex = "#a85435",
  bodyAccentHex = "#d4bf9a",
  plateText = "KN 247 KNA",
): CarModel {
  const root = new THREE.Group();
  const bodyColor = new THREE.MeshPhysicalMaterial({
    color: bodyColorHex,
    roughness: 0.32,
    metalness: 0.24,
    clearcoat: 0.58,
    clearcoatRoughness: 0.2,
  });
  const bodyAccent = new THREE.MeshPhysicalMaterial({
    color: bodyAccentHex,
    roughness: 0.36,
    metalness: 0.18,
    clearcoat: 0.42,
    clearcoatRoughness: 0.25,
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
  const licensePlate = makeSignMaterial(plateText, "#e0d8c1");

  // Ground contact shadow and underbody
  addContactShadow(root, 2.2, 4.4, 0.48);
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
    const seat = addBox(proceduralBody, materials.wood, x, 1.18, -0.02, 0.55, 0.34, 0.61);
    const headrest = addBox(proceduralBody, materials.black, x, 1.49, -0.12, 0.36, 0.36, 0.12);
    if (x < 0) {
      seat.name = "procedural_driver_seat";
      seat.userData.isDriverSeatPart = true;
      headrest.name = "procedural_driver_headrest";
      headrest.userData.isDriverSeatPart = true;
    }
  }
  addBox(proceduralBody, materials.black, 0, 1.2, 0.68, 1.52, 0.18, 0.28);

  let gltfBody: THREE.Group | undefined;

  const attachGLTFBody = (gltf: THREE.Group, colorHex?: string) => {
    if (gltfBody) {
      root.remove(gltfBody);
    }
    proceduralBody.visible = false;
    wheels.forEach((pivot) => {
      pivot.visible = false;
    });
    const model = gltf.clone(true);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const nameLower = child.name.toLowerCase();
        if (
          nameLower.includes("headrest") ||
          nameLower.includes("seat_back") ||
          nameLower.includes("seat_cushion")
        ) {
          child.userData = child.userData || {};
          child.userData.isSeatMesh = true;
          // In graphite-four-door-sedan.glb, front seats and headrests:
          if (
            child.name.startsWith("Adjustable_headrest") ||
            child.name.startsWith("Contoured_seat_back") ||
            child.name.startsWith("Contoured_seat_cushion")
          ) {
            child.userData.isDriverSeatPart = true;
          }
        }
      }
    });
    if (colorHex) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => {
              if (m.name === "paint") {
                const cloneMat = m.clone();
                cloneMat.color = new THREE.Color(colorHex);
                return cloneMat;
              }
              return m;
            });
          } else if (child.material && child.material.name === "paint") {
            const cloneMat = child.material.clone();
            cloneMat.color = new THREE.Color(colorHex);
            child.material = cloneMat;
          }
        }
      });
    }
    model.rotation.y = Math.PI / 2;
    model.position.set(0, 0.31, 0);
    gltfBody = model;
    root.add(model);
  };

  return {
    root,
    wheels,
    frontWheels,
    proceduralBody,
    get gltfBody() {
      return gltfBody;
    },
    wheelRig: "procedural",
    attachGLTFBody,
  };
}

export function createKekeModel(
  materials: GameMaterials,
  plateText = "KMC 318 KAN",
  stripeColorHex?: string,
): KekeModel {
  const root = new THREE.Group();
  root.name = "keke-napep-root";

  const yellow = materials.kekeYellow;
  const green = stripeColorHex
    ? new THREE.MeshStandardMaterial({ color: stripeColorHex, roughness: 0.88 })
    : materials.kekeGreen;
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
  const licensePlate = makeSignMaterial(plateText, "#e5aa24");

  // 1. Lower Chassis & Ground Contact Shadow
  addContactShadow(root, 1.5, 2.8, 0.45);
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
  const kekeDriverSeat = addBox(root, black, 0, 0.56, 0.28, 0.48, 0.22, 0.38);
  kekeDriverSeat.name = "keke_driver_seat";
  kekeDriverSeat.userData.isDriverSeatPart = true;
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

export type MotorcycleModel = {
  root: THREE.Group;
  frontFork: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheel: THREE.Mesh;
};

export function createMotorcycleModel(
  materials: GameMaterials,
  colorHex = "#b82e24",
): MotorcycleModel {
  const root = new THREE.Group();
  root.name = "motorcycle-root";

  const frameMat = materials.black;
  const chromeMat = materials.metal;
  const tankMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.35,
    metalness: 0.22,
  });
  const rubberMat = new THREE.MeshStandardMaterial({ color: "#222322", roughness: 0.95 });
  const seatMat = new THREE.MeshStandardMaterial({ color: "#1a1918", roughness: 0.9 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: "#fff2d0",
    emissive: "#c29e50",
    emissiveIntensity: 0.6,
  });

  // Chassis / frame
  addBox(root, frameMat, 0, 0.42, 0, 0.16, 0.22, 1.25);
  addBox(root, frameMat, 0, 0.62, 0.15, 0.18, 0.28, 0.42);

  // Engine block
  addBox(root, chromeMat, 0, 0.34, 0.05, 0.28, 0.24, 0.38);

  // Fuel tank
  addBox(root, tankMat, 0, 0.78, 0.22, 0.32, 0.24, 0.55);

  // Vinyl seat
  const seat = addBox(root, seatMat, 0, 0.72, -0.32, 0.26, 0.14, 0.65);
  seat.rotation.x = 0.05;

  // Rear luggage rack
  addBox(root, chromeMat, 0, 0.74, -0.74, 0.3, 0.04, 0.32);

  // Exhaust muffler (right side)
  addCyl(root, chromeMat, 0.18, 0.26, -0.22, 0.04, 0.045, 0.85);

  // Rear wheel
  const rearWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.065, 8, 16),
    rubberMat,
  );
  rearWheel.rotation.y = Math.PI / 2;
  rearWheel.position.set(0, 0.28, -0.68);
  rearWheel.castShadow = true;
  root.add(rearWheel);
  addCyl(root, chromeMat, 0, 0.28, -0.68, 0.12, 0.12, 0.06);

  // Front fork & handlebars
  const frontFork = new THREE.Group();
  frontFork.position.set(0, 0.28, 0.74);
  frontFork.rotation.x = -0.22;
  root.add(frontFork);

  for (const s of [-0.09, 0.09]) {
    addCyl(frontFork, chromeMat, s, 0.32, 0, 0.022, 0.022, 0.68);
  }

  // Front wheel
  const frontWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.065, 8, 16),
    rubberMat,
  );
  frontWheel.rotation.y = Math.PI / 2;
  frontWheel.castShadow = true;
  frontFork.add(frontWheel);

  // Handlebars
  addBox(frontFork, chromeMat, 0, 0.68, 0.04, 0.62, 0.035, 0.035);
  addBox(frontFork, rubberMat, -0.28, 0.68, 0.04, 0.1, 0.045, 0.045);
  addBox(frontFork, rubberMat, 0.28, 0.68, 0.04, 0.1, 0.045, 0.045);

  // Round front headlamp
  addCyl(frontFork, lampMat, 0, 0.58, 0.14, 0.09, 0.09, 0.08);

  // Resting kickstand lean
  root.rotation.z = -0.09;

  return { root, frontFork, frontWheel, rearWheel };
}

export type UsableVehicleModel = {
  root: THREE.Group;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  body: THREE.Group;
};

// 1. Commercial Delivery Van (Kano Rapid Logistics)
export function createDeliveryVanModel(
  materials: GameMaterials,
  bodyColorHex = "#eceae1",
  accentColorHex = "#1a4f3a",
  plateText = "KN 582 KMC",
): UsableVehicleModel {
  const root = new THREE.Group();
  root.name = "delivery-van-root";
  const body = new THREE.Group();
  root.add(body);

  const vanBody = new THREE.MeshPhysicalMaterial({
    color: bodyColorHex,
    roughness: 0.38,
    metalness: 0.18,
    clearcoat: 0.2,
  });
  const vanStripe = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    roughness: 0.45,
    metalness: 0.15,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: "#242524", roughness: 0.96 });
  const steelRim = new THREE.MeshStandardMaterial({ color: "#a5a298", roughness: 0.42, metalness: 0.45 });
  const lamp = new THREE.MeshStandardMaterial({ color: "#fff0c8", emissive: "#997d40", emissiveIntensity: 0.5 });
  const tailLamp = new THREE.MeshStandardMaterial({ color: "#8b2015", emissive: "#5a120b", emissiveIntensity: 0.4 });
  const plateMat = makeSignMaterial(plateText, "#e0d8c1");
  const logoMat = makeSignMaterial("KANO RAPID LOGISTICS\nINTRA-CITY EXPRESS", "#1a4f3a");

  // Lower chassis frame & underbody with contact shadow
  addContactShadow(body, 2.3, 4.8, 0.48);
  addBox(body, materials.black, 0, 0.45, 0, 2.05, 0.28, 4.6);
  // Main Van Cabin & Enclosed Cargo Box
  addBox(body, vanBody, 0, 1.25, -0.25, 2.02, 1.35, 3.25); // Cargo box
  addBox(body, vanBody, 0, 1.05, 1.55, 1.98, 0.95, 1.25); // Front cab
  // Sloped aerodynamic windshield nose
  const hood = addBox(body, vanBody, 0, 0.95, 1.95, 1.95, 0.42, 0.65);
  hood.rotation.x = -0.15;

  // Commercial Livery Vinyl Stripes along both sides
  for (const side of [-1, 1]) {
    addBox(body, vanStripe, side * 1.02, 1.15, -0.25, 0.03, 0.28, 3.2);
    addBox(body, logoMat, side * 1.025, 1.45, -0.3, 0.02, 0.42, 1.6);
    // Side sliding door track & handle
    addBox(body, materials.darkTrim, side * 1.02, 0.85, 0.15, 0.02, 0.85, 1.15, false);
    addBox(body, materials.metal, side * 1.035, 1.05, 0.65, 0.03, 0.06, 0.14);
    // Cab side windows
    addBox(body, materials.glass, side * 1.0, 1.32, 1.45, 0.04, 0.48, 0.72, false);
    // Side mirrors
    addBox(body, materials.black, side * 1.18, 1.28, 1.65, 0.28, 0.18, 0.12);
  }

  // Windshield
  const windshield = addBox(body, materials.glass, 0, 1.38, 1.82, 1.78, 0.55, 0.08, false);
  windshield.rotation.x = -0.42;

  // Rear twin cargo split-doors
  addBox(body, materials.darkTrim, 0, 1.22, -1.89, 1.88, 1.25, 0.04, false);
  addBox(body, materials.metal, 0.08, 1.15, -1.92, 0.06, 0.35, 0.04); // Vertical rear door lock latch
  // Rear glass panes
  for (const rx of [-0.48, 0.48]) {
    addBox(body, materials.glass, rx, 1.48, -1.895, 0.58, 0.42, 0.02, false);
  }

  // Front bumper, grille, headlights
  addBox(body, materials.darkTrim, 0, 0.52, 2.32, 2.05, 0.35, 0.22);
  addBox(body, materials.black, 0, 0.75, 2.33, 1.45, 0.28, 0.08); // Grille
  for (const s of [-1, 1]) {
    addBox(body, lamp, s * 0.85, 0.78, 2.33, 0.28, 0.22, 0.06); // Headlights
    addBox(body, tailLamp, s * 0.88, 0.82, -1.91, 0.18, 0.38, 0.05); // Rear taillight bars
  }

  // License plates
  addBox(body, plateMat, 0, 0.52, 2.44, 0.52, 0.18, 0.02);
  addBox(body, plateMat, 0, 0.58, -1.92, 0.52, 0.18, 0.02);

  // Wheels
  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  const wheelPositions = [
    [-0.88, 0.36, 1.4],
    [0.88, 0.36, 1.4],
    [-0.88, 0.36, -1.2],
    [0.88, 0.36, -1.2],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    root.add(pivot);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16), rubber);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    pivot.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12), steelRim);
    hub.rotation.z = Math.PI / 2;
    pivot.add(hub);

    wheels.push(pivot);
    if (z > 0) frontWheels.push(pivot);
  });

  return { root, wheels, frontWheels, body };
}

// 2. Heavy-Duty Work Pickup Truck (Hilux style)
export function createPickupTruckModel(
  materials: GameMaterials,
  bodyColorHex = "#1c3c2e",
  plateText = "KN 301 PKP",
): UsableVehicleModel {
  const root = new THREE.Group();
  root.name = "pickup-truck-root";
  const body = new THREE.Group();
  root.add(body);

  const truckBody = new THREE.MeshPhysicalMaterial({
    color: bodyColorHex,
    roughness: 0.35,
    metalness: 0.25,
    clearcoat: 0.25,
  });
  const bullBarMat = new THREE.MeshStandardMaterial({ color: "#1e2022", roughness: 0.4, metalness: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#222322", roughness: 0.96 });
  const alloyRim = new THREE.MeshStandardMaterial({ color: "#b8b5aa", roughness: 0.35, metalness: 0.55 });
  const lamp = new THREE.MeshStandardMaterial({ color: "#fff2ce", emissive: "#a28248", emissiveIntensity: 0.55 });
  const tailLamp = new THREE.MeshStandardMaterial({ color: "#921a10", emissive: "#65140e", emissiveIntensity: 0.45 });
  const bedLiner = new THREE.MeshStandardMaterial({ color: "#181818", roughness: 0.95 });
  const plateMat = makeSignMaterial(plateText, "#e0d8c1");

  // Heavy steel chassis rails with contact shadow
  addContactShadow(body, 2.3, 5.1, 0.48);
  addBox(body, materials.black, 0, 0.48, 0, 2.0, 0.28, 4.9);
  // Dual-Cab Cabin
  addBox(body, truckBody, 0, 1.25, 0.42, 1.96, 0.95, 2.2);
  // Hood & Front Grille
  const hood = addBox(body, truckBody, 0, 0.98, 1.82, 1.94, 0.45, 1.25);
  hood.rotation.x = -0.06;

  // Front Heavy Bull Bar / Push Bumper
  addBox(body, bullBarMat, 0, 0.62, 2.48, 2.05, 0.38, 0.18);
  addBox(body, bullBarMat, 0, 0.95, 2.45, 1.65, 0.08, 0.08); // Top hoop
  for (const bx of [-0.65, 0.65]) {
    addBox(body, bullBarMat, bx, 0.8, 2.46, 0.08, 0.38, 0.08); // Vertical uprights
  }

  // Cabin Glazing & Side Doors
  const windshield = addBox(body, materials.glass, 0, 1.45, 1.38, 1.72, 0.55, 0.08, false);
  windshield.rotation.x = -0.38;
  const rearGlass = addBox(body, materials.glass, 0, 1.45, -0.65, 1.68, 0.45, 0.06, false);

  for (const side of [-1, 1]) {
    // Side door windows (front and rear double-cab windows)
    addBox(body, materials.glass, side * 0.96, 1.42, 0.72, 0.04, 0.42, 0.62, false);
    addBox(body, materials.glass, side * 0.96, 1.42, 0.05, 0.04, 0.42, 0.58, false);
    // Tubular steel side steps
    addBox(body, bullBarMat, side * 1.08, 0.42, 0.35, 0.12, 0.06, 1.85);
    // Mirrors
    addBox(body, bullBarMat, side * 1.15, 1.32, 1.28, 0.22, 0.14, 0.12);
  }

  // Headache Rack / Roll Bar behind Cab
  addBox(body, bullBarMat, 0, 1.72, -0.72, 1.78, 0.08, 0.08);
  for (const rx of [-0.85, 0.85]) {
    addBox(body, bullBarMat, rx, 1.25, -0.72, 0.08, 0.85, 0.08);
  }

  // Open Rear Cargo Bed with Ribbed Bed Liner & Tailgate
  addBox(body, bedLiner, 0, 0.68, -1.55, 1.82, 0.12, 1.75); // Bed floor
  addBox(body, truckBody, -0.92, 0.98, -1.55, 0.14, 0.58, 1.75); // Left bed wall
  addBox(body, truckBody, 0.92, 0.98, -1.55, 0.14, 0.58, 1.75); // Right bed wall
  addBox(body, truckBody, 0, 0.98, -2.42, 1.96, 0.58, 0.12); // Drop tailgate
  addBox(body, materials.darkTrim, 0, 1.12, -2.49, 0.35, 0.08, 0.04); // Tailgate handle
  addBox(body, materials.metal, 0, 0.52, -2.48, 1.98, 0.18, 0.18); // Rear bumper

  // Lamps
  for (const s of [-1, 1]) {
    addBox(body, lamp, s * 0.82, 0.86, 2.42, 0.26, 0.22, 0.06); // Dual front headlights
    addBox(body, tailLamp, s * 0.92, 0.98, -2.49, 0.14, 0.42, 0.04); // Vertical rear lamps
  }

  // Plates
  addBox(body, plateMat, 0, 0.52, 2.58, 0.52, 0.18, 0.02);
  addBox(body, plateMat, 0, 0.52, -2.58, 0.52, 0.18, 0.02);

  // High-clearance all-terrain wheels
  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  const wheelPositions = [
    [-0.92, 0.42, 1.62],
    [0.92, 0.42, 1.62],
    [-0.92, 0.42, -1.58],
    [0.92, 0.42, -1.58],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    root.add(pivot);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.28, 16), rubber);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    pivot.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.29, 12), alloyRim);
    hub.rotation.z = Math.PI / 2;
    pivot.add(hub);

    wheels.push(pivot);
    if (z > 0) frontWheels.push(pivot);
  });

  return { root, wheels, frontWheels, body };
}

// 3. Passenger Commuter Minibus (Nigerian Danfo)
export function createMinibusModel(
  materials: GameMaterials,
  bodyColorHex = "#dfa824",
  plateText = "KN 844 DNF",
): UsableVehicleModel {
  const root = new THREE.Group();
  root.name = "commuter-minibus-root";
  const body = new THREE.Group();
  root.add(body);

  const busBody = new THREE.MeshPhysicalMaterial({
    color: bodyColorHex,
    roughness: 0.42,
    metalness: 0.14,
    clearcoat: 0.18,
  });
  const busStripe = new THREE.MeshStandardMaterial({ color: "#163a24", roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#222322", roughness: 0.96 });
  const busRim = new THREE.MeshStandardMaterial({ color: "#9e9a8f", roughness: 0.44, metalness: 0.42 });
  const lamp = new THREE.MeshStandardMaterial({ color: "#fff2ce", emissive: "#a28248", emissiveIntensity: 0.55 });
  const tailLamp = new THREE.MeshStandardMaterial({ color: "#8b1e15", emissive: "#58120b", emissiveIntensity: 0.4 });
  const routeBoardMat = makeSignMaterial("SABON GARI · BOMPAI · KAWU INDUSTRIAL\nFARE: ₦300", "#163a24");
  const plateMat = makeSignMaterial(plateText, "#e0d8c1");

  // Underbody with ground contact shadow
  addContactShadow(body, 2.3, 5.3, 0.48);
  addBox(body, materials.black, 0, 0.45, 0, 2.1, 0.28, 5.1);
  // Main Minibus Passenger Body
  addBox(body, busBody, 0, 1.35, 0, 2.06, 1.48, 5.0);

  // Twin Dark-Green Danfo Speed Stripes along lower flank
  for (const side of [-1, 1]) {
    addBox(body, busStripe, side * 1.04, 0.92, 0, 0.03, 0.18, 4.95);
    addBox(body, busStripe, side * 1.04, 1.15, 0, 0.03, 0.18, 4.95);

    // Side passenger windows (3 large panoramic panes)
    for (let w = -1; w <= 1; w++) {
      addBox(body, materials.glass, side * 1.02, 1.62, w * 1.1 - 0.2, 0.04, 0.52, 0.92, false);
    }
    // Front driver & conductor windows
    addBox(body, materials.glass, side * 1.02, 1.58, 1.62, 0.04, 0.52, 0.78, false);
    // Extended bus side mirrors
    addBox(body, materials.black, side * 1.22, 1.42, 1.95, 0.32, 0.24, 0.14);
  }

  // Front Curved Windshield
  const windshield = addBox(body, materials.glass, 0, 1.62, 2.18, 1.88, 0.65, 0.08, false);
  windshield.rotation.x = -0.28;

  // Route Signboard mounted above windshield
  addBox(body, routeBoardMat, 0, 2.05, 2.08, 1.65, 0.26, 0.06);

  // Roof Luggage Rack with strapped spare tire
  addBox(body, materials.metal, 0, 2.22, -0.4, 1.65, 0.06, 3.2);
  for (const rx of [-0.8, 0.8]) {
    addBox(body, materials.metal, rx, 2.28, -0.4, 0.06, 0.12, 3.2);
  }
  const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 12), rubber);
  spareTire.rotation.x = Math.PI / 2;
  spareTire.position.set(0, 2.32, -0.5);
  body.add(spareTire);

  // Interior passenger bench seats (visible through windows)
  for (let row = -1.2; row <= 0.8; row += 0.95) {
    addBox(body, materials.wood, 0, 1.02, row, 1.65, 0.28, 0.42);
    addBox(body, materials.black, 0, 1.32, row - 0.18, 1.65, 0.35, 0.08);
  }

  // Front chrome grille, bumper & lights
  addBox(body, materials.darkTrim, 0, 0.52, 2.55, 2.08, 0.35, 0.18);
  addBox(body, materials.metal, 0, 0.82, 2.54, 1.45, 0.28, 0.08); // Grille
  for (const s of [-1, 1]) {
    addBox(body, lamp, s * 0.85, 0.85, 2.54, 0.28, 0.22, 0.06);
    addBox(body, tailLamp, s * 0.88, 0.95, -2.52, 0.18, 0.38, 0.04);
  }

  // Plates
  addBox(body, plateMat, 0, 0.52, 2.65, 0.52, 0.18, 0.02);
  addBox(body, plateMat, 0, 0.58, -2.54, 0.52, 0.18, 0.02);

  // Wheels
  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  const wheelPositions = [
    [-0.92, 0.38, 1.55],
    [0.92, 0.38, 1.55],
    [-0.92, 0.38, -1.45],
    [0.92, 0.38, -1.45],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    root.add(pivot);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.25, 16), rubber);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    pivot.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 12), busRim);
    hub.rotation.z = Math.PI / 2;
    pivot.add(hub);

    wheels.push(pivot);
    if (z > 0) frontWheels.push(pivot);
  });

  return { root, wheels, frontWheels, body };
}

// 4. Small Freight Haulage Truck (Cab-over Canter/Elf style)
export function createFreightTruckModel(
  materials: GameMaterials,
  cabColorHex = "#264875",
  plateText = "KN 119 TRK",
): UsableVehicleModel {
  const root = new THREE.Group();
  root.name = "freight-truck-root";
  const body = new THREE.Group();
  root.add(body);

  const cabBody = new THREE.MeshPhysicalMaterial({
    color: cabColorHex,
    roughness: 0.38,
    metalness: 0.22,
    clearcoat: 0.2,
  });
  const chassisSteel = new THREE.MeshStandardMaterial({ color: "#1c1d1e", roughness: 0.7, metalness: 0.7 });
  const timberBed = new THREE.MeshStandardMaterial({ color: "#7a5328", roughness: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#222322", roughness: 0.96 });
  const truckRim = new THREE.MeshStandardMaterial({ color: "#928e82", roughness: 0.4, metalness: 0.45 });
  const lamp = new THREE.MeshStandardMaterial({ color: "#fff2ce", emissive: "#a28248", emissiveIntensity: 0.55 });
  const tailLamp = new THREE.MeshStandardMaterial({ color: "#8b1e15", emissive: "#58120b", emissiveIntensity: 0.4 });
  const plateMat = makeSignMaterial(plateText, "#e0d8c1");
  const freightDecalMat = makeSignMaterial("KAWU INTERSTATE FREIGHT\nMAX LOAD: 4.5 TONNES", "#264875");

  // Heavy steel ladder chassis with ground contact shadow
  addContactShadow(body, 2.7, 7.8, 0.52);
  addBox(body, chassisSteel, 0, 0.58, -0.4, 1.95, 0.35, 6.2);
  // Cylindrical diesel tank (right side) & air tanks (left side)
  addCyl(body, chassisSteel, 0.85, 0.55, -0.4, 0.24, 0.24, 1.25);
  addBox(body, chassisSteel, -0.85, 0.55, -0.4, 0.42, 0.32, 0.85);

  // Cab-over-engine driver pod
  addBox(body, cabBody, 0, 1.62, 2.05, 2.15, 1.65, 1.85);
  // Wide wrap-around high panoramic windshield
  const windshield = addBox(body, materials.glass, 0, 1.82, 2.92, 1.95, 0.68, 0.08, false);
  windshield.rotation.x = -0.15;
  // Cab side windows
  for (const side of [-1, 1]) {
    addBox(body, materials.glass, side * 1.08, 1.82, 2.15, 0.04, 0.55, 0.82, false);
    // Vertical side grab handles & mirrors
    addBox(body, materials.metal, side * 1.12, 1.45, 1.62, 0.04, 0.65, 0.04);
    addBox(body, materials.black, side * 1.28, 1.72, 2.65, 0.25, 0.42, 0.12);
    // Company logo door decal
    addBox(body, freightDecalMat, side * 1.09, 1.28, 2.05, 0.02, 0.35, 0.85);
  }

  // Cab roof clearance marker lights (amber & green)
  for (let cl = -0.8; cl <= 0.8; cl += 0.4) {
    addBox(body, lamp, cl, 2.48, 2.78, 0.12, 0.06, 0.08);
  }

  // Front steel bumper, grille & headlights
  addBox(body, chassisSteel, 0, 0.58, 2.98, 2.25, 0.42, 0.25);
  addBox(body, materials.black, 0, 1.05, 2.98, 1.65, 0.38, 0.08);
  for (const s of [-1, 1]) {
    addBox(body, lamp, s * 0.92, 0.88, 2.99, 0.32, 0.24, 0.06);
    // Heavy rubber mudflaps with white chevrons
    addBox(body, rubber, s * 0.88, 0.42, -2.85, 0.45, 0.52, 0.04);
  }

  // Timber & steel drop-side freight flatbed ($3.8\text{m} \times 2.3\text{m}$)
  addBox(body, timberBed, 0, 0.95, -0.95, 2.25, 0.14, 4.0); // Flatbed floor
  addBox(body, timberBed, -1.12, 1.25, -0.95, 0.08, 0.52, 4.0); // Left drop-side board
  addBox(body, timberBed, 1.12, 1.25, -0.95, 0.08, 0.52, 4.0); // Right drop-side board
  addBox(body, timberBed, 0, 1.25, -2.94, 2.25, 0.52, 0.08); // Rear drop tailgate
  // Heavy steel headboard behind cab
  addBox(body, chassisSteel, 0, 1.62, 1.05, 2.25, 1.25, 0.08);

  // Cargo Load: Stacked wooden shipping crates and strapped freight pallets
  addBox(body, materials.wood, -0.45, 1.45, -0.2, 0.95, 0.85, 1.1);
  addBox(body, materials.wood, 0.45, 1.45, -0.2, 0.88, 0.85, 1.1);
  addBox(body, materials.wood, 0, 1.35, -1.5, 1.75, 0.65, 1.2);
  addBox(body, materials.cloth, 0, 1.78, -1.5, 1.82, 0.25, 1.25); // Heavy canvas cargo tarp

  // Rear bumper, tail lamps, plates
  addBox(body, chassisSteel, 0, 0.58, -2.96, 2.15, 0.22, 0.15);
  for (const s of [-1, 1]) {
    addBox(body, tailLamp, s * 0.85, 0.62, -3.05, 0.28, 0.18, 0.04);
  }
  addBox(body, plateMat, 0, 0.58, 3.12, 0.52, 0.18, 0.02);
  addBox(body, plateMat, 0, 0.58, -3.05, 0.52, 0.18, 0.02);

  // 6 Heavy-Duty Wheels (Front 2 + Tandem Rear Dual Wheels on each side)
  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];

  // Front wheels
  for (const x of [-0.95, 0.95]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.42, 2.1);
    root.add(pivot);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16), rubber);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    pivot.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.29, 12), truckRim);
    hub.rotation.z = Math.PI / 2;
    pivot.add(hub);

    wheels.push(pivot);
    frontWheels.push(pivot);
  }

  // Tandem rear dual wheels (4 wheels at rear: 2 left, 2 right)
  for (const z of [-1.5, -2.3]) {
    for (const x of [-0.98, 0.98]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.42, z);
      root.add(pivot);

      // Dual tire assembly
      for (const dx of [-0.08, 0.08]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16), rubber);
        tire.rotation.z = Math.PI / 2;
        tire.position.x = dx;
        tire.castShadow = true;
        pivot.add(tire);
      }

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.4, 12), truckRim);
      hub.rotation.z = Math.PI / 2;
      pivot.add(hub);

      wheels.push(pivot);
    }
  }

  return { root, wheels, frontWheels, body };
}
