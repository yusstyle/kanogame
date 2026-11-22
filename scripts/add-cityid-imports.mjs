import fs from "fs";

let p = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/PedestrianSystem.ts", "utf8");
p = p.replace('import type { GameMaterials, GraphicsQuality } from "./types";', 'import type { CityId, GameMaterials, GraphicsQuality } from "./types";');
fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/PedestrianSystem.ts", p, "utf8");

let t = fs.readFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/TrafficSystem.ts", "utf8");
t = t.replace('import type { Collider, GameMaterials, GraphicsQuality } from "./types";', 'import type { CityId, Collider, GameMaterials, GraphicsQuality } from "./types";');
fs.writeFileSync("Kano-3D-Neighborhood-Game/artifacts/kano-streets/src/game/TrafficSystem.ts", t, "utf8");

console.log("Successfully added CityId to both files");
