import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNavigationNetwork,
  findNearestTrafficWaypoint,
  getNextTrafficWaypoint,
} from "./navigation";
import { WORLD_BOUNDS } from "./layout";

test("navigation network builds valid traffic and pedestrian graphs", () => {
  const network = buildNavigationNetwork();

  assert.ok(network.trafficWaypointList.length > 50, "Traffic waypoints are generated");
  assert.ok(network.pedestrianWaypointList.length > 50, "Pedestrian waypoints are generated");

  // Verify all waypoints are within world bounds
  for (const wp of network.trafficWaypointList) {
    assert.ok(Math.abs(wp.x) <= WORLD_BOUNDS, `Traffic waypoint X within bounds: ${wp.x}`);
    assert.ok(Math.abs(wp.z) <= WORLD_BOUNDS, `Traffic waypoint Z within bounds: ${wp.z}`);
    assert.ok(wp.nextIds.length > 0, `Traffic waypoint ${wp.id} has downstream connections`);
  }

  for (const pwp of network.pedestrianWaypointList) {
    assert.ok(Math.abs(pwp.x) <= WORLD_BOUNDS, `Pedestrian waypoint X within bounds: ${pwp.x}`);
    assert.ok(Math.abs(pwp.z) <= WORLD_BOUNDS, `Pedestrian waypoint Z within bounds: ${pwp.z}`);
  }

  // Verify intersections have turn choices
  const intersectionWps = network.trafficWaypointList.filter((wp) => wp.isIntersection);
  assert.ok(intersectionWps.length >= 25, "All 25 road grid intersections exist");
  assert.ok(intersectionWps.some((wp) => wp.nextIds.length > 1), "Intersections support turning");

  // Verify spatial query
  const nearest = findNearestTrafficWaypoint(network, 0, 0);
  assert.ok(nearest !== null, "Nearest waypoint found at center");
  assert.ok(Math.hypot(nearest.x, nearest.z) < 15, "Nearest waypoint is close to origin");

  // Verify traversal
  const next = getNextTrafficWaypoint(network, nearest);
  assert.ok(next !== null, "Can advance to next waypoint");
  assert.notEqual(next.id, nearest.id, "Next waypoint is distinct from current");
});

