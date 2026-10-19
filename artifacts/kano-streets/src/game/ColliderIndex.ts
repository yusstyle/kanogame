import type { Collider } from "./types";

const cellKey = (x: number, z: number) => `${x},${z}`;

/**
 * Static world colliders are bucketed once at load time. Walking, vehicle
 * collision, and camera obstruction queries then inspect nearby cells only.
 */
export class ColliderIndex {
  private readonly cells = new Map<string, Collider[]>();

  constructor(
    colliders: readonly Collider[],
    readonly cellSize = 24,
  ) {
    for (const collider of colliders) {
      const minX = Math.floor((collider.x - collider.halfX) / cellSize);
      const maxX = Math.floor((collider.x + collider.halfX) / cellSize);
      const minZ = Math.floor((collider.z - collider.halfZ) / cellSize);
      const maxZ = Math.floor((collider.z + collider.halfZ) / cellSize);

      for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          const key = cellKey(x, z);
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(collider);
          else this.cells.set(key, [collider]);
        }
      }
    }
  }

  query(x: number, z: number, radius: number): Collider[] {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);
    const found = new Set<Collider>();

    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        for (const collider of this.cells.get(cellKey(cellX, cellZ)) ?? []) {
          found.add(collider);
        }
      }
    }
    return [...found];
  }
}
