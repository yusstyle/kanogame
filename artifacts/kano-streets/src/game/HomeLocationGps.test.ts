import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computeGpsGuidance, getGpsLandmark } from './landmarks';
import { getPropertyStreetDescription } from '../components/CityMapModal';
import { PROPERTY_REGISTRY } from './propertyRegistry';
import { GameEngine } from './GameEngine';

function setupMockDOM() {
  if (typeof globalThis.document === 'undefined') {
    const fakeContext = {
      canvas: { width: 512, height: 512 },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: (text: string) => ({ width: text.length * 10, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }),
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => null,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      scale: () => {},
      rotate: () => {},
      translate: () => {},
      transform: () => {},
      setTransform: () => {},
      resetTransform: () => {},
    };

    const fakeCanvas = {
      width: 512,
      height: 512,
      parentElement: { clientWidth: 1280, clientHeight: 720 },
      getContext: () => fakeContext,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      addEventListener: () => {},
      removeEventListener: () => {},
      setPointerCapture: () => {},
      hasPointerCapture: () => false,
      releasePointerCapture: () => {},
      requestPointerLock: () => {},
      style: {},
    };

    const fakeDocument = {
      createElement: (tag: string) => {
        if (tag === 'canvas') return fakeCanvas;
        return { style: {}, addEventListener: () => {}, removeEventListener: () => {} };
      },
      pointerLockElement: null,
      exitPointerLock: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    (globalThis as any).document = fakeDocument;
  }

  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }

  const fakeWindow = {
    devicePixelRatio: 1.5,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  };

  (globalThis as any).window = fakeWindow;
  (globalThis as any).ResizeObserver = FakeResizeObserver;
  (globalThis as any).requestAnimationFrame = () => 1;
  (globalThis as any).cancelAnimationFrame = () => {};
}

test('Home Location GPS: computeGpsGuidance computes distances, cardinal directions and arrival cues', () => {
  // Player at origin (0, 0), targeting Unit 2B exterior entrance at (48, -43.5)
  const targetPos = { x: 48, z: -43.5 };
  const guidanceFar = computeGpsGuidance({ x: 0, z: 0 }, targetPos, 'Airport View Apartments (Unit 2B)', 'Airport Road');

  assert.equal(guidanceFar.targetName, 'Airport View Apartments (Unit 2B)');
  assert.equal(guidanceFar.district, 'Airport Road');
  assert.equal(guidanceFar.distanceMeters, 65); // hypot(48, -43.5) = 64.78 -> 65
  assert.equal(guidanceFar.directionCardinal, 'North-East');
  assert.equal(guidanceFar.isArrived, false);
  assert.match(guidanceFar.instructionText, /Head North-East · 65m to physical entrance door/);

  // Player within close proximity (almost there: 7m away)
  const guidanceClose = computeGpsGuidance({ x: 48, z: -36.5 }, targetPos, 'Unit 2B', 'Airport Road');
  assert.equal(guidanceClose.distanceMeters, 7);
  assert.equal(guidanceClose.isArrived, false);
  assert.match(guidanceClose.instructionText, /Almost there \(7m\)! Entrance door is right ahead/);

  // Player at entrance door (within 3.8m arrival threshold)
  const guidanceArrived = computeGpsGuidance({ x: 48, z: -42.5 }, targetPos, 'Unit 2B', 'Airport Road');
  assert.equal(guidanceArrived.distanceMeters, 1);
  assert.equal(guidanceArrived.isArrived, true);
  assert.match(guidanceArrived.instructionText, /Arrived at Entrance Door! Press \[E\] to Enter/);
});

test('Home Location GPS: getPropertyStreetDescription provides precise district and street landmarks', () => {
  const descU2b = getPropertyStreetDescription('unit-2b');
  assert.match(descU2b, /Airport Road Commercial Corridor/);
  assert.match(descU2b, /Opposite Central Banking Plaza/);

  const descBompai = getPropertyStreetDescription('bompai-penthouse');
  assert.match(descBompai, /Bompai Avenue/);
  assert.match(descBompai, /Luxury Heights Executive Quarter/);

  const descVilla = getPropertyStreetDescription('albaraka-villa');
  assert.match(descVilla, /Residential Quarter/);
  assert.match(descVilla, /Gated Perimeter Villa Estates/);
});

