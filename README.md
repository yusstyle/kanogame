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

# Run GameEngine unit tests
cd artifacts/kano-streets
..\..\scripts\node_modules\.bin\tsx.cmd --test src/game/GameEngine.test.ts

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

## License

MIT (Assets: Poly Haven models and textures under CC0)
