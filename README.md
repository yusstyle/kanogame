# Kano Streets (Open World 3D Prototype)

An open-world third-person 3D exploration and driving game set in a compact, lively neighborhood inspired by Kano, Northern Nigeria. Built with React 19, TypeScript, Vite, and Three.js.

![Kano Streets](artifacts/kano-streets/public/favicon.svg)

---

## Features

- **Explorable Kano Neighborhood**:
  - Divided into four distinct districts: **Dala (Old Kano)**, **Sabon Gari**, **Airport Road**, and the **Residential Quarter**.
  - Distinctive Northern Nigerian / Hausa vernacular architectural details including arched entrance portals (*zaure* style), parapet horns, carved geometric facade motifs, shaded verandas, and compound perimeter walls.
  - Vibrant market lanes with cloth canopies, roadside stalls, commercial shop signs, street lamps, and concrete gutters.
- **Dual-Mode Gameplay**:
  - **On-Foot Mode**: Play as an avatar in traditional Northern Nigerian attire (embroidered *fila* cap, tunic, trousers, leather sandals/shoes). Walk, run, jump, and freely explore the streets.
  - **Driving Mode**: Enter and drive a sedan through arterial streets and side lanes with responsive acceleration, reverse, steering traction, and an authentic speedometer HUD.
  - Seamless vehicle entry and exit with smooth camera handoffs.
- **Controls**:
  - **Desktop**:
    - Movement: `W`, `A`, `S`, `D` or Arrow keys
    - Look: Mouse movement (clicks to lock pointer)
    - Interact (Enter/Exit Vehicle): `E`
    - Sprint (On Foot): `Shift`
    - Jump (On Foot) / Handbrake (Vehicle): `Space`
    - Reset Position: `R`
    - Pause: `Escape`
  - **Mobile / Touch**:
    - Virtual directional joystick for movement and steering.
    - Touch-drag anywhere on screen for camera orientation.
    - On-screen action buttons for Sprint, Jump/Brake, Enter/Exit Vehicle, and Reset.
- **Graphics & Performance**:
  - Configurable quality presets (`Performance`, `Balanced`, `Quality`) adjusting shadow map resolution, antialiasing, and render distance.
  - Directional sunlight with PCFSoftShadowMap, ambient hemisphere light, and atmospheric haze/fog.
  - Spatial hash collider index (`ColliderIndex`) for collision detection.

---

## Project Structure

```
.
├── artifacts/
│   ├── kano-streets/      # Main Three.js/React game client
│   │   ├── src/
│   │   │   ├── game/      # GameEngine, actors, buildings, layout, world
│   │   │   ├── components/# React HUD, menus, touch controls
│   │   │   └── pages/     # App views
│   │   └── public/assets/ # 3D models and PBR textures
│   ├── api-server/        # Backend API server (Express 5)
│   └── mockup-sandbox/    # UI mockup playground
├── lib/                   # Shared libraries and contracts
└── scripts/               # Project development scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** (v20+ or v24 recommended)
- **pnpm** (v9+ or v12 recommended)
- **Git**

### Installation

```bash
pnpm install
```

### Running the Game Locally

To launch the local development server:

```bash
pnpm --filter @workspace/kano-streets run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build & Unit Tests

```bash
# Typecheck across the entire monorepo
pnpm run typecheck

# Run all game unit tests
cd artifacts/kano-streets
..\..\scripts\node_modules\.bin\tsx.cmd --test src/game/*.test.ts

# Production build
pnpm --filter @workspace/kano-streets run build
```

---

## Milestone G: Real Assets & Visual Realism

- **Real 3D GLTF Assets & Procedural Fallbacks**:
  - `graphite-four-door-sedan.glb`: Real 3D sedan model (CC0, Poly Haven / Martin Lubich) integrated asynchronously into the player driveable car with procedural fallback if missing or loading.
  - `large_iron_gate_1k.gltf`: Ornate compound security gates (CC0, Poly Haven) dynamically fitted into residential compound entrance portals.
- **Sahelian PBR Materials**:
  - `worn_plaster_wall` (CC0, Poly Haven) complete texture map set (`diff_1k.jpg`, `nor_gl_1k.jpg`, `rough_1k.jpg`) integrated into compound walls and building plaster with proper sRGB albedo and linear roughness/normal encoding.
- **Kano Commercial Tricycle (Keke Napep)**:
  - Custom game-ready 3D tricycle model with authentic Kano State commercial livery (canary yellow body `#e8af18`, forest green racing accent `#1f5934`, canvas canopy, front fork steering, dual rear wheels, and Kano plate `KMC 318 KAN`).
  - Full driveable physics, steering yaw animation, wheel rotation, entry/exit distance checks, and dedicated HUD status (`RIDING KEKE` vs `DRIVING SEDAN`).