test('Home Location GPS: Property registry entrance doors match physical world coordinates', () => {
  assert.deepEqual(PROPERTY_REGISTRY['unit-2b'].entranceDoor, { x: 48, y: 0, z: -43.5, yaw: 0 });
  assert.deepEqual(PROPERTY_REGISTRY['bompai-penthouse'].entranceDoor, { x: 18, y: 0, z: 39.5, yaw: Math.PI });
  assert.deepEqual(PROPERTY_REGISTRY['albaraka-villa'].entranceDoor, { x: 44, y: 0, z: 45, yaw: 0 });
});

test('Home Location GPS: Multi-home switching, dynamic GPS target update and fast-travel teleport', () => {
  setupMockDOM();
  const renderer = {
    pixelRatio: 1,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  } as unknown as THREE.WebGLRenderer;

  const canvas = (globalThis as any).document.createElement('canvas');
  const engine = new GameEngine(
    canvas,
    {
      onSnapshot: () => {},
      onPause: () => {},
    },
    () => renderer,
  );

  // Initially unleased/unowned: findMyHome returns failure
  const noHomeFind = engine.findMyHome();
  assert.equal(noHomeFind.success, false);

  // 1. Lease Unit 2B
  (engine as any).cash = 100_000;
  (engine as any).hasApartmentRental = true;
  const propU2b = engine.economy.properties.get('unit-2b');
  if (propU2b) propU2b.isRented = true;
  engine.economy.resolveSelectedHome(true);

  const homeNavU2b = engine.getHomeNavInfo();
  assert.ok(homeNavU2b);
  assert.equal(homeNavU2b.propertyId, 'unit-2b');
  assert.equal(homeNavU2b.entranceCoords.x, 48);
  assert.equal(homeNavU2b.entranceCoords.z, -43.5);

  // Activate GPS to home
  const findRes = engine.findMyHome();
  assert.equal(findRes.success, true);
  assert.equal(engine.gpsTargetLandmark, 'my-home');

  const gpsU2b = getGpsLandmark('my-home', homeNavU2b);
  assert.ok(gpsU2b);
  assert.equal(gpsU2b.x, 48);
  assert.equal(gpsU2b.z, -43.5);

  // Dev Teleport Home to Unit 2B entrance
  const teleportRes1 = engine.teleportHome('entrance');
  assert.equal(teleportRes1.success, true);
  assert.equal((engine as any).playerPosition.x, 48);
  assert.equal((engine as any).playerPosition.z, -43.5);

  // 2. Acquire Bompai Penthouse and switch primary home
  engine.economy.purchaseProperty('bompai-penthouse', 40_000_000);
  const switchRes = engine.setSelectedHome('bompai-penthouse');
  assert.equal(switchRes.success, true);

  const homeNavBompai = engine.getHomeNavInfo();
  assert.ok(homeNavBompai);
  assert.equal(homeNavBompai.propertyId, 'bompai-penthouse');
  assert.equal(homeNavBompai.entranceCoords.x, 18);
  assert.equal(homeNavBompai.entranceCoords.z, 39.5);

  // GPS landmark now automatically directs to Bompai
  const gpsBompai = getGpsLandmark('my-home', homeNavBompai);
  assert.ok(gpsBompai);
  assert.equal(gpsBompai.x, 18);
  assert.equal(gpsBompai.z, 39.5);

  // Dev Teleport Home now teleports directly to Bompai entrance
  const teleportRes2 = engine.teleportHome('entrance');
  assert.equal(teleportRes2.success, true);
  assert.equal((engine as any).playerPosition.x, 18);
  assert.equal((engine as any).playerPosition.z, 39.5);
});
