import * as THREE from "three";
import type { Collider } from "./types";
import { ColliderIndex } from "./ColliderIndex";

export type DistrictType =
  | "central_core"
  | "maitama_luxury"
  | "wuse_commercial"
  | "garki_administrative"
  | "asokoro_hillside"
  | "highway_outskirts"
  | "aso_rock_ranges";

export interface StreamingChunk {
  id: string;
  cx: number;
  cz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  center: THREE.Vector3;
  districtType: DistrictType;
  districtName: string;
  group: THREE.Group;
  lod0Group: THREE.Group;
  lod1Group: THREE.Group;
  colliders: Collider[];
  currentLod: number; // 0 = Near (full detail), 1 = Mid, 2 = Far / Unloaded
  isVisible: boolean;
}

export class AbujaStreamingManager {
  readonly chunkSize = 256;
  readonly worldBounds = 1024; // -1024 to +1024 = 2,048m total span
  readonly gridSpan = 8; // 8x8 = 64 chunks

  readonly chunks = new Map<string, StreamingChunk>();
  readonly root = new THREE.Group();
  private lastUpdatePos = new THREE.Vector3(999999, 0, 999999);
  private activeChunkCount = 0;

  constructor() {
    this.root.name = "AbujaStreamingWorldRoot";
  }

  get chunkList(): StreamingChunk[] {
    return Array.from(this.chunks.values());
  }

  get totalChunks(): number {
    return this.chunks.size;
  }

  get activeChunks(): number {
    return this.activeChunkCount;
  }

  /**
   * Registers a chunk into the streaming grid
   */
  registerChunk(chunk: StreamingChunk): void {
    this.chunks.set(chunk.id, chunk);
    this.root.add(chunk.group);
  }

  /**
   * Helper to derive district classification based on coordinates
   */
  getDistrictClassification(cx: number, cz: number): { type: DistrictType; name: string } {
    // Center 2x2: Central Business District & Three Arms Zone
    if ((cx === -1 || cx === 0) && (cz === -1 || cz === 0)) {
      return { type: "central_core", name: "Central Business District & Three Arms" };
    }
    // North: Aso Rock Geological Ranges
    if (cz <= -2) {
      return { type: "aso_rock_ranges", name: "Aso Rock Ranges & Katampe Hills" };
    }
    // Northwest: Maitama Luxury Diplomatic District
    if (cx <= -1 && cz === -1) {
      return { type: "maitama_luxury", name: "Maitama Diplomatic Sector" };
    }
    if (cx <= -2 && cz <= 0) {
      return { type: "maitama_luxury", name: "Maitama Hills & Embassy Enclave" };
    }
    // West: Wuse 1 & Wuse 2 Commercial Corridor
    if (cx <= -2 && cz === 1) {
      return { type: "wuse_commercial", name: "Wuse 1 Markets & Plazas" };
    }
    if (cx <= -1 && cz === 1) {
      return { type: "wuse_commercial", name: "Wuse 2 Commercial & Shopping Arcade" };
    }
    // Southwest & South: Garki Administrative & Residential Districts
    if (cz >= 1 && (cx === 0 || cx === -1)) {
      return { type: "garki_administrative", name: "Garki 1 & 2 Administrative Sector" };
    }
    if (cz >= 2 && cx <= 1) {
      return { type: "garki_administrative", name: "Garki Housing Estates & Ministries" };
    }
    // East: Asokoro Diplomatic & Serpentine Hills
    if (cx >= 1 && cz <= 0) {
      return { type: "asokoro_hillside", name: "Asokoro Diplomatic Sector & Ridge" };
    }
    if (cx >= 2 && cz <= 1) {
      return { type: "asokoro_hillside", name: "Guzape & Asokoro Heights" };
    }
    // Outskirts / Southern Expressway Corridor
    return { type: "highway_outskirts", name: "Federal Highway Transit Corridor & Outskirts" };
  }

  /**
   * Evaluates player position and updates chunk visibility and LOD.
   * Distance thresholds:
   * - Near LOD 0: within 380m (full geometry, shadows, dynamic props)
   * - Mid LOD 1: 380m to 720m (simplified facades, no shadows, simplified roofs)
   * - Far LOD 2: > 720m (culled completely to preserve integrated GPU fill rate)
   */
  update(playerPosition: THREE.Vector3, force = false): void {
    if (!force && playerPosition.distanceToSquared(this.lastUpdatePos) < 16) {
      return; // Player moved less than 4 meters, skip evaluation
    }
    this.lastUpdatePos.copy(playerPosition);

    let activeCount = 0;
    const px = playerPosition.x;
    const pz = playerPosition.z;

    // Distances squared for high-performance threshold comparison on integrated GPUs
    const nearDistSq = 175 * 175; // 30,625
    const midDistSq = 400 * 400;  // 160,000

    for (const chunk of this.chunks.values()) {
      // Clamped closest point on chunk AABB to player for accurate distance calculation
      const closestX = Math.max(chunk.minX, Math.min(px, chunk.maxX));
      const closestZ = Math.max(chunk.minZ, Math.min(pz, chunk.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      // Central core landmarks are standalone in AbujaWorldRoot, so streaming chunks follow standard distance LOD
      if (distSq <= nearDistSq) {
        // LOD 0: Near detail
        chunk.group.visible = true;
        chunk.lod0Group.visible = true;
        chunk.lod1Group.visible = false;
        chunk.currentLod = 0;
        chunk.isVisible = true;
        activeCount++;
      } else if (distSq <= midDistSq) {
        // LOD 1: Mid detail (simplified shells)
        chunk.group.visible = true;
        chunk.lod0Group.visible = false;
        chunk.lod1Group.visible = true;
        chunk.currentLod = 1;
        chunk.isVisible = true;
        activeCount++;
      } else {
        // LOD 2 / Culled
        chunk.group.visible = false;
        chunk.lod0Group.visible = false;
        chunk.lod1Group.visible = false;
        chunk.currentLod = 2;
        chunk.isVisible = false;
      }
    }

    this.activeChunkCount = activeCount;
  }

  /**
   * Retrieves the current district information for any world coordinate
   */
  getDistrictAt(x: number, z: number): string {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const chunkId = `chunk_${cx}_${cz}`;
    const chunk = this.chunks.get(chunkId);
    if (chunk) return chunk.districtName;

    return this.getDistrictClassification(cx, cz).name;
  }

  /**
   * Gathers all active colliders in chunks surrounding the player within radius
   */
  getActiveColliders(x: number, z: number, radius = 250): Collider[] {
    const colliders: Collider[] = [];
    const minCX = Math.floor((x - radius) / this.chunkSize);
    const maxCX = Math.floor((x + radius) / this.chunkSize);
    const minCZ = Math.floor((z - radius) / this.chunkSize);
    const maxCZ = Math.floor((z + radius) / this.chunkSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const chunk = this.chunks.get(`chunk_${cx}_${cz}`);
        if (chunk && chunk.colliders.length > 0) {
          colliders.push(...chunk.colliders);
        }
      }
    }
    return colliders;
  }
}
