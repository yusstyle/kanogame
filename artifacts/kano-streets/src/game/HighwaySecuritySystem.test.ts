import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import {
  HIGHWAY_ENCOUNTER_ZONES,
  HighwaySecuritySystem,
} from "./HighwaySecuritySystem";
import { HighwayEncounterScene } from "./HighwayEncounterScene";
import type { GameMaterials } from "./types";

const zone = HIGHWAY_ENCOUNTER_ZONES[0];

test("ordinary city roads stay clear and only the configured outskirts road activates", () => {
  const system = new HighwaySecuritySystem();

  assert.equal(system.update("kano", { x: 0, z: 0 }, 1 / 60), null);
  assert.equal(system.update("abuja", { x: 0, z: 0 }, 1 / 60), null);
  assert.equal(system.getIncident(), null);

  const event = system.update("abuja", zone.position, 1 / 60);
  assert.equal(event?.type, "incident_started");
  assert.equal(system.getIncident()?.zoneId, "abuja-southern-expressway-outer");
  assert.equal(system.getIncident()?.lastKnownLocation.road, "Southern Airport Expressway");
});

test("missing passenger is reported, investigated, rescued, and rewarded without targeting the player", () => {
  const system = new HighwaySecuritySystem();
  system.update("abuja", zone.position, 1 / 60);

  const incident = system.getIncident();
  assert.ok(incident);
  assert.equal(incident.missingPerson.role, "passenger");
  assert.equal(incident.lastKnownLocation.x, zone.position.x);
  assert.equal(system.getActiveMissionSnapshot("abuja", zone.position)?.step, 1);
  assert.match(system.getInteractionPrompt("abuja", zone.position) ?? "", /Report missing passenger/);

  const report = system.interactAt("abuja", zone.position);
  assert.equal(report?.type, "incident_reported");
  assert.equal(system.getIncident()?.policeStatus, "unavailable");
  assert.match(report?.message ?? "", /dispatch and patrol response are unavailable/);

  const firstClue = zone.clues[0];
  assert.match(system.getInteractionPrompt("abuja", firstClue.position) ?? "", /Inspect/);
  assert.equal(system.interactAt("abuja", firstClue.position)?.type, "clue_found");

  const secondClue = zone.clues[1];
  assert.equal(system.interactAt("abuja", secondClue.position)?.type, "clue_found");
  assert.equal(system.getIncident()?.stage, "rescue_ready");
  assert.equal(system.getActiveMissionSnapshot("abuja", zone.rescuePosition)?.step, 4);

  const rescue = system.interactAt("abuja", zone.rescuePosition);
  assert.equal(rescue?.type, "rescued");
  assert.equal(rescue?.rewardCash, 25_000);
  assert.equal(rescue?.reputationGain, 10);
  assert.equal(system.getReputation(), 10);
  assert.equal(system.getIncidentHistory()[0]?.outcome, "rescued");
  assert.equal(system.getActiveMissionSnapshot("abuja", zone.rescuePosition), null);
});

test("vehicle interception, city transitions, and saved investigation progress are safe and persistent", () => {
  const system = new HighwaySecuritySystem();
  system.update("abuja", zone.position, 1 / 60);

  assert.equal(
    system.shouldStopVehicle("abuja", { x: zone.position.x - 12, z: zone.position.z }, 4, Math.PI / 2),
    true,
  );
  assert.equal(
    system.shouldStopVehicle("abuja", { x: zone.position.x - 12, z: zone.position.z }, -4, Math.PI / 2),
    false,
  );

  system.interactAt("abuja", zone.position);
  system.interactAt("abuja", zone.clues[0].position);
  const restored = new HighwaySecuritySystem(system.serialize());

  assert.equal(restored.update("kano", zone.position, 1 / 60), null);
  assert.equal(restored.getActiveMissionSnapshot("kano", zone.position), null);
  assert.equal(restored.getIncident()?.stage, "investigating");
  assert.equal(restored.getIncident()?.cluesFound.length, 1);

  restored.update("abuja", zone.position, 1 / 60);
  assert.equal(restored.getActiveMissionSnapshot("abuja", zone.clues[1].position)?.step, 3);
  restored.interactAt("abuja", zone.clues[1].position);
  restored.interactAt("abuja", zone.rescuePosition);

  for (let frame = 0; frame < 720; frame += 1) {
    restored.update("abuja", zone.position, 0.25);
  }
  assert.equal(restored.getIncident()?.stage, "cooldown");
  assert.equal(restored.update("abuja", zone.position, 0.25), null);

  restored.update("abuja", { x: zone.position.x + 100, z: zone.position.z + 100 }, 0.25);
  assert.equal(restored.update("abuja", zone.position, 0.25)?.type, "incident_started");
});

test("distance-gated scene builds realistic encounter content and cleans up outside Abuja", () => {
  const system = new HighwaySecuritySystem();
  system.update("abuja", zone.position, 1 / 60);
  const threeScene = new THREE.Scene();
  const encounter = new HighwayEncounterScene(
    threeScene,
    {} as GameMaterials,
    (x, z) => 0,
  );

  encounter.update("abuja", zone.position, system.getIncident(), 1 / 60);
  assert.ok(threeScene.getObjectByName("HighwayEncounter:highway-incident-1"));
  assert.ok(threeScene.getObjectByName("HighwayBandit:1"));
  assert.ok(threeScene.getObjectByName("HighwayBandit:2"));
  assert.ok(threeScene.getObjectByName("HighwayBandit:3"));
  assert.ok(threeScene.getObjectByName("FleeingHighwayWitness"));
  assert.ok(threeScene.getObjectByName("HighwayRoadObstruction"));
  assert.ok(threeScene.getObjectByName("ConcealedBushShelter"));
  assert.ok(threeScene.getObjectByName("WornAbandonedVehicle"));

  encounter.update("kano", { x: 0, z: 0 }, system.getIncident(), 1 / 60);
  assert.equal(threeScene.getObjectByName("HighwayEncounter:highway-incident-1"), undefined);

  encounter.dispose();
});