- **Authentic Northern Nigerian Environment Details**:
  - **Dala Friday Mosque**: Sahelian-arched entrance, emerald dome with brass finial, and towering minaret.
  - **Roadside Infrastructure**: Diesel backup generators with exhaust pipes and elevated black GeePee water storage tanks on steel scaffolding.
  - **Atmospheric Lighting**: Warm Sahelian sun (`#ffeed2`) and dusty midday atmospheric fog (`#d2bf9b`).

---

## Milestone H: Living Kano (Pedestrians, Traffic AI & Dynamic World)

- **Pedestrian System & Street Life (`PedestrianSystem.ts`)**:
  - **Sabon Gari Market Vendors**: Stationed vendors behind fruit and textile market stalls with animated breathing, gestures, and customer-facing idle postures.
  - **Sidewalk Pedestrians**: Walkers dynamically navigating sidewalks along block corridors, crossing lanes, and pausing to browse or look around.
  - **Kano Visual Diversity**: Varied attire (indigo-dyed kaftans, white babariga, ochre robes, terracotta clay, charcoal, sage), fila caps, skin tones, and non-clipping spawn safety.
- **Traffic AI Simulation (`TrafficSystem.ts`)**:
  - **Autonomous Road Network Navigation (`navigation.ts`)**: Right-hand driving along multi-lane avenues and streets, intersection decision making (straight, left, right), and boundary turnaround loops.
  - **Mixed AI Fleet**: Autonomous Sedans (with varied body/accent colors and Nigerian plates) and Keke Napeps.
  - **Intelligent Driving Behaviors**: Smooth waypoint steering, speed modulation, intersection deceleration, following distance maintenance, player vehicle avoidance, emergency braking, and stuck recovery logic.
- **Enhanced Procedural Animation & Kinematics**:
  - **Player Kinematics**: Walking vertical bounce ($0.035\text{m}$), running sprint arm extensions, idle breathing and weight shifts, head sway, and in-air jump poses.
  - **NPC Animation**: Procedural arm/leg swings, subtle vertical bobbing, and conversational head gestures.
- **Performance & Distance Culling**:
  - Distance-based LOD (>85m throttles animations), spatial collision queries via `ColliderIndex`, and graphics quality tiering (`Performance`: 4 traffic / 8 crowd; `Balanced`: 6 traffic / 14 crowd; `Quality`: 8 traffic / 20 crowd with full dynamic shadows).

---

## Milestone I: Visual Realism & World Immersion

- **Sahelian Daylight Lighting & Atmospheric Fog**:
  - Dynamic sun tracking that centers the shadow frustum around the active player/vehicle, ensuring sharp contact shadows and building depth anywhere in the 270m city.
  - Linear distance fog (`near: 42m, far: 230m`) that leaves the immediate neighborhood 100% crisp and saturated while hazing distant horizons.
  - Upgraded desert sky dome: rich azure zenith (`#3e6a88`) softly transitioning through dust cerulean (`#7598ae`) to warm horizon glow (`#dcd4c3`).
- **PBR Road Surfaces & Drainage Infrastructure**:
  - Multi-layered procedural asphalt with aggregate speckling, bitumen seals, and weathering micro-cracks.
  - Open concrete drainage channels (*magudana*) with entry culvert slabs connecting street lanes into compound portals.
- **Urban Kano Streetscape & Props**:
  - **Overhead Utility Lines**: Weathered wooden utility poles with double crossarms, ceramic insulators, and hanging power line cables strung along Murtala Mohammed Way.
  - **Parked Commercial Motorcycles (Okada/Achaba)**: Game-ready Boxer 100cc motorbikes with tubular frame, red/blue fuel tanks, spoke wheels, chrome exhaust pipes, and kickstands parked along sidewalks, shops, and mosques.
- **Hausa Architectural Elements**:
  - *Dakali*: Exterior masonry/earth roadside benches built into compound walls for community conversation.
  - *Zankwaye*: Parapet relief pinnacles crowning compound wall corners.
  - *Zannuwa*: Projecting wooden rainwater drainage spouts protruding from building parapets.
  - Commercial Corrugated Zinc Awnings with metallic PBR finish across Sabon Gari storefronts.
  - Expanded authentic storefront signage (*Al-Ikhlas Cellular & POS*, *Yankaba Fresh Produce*, *Dan Maje Chemist*, *Sani Vulcanizer*, *Mai Shayi Tea & Bread*).

---

## License

MIT (Assets: Poly Haven models and textures under CC0)
