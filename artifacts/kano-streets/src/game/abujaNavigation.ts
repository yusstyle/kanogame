import type { NavigationNetwork, PedestrianWaypoint, TrafficWaypoint } from "./navigation";

export function buildAbujaNavigationNetwork(): NavigationNetwork {
  const trafficWaypoints = new Map<string, TrafficWaypoint>();
  const pedestrianWaypoints = new Map<string, PedestrianWaypoint>();

  // -------------------------------------------------------------
  // 1. TRAFFIC NETWORK ACROSS EXPANDED ABUJA METROPOLIS (2,048m)
  // -------------------------------------------------------------

  // A. Shehu Shagari Way (Arterial 1, N-S at x = 0, z from -840 to 840)
  const zSteps: number[] = [];
  for (let z = -840; z <= 840; z += 60) {
    if (Math.abs(z) === 0) continue; // Skip exact center (handled by roundabout)
    zSteps.push(z);
  }

  for (let i = 0; i < zSteps.length; i++) {
    const z = zSteps[i];
    // Southbound lane (x = -8)
    const southId = `abuja-shagari-south-${i}`;
    const nextSouth = i < zSteps.length - 1 ? [`abuja-shagari-south-${i + 1}`] : [`abuja-shagari-north-${zSteps.length - 1}`];
    trafficWaypoints.set(southId, {
      id: southId,
      x: -8,
      z,
      axis: "z",
      direction: 1,
      roadCenter: 0,
      nextIds: nextSouth,
      isIntersection: Math.abs(z) === 450 || Math.abs(z) === 90,
    });

    // Northbound lane (x = +8)
    const northId = `abuja-shagari-north-${i}`;
    const nextNorth = i > 0 ? [`abuja-shagari-north-${i - 1}`] : [`abuja-shagari-south-0`];
    trafficWaypoints.set(northId, {
      id: northId,
      x: 8,
      z,
      axis: "z",
      direction: -1,
      roadCenter: 0,
      nextIds: nextNorth,
      isIntersection: Math.abs(z) === 450 || Math.abs(z) === 90,
    });
  }

  // B. Constitution Avenue (Arterial 2, E-W at z = 0, x from -840 to 840)
  const xSteps: number[] = [];
  for (let x = -840; x <= 840; x += 60) {
    if (Math.abs(x) === 0) continue;
    xSteps.push(x);
  }

  for (let i = 0; i < xSteps.length; i++) {
    const x = xSteps[i];
    // Eastbound lane (z = +7)
    const eastId = `abuja-const-east-${i}`;
    const nextEast = i < xSteps.length - 1 ? [`abuja-const-east-${i + 1}`] : [`abuja-const-west-${xSteps.length - 1}`];
    trafficWaypoints.set(eastId, {
      id: eastId,
      x,
      z: 7,
      axis: "x",
      direction: 1,
      roadCenter: 0,
      nextIds: nextEast,
      isIntersection: Math.abs(x) === 450 || Math.abs(x) === 90,
    });

    // Westbound lane (z = -7)
    const westId = `abuja-const-west-${i}`;
    const nextWest = i > 0 ? [`abuja-const-west-${i - 1}`] : [`abuja-const-east-0`];
    trafficWaypoints.set(westId, {
      id: westId,
      x,
      z: -7,
      axis: "x",
      direction: -1,
      roadCenter: 0,
      nextIds: nextWest,
      isIntersection: Math.abs(x) === 450 || Math.abs(x) === 90,
    });
  }

  // C. Central Roundabout turns around Central Obelisk (x: 0, z: 0)
  const roundaboutCount = 8;
  for (let r = 0; r < roundaboutCount; r++) {
    const a = (r / roundaboutCount) * Math.PI * 2;
    const nextA = (r + 1) % roundaboutCount;
    const rbId = `abuja-roundabout-${r}`;
    trafficWaypoints.set(rbId, {
      id: rbId,
      x: Math.cos(a) * 14,
      z: Math.sin(a) * 14,
      axis: "z",
      direction: 1,
      roadCenter: 0,
      nextIds: [`abuja-roundabout-${nextA}`],
      isIntersection: true,
    });
  }

  // Interconnect avenues into roundabout near center
  const southEntryIdx = zSteps.findIndex((z) => z === -60);
  if (southEntryIdx >= 0) {
    const southEntry = trafficWaypoints.get(`abuja-shagari-south-${southEntryIdx}`);
    if (southEntry) southEntry.nextIds.push("abuja-roundabout-6");
  }
  const northEntryIdx = zSteps.findIndex((z) => z === 60);
  if (northEntryIdx >= 0) {
    const northEntry = trafficWaypoints.get(`abuja-shagari-north-${northEntryIdx}`);
    if (northEntry) northEntry.nextIds.push("abuja-roundabout-2");
  }
  const eastEntryIdx = xSteps.findIndex((x) => x === -60);
  if (eastEntryIdx >= 0) {
    const eastEntry = trafficWaypoints.get(`abuja-const-east-${eastEntryIdx}`);
    if (eastEntry) eastEntry.nextIds.push("abuja-roundabout-0");
  }
  const westEntryIdx = xSteps.findIndex((x) => x === 60);
  if (westEntryIdx >= 0) {
    const westEntry = trafficWaypoints.get(`abuja-const-west-${westEntryIdx}`);
    if (westEntry) westEntry.nextIds.push("abuja-roundabout-4");
  }

  // D. Outer West Arterial Corridor (x = -450, passing through Maitama, Wuse & Garki West)
  const outerSteps = [-720, -540, -360, -180, 0, 180, 360, 540, 720];
  for (let i = 0; i < outerSteps.length; i++) {
    const z = outerSteps[i];
    const sId = `abuja-outerwest-south-${i}`;
    const nId = `abuja-outerwest-north-${i}`;
    trafficWaypoints.set(sId, {
      id: sId,
      x: -456,
      z,
      axis: "z",
      direction: 1,
      roadCenter: -450,
      nextIds: i < outerSteps.length - 1 ? [`abuja-outerwest-south-${i + 1}`] : [nId],
      isIntersection: z === 0 || z === 450,
    });
    trafficWaypoints.set(nId, {
      id: nId,
      x: -444,
      z,
      axis: "z",
      direction: -1,
      roadCenter: -450,
      nextIds: i > 0 ? [`abuja-outerwest-north-${i - 1}`] : [sId],
      isIntersection: z === 0 || z === -450,
    });
  }

  // E. Southern Airport Expressway (z = +450, passing through Garki & Highway Outskirts)
  for (let i = 0; i < outerSteps.length; i++) {
    const x = outerSteps[i];
    const eId = `abuja-exp-east-${i}`;
    const wId = `abuja-exp-west-${i}`;
    trafficWaypoints.set(eId, {
      id: eId,
      x,
      z: 456,
      axis: "x",
      direction: 1,
      roadCenter: 450,
      nextIds: i < outerSteps.length - 1 ? [`abuja-exp-east-${i + 1}`] : [wId],
      isIntersection: x === 0 || x === -450,
    });
    trafficWaypoints.set(wId, {
      id: wId,
      x,
      z: 444,
      axis: "x",
      direction: -1,
      roadCenter: 450,
      nextIds: i > 0 ? [`abuja-exp-west-${i - 1}`] : [eId],
      isIntersection: x === 0 || x === 450,
    });
  }

  // -------------------------------------------------------------
  // 2. PEDESTRIAN WALKWAY NETWORK ACROSS DISTRICTS
  // -------------------------------------------------------------
  // Sidewalks along Shehu Shagari Way
  for (let pz = -600; pz <= 600; pz += 50) {
    const pEastId = `ped-abuja-east-${pz}`;
    const pWestId = `ped-abuja-west-${pz}`;
    const nextZ = pz + 50 <= 600 ? pz + 50 : -600;

    pedestrianWaypoints.set(pEastId, {
      id: pEastId,
      x: 16,
      z: pz,
      area: "sidewalk",
      nextIds: [`ped-abuja-east-${nextZ}`],
    });

    pedestrianWaypoints.set(pWestId, {
      id: pWestId,
      x: -16,
      z: pz,
      area: "sidewalk",
      nextIds: [`ped-abuja-west-${nextZ}`],
    });
  }

  // Sidewalks along Constitution Avenue through Wuse & CBD
  for (let px = -600; px <= 600; px += 60) {
    const pNorthId = `ped-abuja-north-${px}`;
    const pSouthId = `ped-abuja-south-${px}`;
    const nextX = px + 60 <= 600 ? px + 60 : -600;

    pedestrianWaypoints.set(pNorthId, {
      id: pNorthId,
      x: px,
      z: -14,
      area: "sidewalk",
      nextIds: [`ped-abuja-north-${nextX}`],
    });

    pedestrianWaypoints.set(pSouthId, {
      id: pSouthId,
      x: px,
      z: 14,
      area: "sidewalk",
      nextIds: [`ped-abuja-south-${nextX}`],
    });
  }

  // Key District Plaza & Promenade Destinations
  const districtWaypoints = [
    { id: "ped-park-gate", x: 0, z: 28 },
    { id: "ped-park-fountain-n", x: 0, z: 42 },
    { id: "ped-park-fountain-s", x: 0, z: 58 },
    { id: "ped-park-gazebo-e", x: 14, z: 50 },
    { id: "ped-park-gazebo-w", x: -14, z: 50 },
    { id: "ped-mall-plaza", x: -45, z: 85 },
    { id: "ped-mall-entrance", x: -55, z: 98 },
    { id: "ped-hotel-terrace", x: -45, z: 135 },
    { id: "ped-wuse-market", x: -18, z: 110 },
    { id: "ped-cbn-plaza", x: 75, z: -30 },
    { id: "ped-nnpc-bridge", x: 75, z: 40 },
    { id: "ped-three-arms", x: 0, z: -80 },
    // Expanded District Destinations
    { id: "ped-maitama-diplomatic", x: -450, z: -450 },
    { id: "ped-maitama-hills", x: -350, z: -600 },
    { id: "ped-wuse2-crescent", x: -450, z: 120 },
    { id: "ped-wuse2-plaza", x: -380, z: 220 },
    { id: "ped-garki-ministries", x: -120, z: 450 },
    { id: "ped-garki-estates", x: 120, z: 450 },
    { id: "ped-asokoro-terrace", x: 450, z: -180 },
    { id: "ped-airport-expressway", x: 0, z: 450 },
  ];

  districtWaypoints.forEach((pw, idx) => {
    const nextIndex = (idx + 1) % districtWaypoints.length;
    pedestrianWaypoints.set(pw.id, {
      id: pw.id,
      x: pw.x,
      z: pw.z,
      area: pw.id.includes("market") ? "market" : "sidewalk",
      nextIds: [districtWaypoints[nextIndex].id],
    });
  });

  return {
    trafficWaypoints,
    trafficWaypointList: Array.from(trafficWaypoints.values()),
    pedestrianWaypoints,
    pedestrianWaypointList: Array.from(pedestrianWaypoints.values()),
  };
}
