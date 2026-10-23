import { ROAD_CENTERS, ROAD_LAYOUT, getRoadWidth, WORLD_BOUNDS, type RoadAxis } from "./layout";

export type TrafficDirection = 1 | -1;

export interface TrafficWaypoint {
  id: string;
  x: number;
  z: number;
  axis: RoadAxis;
  direction: TrafficDirection;
  roadCenter: number;
  nextIds: string[];
  isIntersection?: boolean;
}

export interface PedestrianWaypoint {
  id: string;
  x: number;
  z: number;
  area: "sidewalk" | "market" | "crosswalk";
  nextIds: string[];
}

export interface NavigationNetwork {
  trafficWaypoints: Map<string, TrafficWaypoint>;
  trafficWaypointList: TrafficWaypoint[];
  pedestrianWaypoints: Map<string, PedestrianWaypoint>;
  pedestrianWaypointList: PedestrianWaypoint[];
}

/**
 * Builds a deterministic lane and intersection graph for vehicle traffic
 * and a sidewalk/market network for pedestrians.
 */
export function buildNavigationNetwork(): NavigationNetwork {
  const trafficWaypoints = new Map<string, TrafficWaypoint>();
  const pedestrianWaypoints = new Map<string, PedestrianWaypoint>();

  // 1. BUILD TRAFFIC NETWORK
  // For each road, define two directional lanes on the right-hand side.
  // X-axis roads (east-west):
  //   direction +1 (heading east, +X): drives on south lane (Z = roadCenter + laneOffset)
  //   direction -1 (heading west, -X): drives on north lane (Z = roadCenter - laneOffset)
  // Z-axis roads (south-north):
  //   direction +1 (heading south, +Z): drives on west lane (X = roadCenter - laneOffset)
  //   direction -1 (heading north, -Z): drives on east lane (X = roadCenter + laneOffset)

  const centers = [...ROAD_CENTERS];
  const roadMargin = WORLD_BOUNDS - 8;

  // Generate road lane waypoints along X-axis roads
  for (const zCenter of centers) {
    const width = getRoadWidth("x", zCenter);
    const laneOffset = Math.max(2.2, width * 0.26);

    for (const dir of [1, -1] as const) {
      const laneZ = zCenter + (dir === 1 ? laneOffset : -laneOffset);
      const points: { x: number; z: number; isInter?: boolean }[] = [];

      // Generate waypoints including intersection approach/exit points
      for (const xCenter of centers) {
        const xCrossWidth = getRoadWidth("z", xCenter);
        const stopDist = xCrossWidth * 0.5 + 2.5;

        if (dir === 1) {
          // Eastbound: approach before intersection, intersection center, departure after
          points.push({ x: xCenter - stopDist, z: laneZ });
          points.push({ x: xCenter, z: laneZ, isInter: true });
          points.push({ x: xCenter + stopDist, z: laneZ });
        } else {
          // Westbound: reverse order
          points.push({ x: xCenter + stopDist, z: laneZ });
          points.push({ x: xCenter, z: laneZ, isInter: true });
          points.push({ x: xCenter - stopDist, z: laneZ });
        }
      }

      // Add boundary turnaround points
      if (dir === 1) {
        points.unshift({ x: -roadMargin, z: laneZ });
        points.push({ x: roadMargin, z: laneZ });
      } else {
        points.unshift({ x: roadMargin, z: laneZ });
        points.push({ x: -roadMargin, z: laneZ });
      }

      for (let i = 0; i < points.length; i += 1) {
        const pt = points[i];
        const id = `tx_${zCenter}_${dir}_${Math.round(pt.x)}`;
        const wp: TrafficWaypoint = {
          id,
          x: pt.x,
          z: pt.z,
          axis: "x",
          direction: dir,
          roadCenter: zCenter,
          nextIds: [],
          isIntersection: pt.isInter,
        };
        trafficWaypoints.set(id, wp);
      }

      // Link forward sequential waypoints
      for (let i = 0; i < points.length - 1; i += 1) {
        const currId = `tx_${zCenter}_${dir}_${Math.round(points[i].x)}`;
        const nextId = `tx_${zCenter}_${dir}_${Math.round(points[i + 1].x)}`;
        const currWp = trafficWaypoints.get(currId);
        if (currWp && !currWp.nextIds.includes(nextId)) {
          currWp.nextIds.push(nextId);
        }
      }
    }
  }

  // Generate road lane waypoints along Z-axis roads
  for (const xCenter of centers) {
    const width = getRoadWidth("z", xCenter);
    const laneOffset = Math.max(2.2, width * 0.26);

    for (const dir of [1, -1] as const) {
      const laneX = xCenter + (dir === 1 ? -laneOffset : laneOffset);
      const points: { x: number; z: number; isInter?: boolean }[] = [];

      for (const zCenter of centers) {
        const zCrossWidth = getRoadWidth("x", zCenter);
        const stopDist = zCrossWidth * 0.5 + 2.5;

        if (dir === 1) {
          points.push({ x: laneX, z: zCenter - stopDist });
          points.push({ x: laneX, z: zCenter, isInter: true });
          points.push({ x: laneX, z: zCenter + stopDist });
        } else {
          points.push({ x: laneX, z: zCenter + stopDist });
          points.push({ x: laneX, z: zCenter, isInter: true });
          points.push({ x: laneX, z: zCenter - stopDist });
        }
      }

      if (dir === 1) {
        points.unshift({ x: laneX, z: -roadMargin });
        points.push({ x: laneX, z: roadMargin });
      } else {
        points.unshift({ x: laneX, z: roadMargin });
        points.push({ x: laneX, z: -roadMargin });
      }

      for (let i = 0; i < points.length; i += 1) {
        const pt = points[i];
        const id = `tz_${xCenter}_${dir}_${Math.round(pt.z)}`;
        const wp: TrafficWaypoint = {
          id,
          x: pt.x,
          z: pt.z,
          axis: "z",
          direction: dir,
          roadCenter: xCenter,
          nextIds: [],
          isIntersection: pt.isInter,
        };
        trafficWaypoints.set(id, wp);
      }

      for (let i = 0; i < points.length - 1; i += 1) {
        const currId = `tz_${xCenter}_${dir}_${Math.round(points[i].z)}`;
        const nextId = `tz_${xCenter}_${dir}_${Math.round(points[i + 1].z)}`;
        const currWp = trafficWaypoints.get(currId);
        if (currWp && !currWp.nextIds.includes(nextId)) {
          currWp.nextIds.push(nextId);
        }
      }
    }
  }

  // Turnaround link at boundaries (pass 2 now that all waypoints exist)
  for (const zCenter of centers) {
    const eastEnd = trafficWaypoints.get(`tx_${zCenter}_1_${Math.round(roadMargin)}`);
    const westStart = trafficWaypoints.get(`tx_${zCenter}_-1_${Math.round(roadMargin)}`);
    if (eastEnd && westStart && !eastEnd.nextIds.includes(westStart.id)) {
      eastEnd.nextIds.push(westStart.id);
    }
    const westEnd = trafficWaypoints.get(`tx_${zCenter}_-1_${Math.round(-roadMargin)}`);
    const eastStart = trafficWaypoints.get(`tx_${zCenter}_1_${Math.round(-roadMargin)}`);
    if (westEnd && eastStart && !westEnd.nextIds.includes(eastStart.id)) {
      westEnd.nextIds.push(eastStart.id);
    }
  }

  for (const xCenter of centers) {
    const southEnd = trafficWaypoints.get(`tz_${xCenter}_1_${Math.round(roadMargin)}`);
    const northStart = trafficWaypoints.get(`tz_${xCenter}_-1_${Math.round(roadMargin)}`);
    if (southEnd && northStart && !southEnd.nextIds.includes(northStart.id)) {
      southEnd.nextIds.push(northStart.id);
    }
    const northEnd = trafficWaypoints.get(`tz_${xCenter}_-1_${Math.round(-roadMargin)}`);
    const southStart = trafficWaypoints.get(`tz_${xCenter}_1_${Math.round(-roadMargin)}`);
    if (northEnd && southStart && !northEnd.nextIds.includes(southStart.id)) {
      northEnd.nextIds.push(southStart.id);
    }
  }

  // Cross-link intersections so vehicles can turn left or right
  for (const xCenter of centers) {
    for (const zCenter of centers) {
      // Find intersection waypoints
      const eastWp = trafficWaypoints.get(`tx_${zCenter}_1_${xCenter}`);
      const westWp = trafficWaypoints.get(`tx_${zCenter}_-1_${xCenter}`);
      const southWp = trafficWaypoints.get(`tz_${xCenter}_1_${zCenter}`);
      const northWp = trafficWaypoints.get(`tz_${xCenter}_-1_${zCenter}`);

      const zWidth = getRoadWidth("x", zCenter);
      const xWidth = getRoadWidth("z", xCenter);
      const zOffset = Math.max(2.2, zWidth * 0.26);
      const xOffset = Math.max(2.2, xWidth * 0.26);
      const zStop = zWidth * 0.5 + 2.5;
      const xStop = xWidth * 0.5 + 2.5;

      // Turning from Eastbound (heading +X):
      // Right turn -> Southbound (+Z) departure: (xCenter - xOffset, zCenter + zStop)
      // Left turn -> Northbound (-Z) departure: (xCenter + xOffset, zCenter - zStop)
      if (eastWp) {
        const turnRight = trafficWaypoints.get(`tz_${xCenter}_1_${Math.round(zCenter + zStop)}`);
        const turnLeft = trafficWaypoints.get(`tz_${xCenter}_-1_${Math.round(zCenter - zStop)}`);
        if (turnRight) eastWp.nextIds.push(turnRight.id);
        if (turnLeft) eastWp.nextIds.push(turnLeft.id);
      }

      // Turning from Westbound (heading -X):
      // Right turn -> Northbound (-Z) departure: (xCenter + xOffset, zCenter - zStop)
      // Left turn -> Southbound (+Z) departure: (xCenter - xOffset, zCenter + zStop)
      if (westWp) {
        const turnRight = trafficWaypoints.get(`tz_${xCenter}_-1_${Math.round(zCenter - zStop)}`);
        const turnLeft = trafficWaypoints.get(`tz_${xCenter}_1_${Math.round(zCenter + zStop)}`);
        if (turnRight) westWp.nextIds.push(turnRight.id);
        if (turnLeft) westWp.nextIds.push(turnLeft.id);
      }

      // Turning from Southbound (heading +Z):
      // Right turn -> Westbound (-X) departure: (xCenter - xStop, zCenter - zOffset)
      // Left turn -> Eastbound (+X) departure: (xCenter + xStop, zCenter + zOffset)
      if (southWp) {
        const turnRight = trafficWaypoints.get(`tx_${zCenter}_-1_${Math.round(xCenter - xStop)}`);
        const turnLeft = trafficWaypoints.get(`tx_${zCenter}_1_${Math.round(xCenter + xStop)}`);
        if (turnRight) southWp.nextIds.push(turnRight.id);
        if (turnLeft) southWp.nextIds.push(turnLeft.id);
      }

      // Turning from Northbound (heading -Z):
      // Right turn -> Eastbound (+X) departure: (xCenter + xStop, zCenter + zOffset)
      // Left turn -> Westbound (-X) departure: (xCenter - xStop, zCenter - zOffset)
      if (northWp) {
        const turnRight = trafficWaypoints.get(`tx_${zCenter}_1_${Math.round(xCenter + xStop)}`);
        const turnLeft = trafficWaypoints.get(`tx_${zCenter}_-1_${Math.round(xCenter - xStop)}`);
        if (turnRight) northWp.nextIds.push(turnRight.id);
        if (turnLeft) northWp.nextIds.push(turnLeft.id);
      }
    }
  }

  // 2. BUILD PEDESTRIAN NETWORK
  // Sidewalk paths along block edges between intersections
  const blockCenters = centers.slice(0, -1).map((c, i) => (c + centers[i + 1]) / 2);

  for (let zi = 0; zi < centers.length; zi += 1) {
    const zCenter = centers[zi];
    const roadWidth = getRoadWidth("x", zCenter);
    const sidewalkOffset = roadWidth / 2 + 1.25;

    for (const side of [-1, 1] as const) {
      const swZ = zCenter + side * sidewalkOffset;
      // Along each segment between vertical roads
      for (let xi = 0; xi < centers.length - 1; xi += 1) {
        const xStart = centers[xi] + getRoadWidth("z", centers[xi]) / 2 + 2;
        const xEnd = centers[xi + 1] - getRoadWidth("z", centers[xi + 1]) / 2 - 2;
        const step = 8;
        const pts: string[] = [];

        for (let x = xStart; x <= xEnd; x += step) {
          const id = `ped_sw_x_${Math.round(x)}_${Math.round(swZ)}`;
          pts.push(id);
          pedestrianWaypoints.set(id, {
            id,
            x,
            z: swZ,
            area: "sidewalk",
            nextIds: [],
          });
        }

        // Link bidirectionally along the sidewalk
        for (let k = 0; k < pts.length - 1; k += 1) {
          pedestrianWaypoints.get(pts[k])?.nextIds.push(pts[k + 1]);
          pedestrianWaypoints.get(pts[k + 1])?.nextIds.push(pts[k]);
        }
      }
    }
  }

  for (let xi = 0; xi < centers.length; xi += 1) {
    const xCenter = centers[xi];
    const roadWidth = getRoadWidth("z", xCenter);
    const sidewalkOffset = roadWidth / 2 + 1.25;

    for (const side of [-1, 1] as const) {
      const swX = xCenter + side * sidewalkOffset;
      for (let zi = 0; zi < centers.length - 1; zi += 1) {
        const zStart = centers[zi] + getRoadWidth("x", centers[zi]) / 2 + 2;
        const zEnd = centers[zi + 1] - getRoadWidth("x", centers[zi + 1]) / 2 - 2;
        const step = 8;
        const pts: string[] = [];

        for (let z = zStart; z <= zEnd; z += step) {
          const id = `ped_sw_z_${Math.round(swX)}_${Math.round(z)}`;
          pts.push(id);
          pedestrianWaypoints.set(id, {
            id,
            x: swX,
            z,
            area: "sidewalk",
            nextIds: [],
          });
        }

        for (let k = 0; k < pts.length - 1; k += 1) {
          pedestrianWaypoints.get(pts[k])?.nextIds.push(pts[k + 1]);
          pedestrianWaypoints.get(pts[k + 1])?.nextIds.push(pts[k]);
        }
      }
    }
  }

  // Market Plaza pedestrian waypoints at Sabon Gari (blockCenter at -31, 31)
  const marketCenterX = -31;
  const marketCenterZ = 31;
  const marketPts: string[] = [];
  for (let mx = -14; mx <= 14; mx += 6) {
    for (let mz = -14; mz <= 14; mz += 6) {
      const id = `ped_market_${Math.round(marketCenterX + mx)}_${Math.round(marketCenterZ + mz)}`;
      marketPts.push(id);
      pedestrianWaypoints.set(id, {
        id,
        x: marketCenterX + mx,
        z: marketCenterZ + mz,
        area: "market",
        nextIds: [],
      });
    }
  }

  // Cross-link market plaza grid points
  for (let i = 0; i < marketPts.length; i += 1) {
    const curr = pedestrianWaypoints.get(marketPts[i]);
    if (!curr) continue;
    for (let j = 0; j < marketPts.length; j += 1) {
      if (i === j) continue;
      const other = pedestrianWaypoints.get(marketPts[j]);
      if (!other) continue;
      const dist = Math.hypot(curr.x - other.x, curr.z - other.z);
      if (dist <= 8.5) {
        curr.nextIds.push(other.id);
      }
    }
  }

  // Link market to nearest sidewalk
  const marketEdge = pedestrianWaypoints.get(`ped_market_${Math.round(marketCenterX - 14)}_${Math.round(marketCenterZ)}`);
  if (marketEdge) {
    // Find closest sidewalk point
    let closest: PedestrianWaypoint | null = null;
    let minDist = Infinity;
    for (const [id, wp] of pedestrianWaypoints) {
      if (wp.area === "sidewalk") {
        const d = Math.hypot(wp.x - marketEdge.x, wp.z - marketEdge.z);
        if (d < minDist) {
          minDist = d;
          closest = wp;
        }
      }
    }
    if (closest && minDist < 20) {
      marketEdge.nextIds.push(closest.id);
      closest.nextIds.push(marketEdge.id);
    }
  }

  return {
    trafficWaypoints,
    trafficWaypointList: Array.from(trafficWaypoints.values()),
    pedestrianWaypoints,
    pedestrianWaypointList: Array.from(pedestrianWaypoints.values()),
  };
}

