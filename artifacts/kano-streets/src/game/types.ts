export type Collider = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  height?: number;
};

export type BuildingKind = "traditional" | "modern" | "shop";

export type PlotAsset = {
  root: import("three").Group;
  colliders: Collider[];
};

export type GameMode = "on-foot" | "driving";

export type GameScreen = "menu" | "playing" | "paused";

export type GameSnapshot = {
  mode: GameMode;
  speedKmh: number;
  interactionPrompt: string | null;
  statusMessage: string | null;
};

export type GameMaterials = {
  ground: import("three").MeshStandardMaterial;
  asphalt: import("three").MeshStandardMaterial;
  sidewalk: import("three").MeshStandardMaterial;
  drain: import("three").MeshStandardMaterial;
  plaster: import("three").MeshStandardMaterial;
  ochre: import("three").MeshStandardMaterial;
  clay: import("three").MeshStandardMaterial;
  concrete: import("three").MeshStandardMaterial;
  roof: import("three").MeshStandardMaterial;
  trim: import("three").MeshStandardMaterial;
  darkTrim: import("three").MeshStandardMaterial;
  wood: import("three").MeshStandardMaterial;
  metal: import("three").MeshStandardMaterial;
  glass: import("three").MeshStandardMaterial;
  glassLit: import("three").MeshStandardMaterial;
  cloth: import("three").MeshStandardMaterial;
  clothRed: import("three").MeshStandardMaterial;
  foliage: import("three").MeshStandardMaterial;
  foliageLight: import("three").MeshStandardMaterial;
  bark: import("three").MeshStandardMaterial;
  stone: import("three").MeshStandardMaterial;
  white: import("three").MeshStandardMaterial;
  black: import("three").MeshStandardMaterial;
};
