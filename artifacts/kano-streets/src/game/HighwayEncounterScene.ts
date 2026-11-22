import * as THREE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { createPedestrianModel, type PlayerModel } from "./actors";
import { loadHumanoidCharacter } from "./assetManifest";
import type { GameMaterials } from "./types";
import {
  HIGHWAY_ENCOUNTER_ZONES,
  type HighwayIncident,
  type WorldPosition2D,
} from "./HighwaySecuritySystem";

const VISUAL_RANGE = 140;
const WITNESS_ESCAPE_SPEED = 2.8;
const WITNESS_ESCAPE_DISTANCE = 20;

export class HighwayEncounterScene {
  private sceneRoot: THREE.Group | null = null;
  private sceneKey: string | null = null;
  private banditModels: PlayerModel[] = [];
  private witnessModel: PlayerModel | null = null;
  private witnessStart: WorldPosition2D | null = null;
  private witnessDistance = 0;
  private observationTime = 0;
  private banditStartPositions: WorldPosition2D[] = [];
  private banditRetreatPositions: WorldPosition2D[] = [];
  private banditMoveProgress = 0;
  private banditLoaded = false;
  private lastPlayerPosition: WorldPosition2D | null = null;
  private readonly escapeDirection = new THREE.Vector2(-0.75, -0.66).normalize();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materials: GameMaterials,
    private readonly surfaceHeight: (x: number, z: number) => number,
  ) {}

  public update(
    cityId: string,
    playerPosition: WorldPosition2D,
    incident: HighwayIncident | null,
    dt: number,
  ): void {
    const zone = incident
      ? HIGHWAY_ENCOUNTER_ZONES.find((candidate) => candidate.id === incident.zoneId)
      : undefined;
    if (
      cityId !== "abuja" ||
      !incident ||
      !zone ||
      incident.stage === "cooldown" ||
      Math.hypot(playerPosition.x - zone.position.x, playerPosition.z - zone.position.z) > VISUAL_RANGE
    ) {
      this.clear();
      return;
    }

    const sceneType = incident.stage === "rescued" ? "rescued" : "encounter";
    const key = `${incident.id}:${sceneType}`;
    if (this.sceneKey !== key) {
      this.clear();
      this.buildScene(zone.position, zone.rescuePosition, incident, sceneType);
      this.sceneKey = key;
    }

    if (this.witnessModel && this.witnessStart) {
      const distance = Math.min(
        WITNESS_ESCAPE_DISTANCE,
        this.witnessDistance + WITNESS_ESCAPE_SPEED * Math.max(0, dt),
      );
      const x = this.witnessStart.x + this.escapeDirection.x * distance;
      const z = this.witnessStart.z + this.escapeDirection.y * distance;
      this.witnessModel.root.position.set(x, this.surfaceHeight(x, z), z);
      this.witnessDistance = distance;
      this.witnessModel.root.visible = distance < WITNESS_ESCAPE_DISTANCE;
      this.witnessModel.updateAnimation(dt);
    }
    this.observationTime += Math.max(0, dt);
    this.updateBandits(playerPosition, zone, dt);
    this.lastPlayerPosition = { ...playerPosition };
  }

  public deactivate(): void {
    this.clear();
  }

  public dispose(): void {
    this.clear();
  }

  private buildScene(
    position: WorldPosition2D,
    rescuePosition: WorldPosition2D,
    incident: HighwayIncident,
    sceneType: "encounter" | "rescued",
  ): void {
    const root = new THREE.Group();
    root.name = `HighwayEncounter:${incident.id}`;
    this.sceneRoot = root;
    this.scene.add(root);

    if (sceneType === "rescued") {
      const rescuedModel = createPedestrianModel(this.materials, {
        tunicColor: "#80765c",
        trousersColor: "#4b483d",
        capColor: "#b9a375",
        hasCap: true,
      });
      rescuedModel.root.name = `RescuedPassenger:${incident.missingPerson.id}`;
      rescuedModel.root.position.set(
        rescuePosition.x,
        this.surfaceHeight(rescuePosition.x, rescuePosition.z),
        rescuePosition.z,
      );
      root.add(rescuedModel.root);
      return;
    }

    this.buildRuralEnvironment(root, position);

    const outfits = [
      { tunicColor: "#4a513f", trousersColor: "#242a24", capColor: "#343a30", skinColor: "#704734" },
      { tunicColor: "#61533d", trousersColor: "#322e27", capColor: "#2f2b25", skinColor: "#5d3c2a" },
      { tunicColor: "#3d4d43", trousersColor: "#252a27", capColor: "#252d29", skinColor: "#815840" },
    ];
    const banditOffsets = [
      { x: -8, z: 20 },
      { x: 7, z: 22 },
      { x: 0, z: 26 },
    ];
    this.banditModels = banditOffsets.map((offset, index) => {
      const model = createPedestrianModel(this.materials, {
        ...outfits[index],
        hasCap: true,
      });
      model.root.name = `HighwayBandit:${index + 1}`;
      const x = position.x + offset.x;
      const z = position.z + offset.z;
      model.root.position.set(x, this.surfaceHeight(x, z), z);
      model.root.rotation.y = Math.PI;
      const heightScale = [0.94, 1.05, 1.0][index];
      model.root.scale.setScalar(heightScale);
      model.root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.castShadow = true;
      });
      root.add(model.root);
      return model;
    });
    this.banditStartPositions = this.banditModels.map((model) => ({
      x: model.root.position.x,
      z: model.root.position.z,
    }));
    this.banditRetreatPositions = this.banditStartPositions.map((start, index) => ({
      x: start.x + (index % 2 === 0 ? -16 : 14),
      z: start.z + 12,
    }));
    this.loadRealisticBandits(root);
    this.observationTime = 0;

    const witnessPosition = { x: position.x - 4, z: position.z + 3 };
    this.witnessStart = witnessPosition;
    this.witnessDistance = 0;
    this.witnessModel = createPedestrianModel(this.materials, {
      tunicColor: "#b28c59",
      trousersColor: "#403b33",
      capColor: "#c5a873",
      hasCap: true,
    });
    this.witnessModel.root.name = "FleeingHighwayWitness";
    this.witnessModel.root.position.set(
      witnessPosition.x,
      this.surfaceHeight(witnessPosition.x, witnessPosition.z),
      witnessPosition.z,
    );
    this.witnessModel.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = false;
    });
    root.add(this.witnessModel.root);

    const barrierGeometry = new THREE.BoxGeometry(0.65, 0.8, 6);
    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: "#b28a37",
      roughness: 0.82,
    });
    const obstruction = new THREE.Mesh(barrierGeometry, barrierMaterial);
    obstruction.name = "HighwayRoadObstruction";
    obstruction.position.set(position.x, this.surfaceHeight(position.x, position.z) + 0.4, position.z);
    obstruction.castShadow = false;
    obstruction.receiveShadow = false;
    root.add(obstruction);
    this.witnessModel.playAction("run", 0.15);
  }

  private updateBandits(
    playerPosition: WorldPosition2D,
    zone: (typeof HIGHWAY_ENCOUNTER_ZONES)[number],
    dt: number,
  ): void {
    this.banditMoveProgress = Math.min(1, this.banditMoveProgress + dt * 0.32);
    const playerDistance = Math.hypot(
      playerPosition.x - zone.position.x,
      playerPosition.z - zone.position.z,
    );
    const retreating = playerDistance < 18;

    this.banditModels.forEach((model, index) => {
      const start = this.banditStartPositions[index];
      const retreat = this.banditRetreatPositions[index];
      if (!start || !retreat) return;

      if (retreating) {
        const retreatProgress = Math.min(
          1,
          this.banditMoveProgress * 1.8 + index * 0.08,
        );
        const x = THREE.MathUtils.lerp(start.x, retreat.x, retreatProgress);
        const z = THREE.MathUtils.lerp(start.z, retreat.z, retreatProgress);
        model.root.position.set(x, this.surfaceHeight(x, z), z);
        model.root.rotation.y =
          Math.PI +
          Math.sin(this.observationTime * 0.8 + index * 1.5) * 0.08 +
          (index % 2 === 0 ? -0.12 : 0.12);
        model.playAction("run", 0.25);
      } else {
        const approachProgress = Math.min(0.7, this.banditMoveProgress);
        const targetX = zone.position.x + (index - 1) * 5;
        const targetZ = zone.position.z + 8;
        const x = THREE.MathUtils.lerp(start.x, targetX, approachProgress);
        const z = THREE.MathUtils.lerp(start.z, targetZ, approachProgress);
        model.root.position.set(x, this.surfaceHeight(x, z), z);
        model.root.rotation.y =
          Math.PI +
          Math.sin(this.observationTime * 0.55 + index * 1.8) * 0.12;
        model.playAction(this.banditMoveProgress < 1 ? "walk" : "idle", 0.35);
      }
      model.updateAnimation(dt);
    });
  }

  private loadRealisticBandits(root: THREE.Group): void {
    if (this.banditLoaded) return;
    this.banditLoaded = true;
    void loadHumanoidCharacter(
      "/assets/characters/Black_M_1_Casual.glb",
      "/assets/characters/humanoid_animations.json",
    ).then((humanoid) => {
      if (!humanoid || !this.sceneRoot) return;
      this.banditModels.forEach((model, index) => {
        if (!humanoid.characterRoot) return;
        const characterRoot = cloneSkeleton(humanoid.characterRoot) as THREE.Group;
        this.addBanditEquipment(characterRoot, index);
        model.attachRiggedCharacter(characterRoot, humanoid.animations);
        model.playAction("idle", 0.35);
      });
    });
  }

  private addBanditEquipment(characterRoot: THREE.Group, index: number): void {
    const vestColors = ["#4b503e", "#64583f", "#36463b"];
    const scarfColors = ["#3a3d35", "#5a4d3b", "#26352e"];
    const vestMaterial = new THREE.MeshStandardMaterial({
      color: vestColors[index],
      roughness: 0.9,
    });
    const scarfMaterial = new THREE.MeshStandardMaterial({
      color: scarfColors[index],
      roughness: 0.95,
    });
    const bootMaterial = new THREE.MeshStandardMaterial({
      color: "#25231f",
      roughness: 0.82,
    });

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.16), vestMaterial);
    vest.name = `BanditTacticalVest:${index + 1}`;
    vest.position.set(0, 1.05, 0.18);
    characterRoot.add(vest);

    const faceCover = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.12), scarfMaterial);
    faceCover.name = `BanditFaceScarf:${index + 1}`;
    faceCover.position.set(0, 1.53, 0.17);
    characterRoot.add(faceCover);

    for (const x of [-0.18, 0.18]) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), bootMaterial);
      boot.name = `BanditBoot:${index + 1}`;
      boot.position.set(x, 0.08, 0.08);
      characterRoot.add(boot);
    }
  }

  private buildRuralEnvironment(root: THREE.Group, position: WorldPosition2D): void {
    const dirtMaterial = new THREE.MeshStandardMaterial({
      color: "#78664d",
      roughness: 1,
    });
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(34, 20), dirtMaterial);
    dirt.name = "AsokoroOuterDirtTrack";
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(position.x, this.surfaceHeight(position.x, position.z) + 0.018, position.z);
    dirt.receiveShadow = true;
    root.add(dirt);

    const bushMaterial = new THREE.MeshStandardMaterial({
      color: "#3f5537",
      roughness: 1,
    });
    const dryBushMaterial = new THREE.MeshStandardMaterial({
      color: "#756044",
      roughness: 1,
    });
    const bushGeometry = new THREE.DodecahedronGeometry(1.15, 1);
    const smallBushGeometry = new THREE.DodecahedronGeometry(0.72, 1);
    const bushPositions = [
      [-20, -6, 1.15], [-15, 11, 0.85], [-24, 18, 1.25],
      [19, -8, 1.05], [21, 12, 1.2], [24, 21, 0.9],
      [-12, 30, 1.1], [12, 32, 1.25], [28, 30, 0.95],
    ];
    bushPositions.forEach(([dx, dz, scale], index) => {
      const bush = new THREE.Mesh(
        index % 3 === 0 ? smallBushGeometry : bushGeometry,
        index % 4 === 0 ? dryBushMaterial : bushMaterial,
      );
      bush.name = `SavannahBush:${index + 1}`;
      const x = position.x + dx;
      const z = position.z + dz;
      bush.position.set(x, this.surfaceHeight(x, z) + 0.65 * scale, z);
      bush.scale.set(scale, scale * (0.75 + (index % 3) * 0.08), scale);
      bush.castShadow = true;
      bush.receiveShadow = true;
      root.add(bush);
    });

    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: "#5b4933",
      roughness: 1,
    });
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: "#4c6240",
      roughness: 1,
    });
    [
      [-22, 25], [22, 26], [-28, -12], [27, -16],
    ].forEach(([dx, dz], index) => {
      const tree = new THREE.Group();
      tree.name = `SparseAcacia:${index + 1}`;
      const x = position.x + dx;
      const z = position.z + dz;
      const groundY = this.surfaceHeight(x, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.8, 7), trunkMaterial);
      trunk.position.y = 1.4;
      trunk.castShadow = true;
      tree.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.8, 9, 7), canopyMaterial);
      canopy.position.set(0, 3.25, 0);
      canopy.scale.set(1.45, 0.38, 1);
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      tree.add(canopy);
      tree.position.set(x, groundY, z);
      root.add(tree);
    });

    const shelter = new THREE.Group();
    shelter.name = "ConcealedBushShelter";
    const shelterPoleMaterial = new THREE.MeshStandardMaterial({
      color: "#544938",
      roughness: 1,
    });
    const tarpMaterial = new THREE.MeshStandardMaterial({
      color: "#6d684f",
      roughness: 0.96,
      side: THREE.DoubleSide,
    });
    for (const x of [-2.5, 2.5]) {
      for (const z of [-2, 2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.1, 6), shelterPoleMaterial);
        pole.position.set(x, 1.05, z);
        pole.castShadow = true;
        shelter.add(pole);
      }
    }
    const tarp = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.08, 5), tarpMaterial);
    tarp.position.y = 2.1;
    tarp.rotation.z = 0.05;
    tarp.castShadow = true;
    shelter.add(tarp);
    shelter.position.set(position.x + 18, this.surfaceHeight(position.x + 18, position.z + 28), position.z + 28);
    root.add(shelter);

    const wornVehicle = new THREE.Group();
    wornVehicle.name = "WornAbandonedVehicle";
    const vehicleMaterial = new THREE.MeshStandardMaterial({
      color: "#745f49",
      roughness: 0.88,
      metalness: 0.12,
    });
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: "#201f1d",
      roughness: 1,
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.72, 1.75), vehicleMaterial);
    chassis.position.y = 0.7;
    chassis.castShadow = true;
    wornVehicle.add(chassis);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 1.58), vehicleMaterial);
    cabin.position.set(-0.35, 1.38, 0);
    cabin.castShadow = true;
    wornVehicle.add(cabin);
    for (const x of [-1.25, 1.25]) {
      for (const z of [-0.82, 0.82]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12), wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.45, z);
        wheel.castShadow = true;
        wornVehicle.add(wheel);
      }
    }
    wornVehicle.position.set(position.x - 19, this.surfaceHeight(position.x - 19, position.z - 5), position.z - 5);
    wornVehicle.rotation.y = -0.38;
    root.add(wornVehicle);

    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: "#7a5b2e",
      roughness: 0.9,
    });
    for (let index = 0; index < 3; index += 1) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.2 - index * 0.5, 8), barrierMaterial);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = index * 0.16 - 0.16;
      log.position.set(
        position.x + (index - 1) * 1.2,
        this.surfaceHeight(position.x + (index - 1) * 1.2, position.z) + 0.2,
        position.z + index * 0.35,
      );
      log.castShadow = true;
      root.add(log);
    }
  }

  private clear(): void {
    if (!this.sceneRoot) return;
    this.scene.remove(this.sceneRoot);
    this.sceneRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.sceneRoot = null;
    this.sceneKey = null;
    this.banditModels = [];
    this.witnessModel = null;
    this.witnessStart = null;
    this.witnessDistance = 0;
    this.observationTime = 0;
    this.banditStartPositions = [];
    this.banditRetreatPositions = [];
    this.banditMoveProgress = 0;
    this.banditLoaded = false;
    this.lastPlayerPosition = null;
  }
}