/**
 * Finds the nearest traffic waypoint to a given world coordinate.
 */
export function findNearestTrafficWaypoint(
  network: NavigationNetwork,
  x: number,
  z: number,
  preferredAxis?: RoadAxis,
): TrafficWaypoint | null {
  let nearest: TrafficWaypoint | null = null;
  let minDist = Infinity;

  for (const wp of network.trafficWaypointList) {
    if (preferredAxis && wp.axis !== preferredAxis) continue;
    const dist = (wp.x - x) ** 2 + (wp.z - z) ** 2;
    if (dist < minDist) {
      minDist = dist;
      nearest = wp;
    }
  }

  return nearest;
}

/**
 * Picks the next waypoint for a vehicle, choosing randomly at intersections.
 */
export function getNextTrafficWaypoint(
  network: NavigationNetwork,
  current: TrafficWaypoint,
  rng = Math.random,
): TrafficWaypoint | null {
  if (current.nextIds.length === 0) return null;
  if (current.nextIds.length === 1) {
    return network.trafficWaypoints.get(current.nextIds[0]) ?? null;
  }

  // At intersections: prefer straight ahead 60%, turn right 20%, turn left 20%
  const choice = current.nextIds[Math.floor(rng() * current.nextIds.length)];
  return network.trafficWaypoints.get(choice) ?? null;
}
