import type { NavigationNetwork, PedestrianWaypoint, TrafficWaypoint } from "./navigation";

export function buildAbujaNavigationNetwork(): NavigationNetwork {
  const trafficWaypoints = new Map<string, TrafficWaypoint>();
  const pedestrianWaypoints = new Map<string, PedestrianWaypoint>();

  // 1. TRAFFIC NETWORK ALONG ABUJA BOULEVARDS
  // Shehu Shagari Way (x = 0, z from -150 to 150)
  // Direction +1 (Heading South, +Z): Drives on west lane (x = -8)
  // Direction -1 (Heading North, -Z): Drives on east lane (x = +8)
  const zSteps = [-150, -120, -90, -60, -30, 30, 60, 90, 120, 150];

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
      isIntersection: Math.abs(z) === 90,
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
      isIntersection: Math.abs(z) === 90,
    });
  }

  // Constitution Avenue (z = 0, x from -120 to 120)
  // Direction +1 (Heading East, +X): Drives on south lane (z = +7)
  // Direction -1 (Heading West, -X): Drives on north lane (z = -7)
  const xSteps = [-120, -90, -60, -30, 30, 60, 90, 120];

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
      isIntersection: Math.abs(x) === 90,
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
      isIntersection: Math.abs(x) === 90,
    });
  }

  // Interconnect roundabout turns around Central Obelisk (x: 0, z: 0)
  // Roundabout loop: radius 14m
  const roundaboutCount = 8;
  for (let r = 0; r < roundaboutCount; r++) {
    const a = (r / roundaboutCount) * Math.PI * 2;
    const nextA = ((r + 1) % roundaboutCount);
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

  // Connect avenue entrances to roundabout
  const southEntry = trafficWaypoints.get("abuja-shagari-south-4");
  if (southEntry) southEntry.nextIds.push("abuja-roundabout-6");
  const northEntry = trafficWaypoints.get("abuja-shagari-north-5");
  if (northEntry) northEntry.nextIds.push("abuja-roundabout-2");
  const eastEntry = trafficWaypoints.get("abuja-const-east-3");
  if (eastEntry) eastEntry.nextIds.push("abuja-roundabout-0");
  const westEntry = trafficWaypoints.get("abuja-const-west-4");
  if (westEntry) westEntry.nextIds.push("abuja-roundabout-4");

  // 2. PEDESTRIAN WALKWAY NETWORK
  // Sidewalks along Shehu Shagari Way
  for (let pz = -140; pz <= 140; pz += 28) {
    const pEastId = `ped-abuja-east-${pz}`;
    const pWestId = `ped-abuja-west-${pz}`;
    const nextZ = pz + 28 <= 140 ? pz + 28 : -140;

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

  // Central Park paths and Mall plaza pedestrian points
  const parkWaypoints = [
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
  ];

  parkWaypoints.forEach((pw, idx) => {
    const nextIndex = (idx + 1) % parkWaypoints.length;
    pedestrianWaypoints.set(pw.id, {
      id: pw.id,
      x: pw.x,
      z: pw.z,
      area: pw.id.includes("market") ? "market" : "sidewalk",
      nextIds: [parkWaypoints[nextIndex].id],
    });
  });

  return {
    trafficWaypoints,
    trafficWaypointList: Array.from(trafficWaypoints.values()),
    pedestrianWaypoints,
    pedestrianWaypointList: Array.from(pedestrianWaypoints.values()),
  };
}

