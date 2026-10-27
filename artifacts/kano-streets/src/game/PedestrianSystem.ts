import * as THREE from "three";
import {
  createPedestrianModel,
  type PedestrianOptions,
  type PlayerModel,
} from "./actors";
import { loadHumanoidCharacter } from "./assetManifest";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { ColliderIndex } from "./ColliderIndex";
import type { NavigationNetwork, PedestrianWaypoint } from "./navigation";
import type { GameMaterials, GraphicsQuality } from "./types";

export type PedestrianState = "walking" | "idle" | "vendor" | "talking" | "visiting" | "sitting";
export type NPCRole = "resident" | "trader" | "worker" | "customer" | "worshipper" | "visitor";

export interface Pedestrian {
  id: string;
  name: string;
  role: NPCRole;
  model: PlayerModel;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  state: PedestrianState;
  stateTimer: number;
  currentWaypoint: PedestrianWaypoint | null;
  targetWaypoint: PedestrianWaypoint | null;
  destinationName: string;
  destinationPoint: THREE.Vector3 | null;
  dialogues: string[];
  vendorCry?: string;
  walkPhase: number;
  personalSpeed: number;
  lookSeed: number;
  blockedRetries: number;
  schedulePhase: "commute" | "work" | "leisure" | "rest";
}

const NPC_PALETTES: PedestrianOptions[] = [
  // 1. Traditional Indigo Dyed Kaftan
  {
    skinColor: "#6a442e",
    tunicColor: "#253556",
    trousersColor: "#323c4a",
    capColor: "#a38656",
    embroideryColor: "#d2b47e",
    hasCap: true,
  },
  // 2. Crisp Northern White Babariga
  {
    skinColor: "#7a4e35",
    tunicColor: "#eae5da",
    trousersColor: "#544e45",
    capColor: "#bfa472",
    embroideryColor: "#c2ab7c",
    hasCap: true,
  },
  // 3. Kano Ochre / Golden Brown
  {
    skinColor: "#503223",
    tunicColor: "#9c6828",
    trousersColor: "#423223",
    capColor: "#cfb076",
    embroideryColor: "#e0c386",
    hasCap: true,
  },
  // 4. Sahelian Sage / Olive
  {
    skinColor: "#8c5c3e",
    tunicColor: "#486358",
    trousersColor: "#333d37",
    capColor: "#b29767",
    embroideryColor: "#cfb583",
    hasCap: false,
  },
  // 5. Terracotta / Clay Red
  {
    skinColor: "#5c3a28",
    tunicColor: "#8a3c2c",
    trousersColor: "#3b2823",
    capColor: "#d9bc84",
    embroideryColor: "#dfc78f",
    hasCap: true,
  },
  // 6. Charcoal / Minimalist
  {
    skinColor: "#734833",
    tunicColor: "#333333",
    trousersColor: "#222222",
    capColor: "#c4a770",
    embroideryColor: "#cbb17b",
    hasCap: true,
  },
];

const NPC_ROUTINE_PROFILES = [
  {
    name: "Ibrahim Garba",
    role: "resident" as NPCRole,
    destinationName: "Bompai Heights Luxury Flats",
    destX: 18,
    destZ: 42,
    dialogues: [
      "Sannu! I am heading back towards Bompai Heights. The evening breeze is so peaceful here.",
      "Kano is growing so quickly! The new buildings and apartments along Airport Road look so sharp.",
      "Always obey the traffic signs on Murtala Mohammed Way. KAROTA officers are very watchful today!",
    ],
  },
  {
    name: "Maryam Sani",
    role: "trader" as NPCRole,
    destinationName: "Sabon Gari Open-Air Kasuwa",
    destX: -31,
    destZ: 31,
    dialogues: [
      "Ina kwana! Fresh provisions and textiles arrived this morning. Best prices in Sabon Gari!",
      "Commerce is thriving in Kano! Make sure you visit the electronics arcade and market stalls.",
      "Trade has connected northern Nigeria for centuries. It is the lifeblood of our historic city.",
    ],
  },
  {
    name: "Suleiman Bello",
    role: "worker" as NPCRole,
    destinationName: "Arewa Commercial Bank Plaza",
    destX: 80,
    destZ: -22,
    dialogues: [
      "Barkade! Just stopped by the Arewa Commercial Bank 24/7 ATM. Fast, reliable service today.",
      "Northern finance and technology are moving forward. Hope you have a productive and blessed day!",
      "If you need cash for local market purchases, the bank ATM at Bompai branch is always stocked.",
    ],
  },
  {
    name: "Ngozi Eze",
    role: "customer" as NPCRole,
    destinationName: "Arewa Fast Food & Suya Lounge",
    destX: 16,
    destZ: -42,
    dialogues: [
      "The spiced Kano Suya at Arewa Lounge smells incredible! Getting a dinner platter for my family.",
      "Have you tried their chilled Chapman? It is so refreshing after walking through the city.",
      "Amina Lawal is inside drafting blueprints. She is one of the top modern architects in Kano!",
    ],
  },
  {
    name: "Musa Haruna",
    role: "customer" as NPCRole,
    destinationName: "Kano Cyber & PS5 Game Hub",
    destX: 80,
    destZ: -46,
    dialogues: [
      "Zainab is on an unbelievable winning streak at the Cyber Hub! You should challenge her reflexes.",
      "The fibre optic speeds at the gaming centre are lightning fast. Great tournament atmosphere!",
      "Street Drift Series is happening this week. The ₦5,000 cash prize is serious motivation.",
    ],
  },
  {
    name: "Grace Danjuma",
    role: "worshipper" as NPCRole,
    destinationName: "St. Stephen's Anglican Church",
    destX: -48,
    destZ: 37,
    dialogues: [
      "Peace be with you! St. Stephen's choir is rehearsing lovely hymns for Sunday service.",
      "May your steps be blessed and guided safely through the neighborhood today.",
      "Sabon Gari is a welcoming community where different cultures and faiths live in harmony.",
    ],
  },
  {
    name: "Abubakar Usman",
    role: "worshipper" as NPCRole,
    destinationName: "Community Friday Mosque",
    destX: -31,
    destZ: -31,
    dialogues: [
      "Salam Alaikum! A peaceful day for reflection and brotherhood across Kano.",
      "Kano's heritage is rich and deep. Respect the streets, walk with peace, and drive safely.",
      "The Dala ancient city walls carry over a thousand years of history. Always honor your roots.",
    ],
  },
  {
    name: "Halima Idris",
    role: "resident" as NPCRole,
    destinationName: "Al-Baraka Executive Villa",
    destX: 44,
    destZ: 39,
    dialogues: [
      "Good day! Beautiful afternoon for a stroll through the residential quarter.",
      "The tree-lined roads give our neighborhood such a welcoming and clean atmosphere.",
      "If you are looking for long-term real estate, the modern residential villas are top quality.",
    ],
  },
  {
    name: "Aliyu Sambo",
    role: "worker" as NPCRole,
    destinationName: "Kawu Central Freight Terminal",
    destX: -42,
    destZ: -175,
    dialogues: [
      "Sannu! Shift is busy at Kawu Terminal Bay 02 today. Loading interstate bulk cargo for Kaduna.",
      "Check the dispatch bulletin board by the highway entrance if you want delivery contracts!",
      "Always inspect your cargo straps before driving on the ring road highway.",
    ],
  },
  {
    name: "Malam Danladi",
    role: "worker" as NPCRole,
    destinationName: "Kano Container Yard & Customs Gatehouse",
    destX: 42,
    destZ: -135,
    dialogues: [
      "Barkade! Ensure your freight manifests are stamped before entering the container yard.",
      "Interstate trade is booming. Freight trucks arrive day and night from Lagos and Port Harcourt.",
      "Heavy trucks must weigh in at Dawanau weighbridge platform before departure.",
    ],
  },
  {
    name: "Garba Mechanic",
    role: "worker" as NPCRole,
    destinationName: "Arewa Heavy Vehicle Repairs Workshop",
    destX: -38,
    destZ: -135,
    dialogues: [
      "Ina kwana! Replacing a heavy diesel transmission today. Big torque engines need careful maintenance.",
      "If you need suspension upgrades or engine work, Sani Vulcanizer and our workshop have you covered.",
      "Drive gently over the industrial drainage gratings so you do not damage your tie rods!",
    ],
  },
  {
    name: "Bala Driver",
    role: "worker" as NPCRole,
    destinationName: "Industrial Workers Canteen",
    destX: -15,
    destZ: -155,
    dialogues: [
      "Just hauled grain sacks from Dawanau wholesale depot. Time for hot tea and sweet bread at the canteen!",
      "The northern highway past the gateway is so smooth now. Great connection to the city center.",
      "A good commercial delivery van or pickup truck can make you serious money in Kano.",
    ],
  },
  {
    name: "Habiba Mai Shayi",
    role: "trader" as NPCRole,
    destinationName: "Industrial Workers Canteen",
    destX: -15,
    destZ: -155,
    dialogues: [
      "Maraba! Fresh spiced tea, fried eggs, and warm Kano bread ready for hard-working drivers!",
      "Industrial logistics never sleeps! We keep the tea kettles boiling all day and night.",
      "Eat well and drive safely on the roads. May your trade be blessed with great profit!",
    ],
  },
];

const VENDOR_PROFILES = [
  { name: "Alhaji Lawan", cry: "Fresh Yams and Ripe Plantains straight from Yankaba market! Sannu da zuwa!" },
  { name: "Mallam Yakubu", cry: "Traditional Tuwo grain, beans, and fragrant Northern spices here!" },
  { name: "Mama Blessing", cry: "Original colourful Hollandis and quality guinea brocade fabrics! Good price!" },
  { name: "Chidi Nnamdi", cry: "Quality phone chargers, USB cables, and heavy-duty power banks! Tested and trusted!" },
  { name: "Mai Shayi Garba", cry: "Freshly brewed spiced tea, fried eggs and soft Kano bread! Hot and delicious!" },
];

export class PedestrianSystem {
  public pedestrians: Pedestrian[] = [];
  private readonly root = new THREE.Group();
  private quality: GraphicsQuality = "balanced";
  private time = 0;
  private timeOfDayHours = 10;
  private frameCounter = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materials: GameMaterials,
    private readonly network: NavigationNetwork,
    private readonly colliderIndex: ColliderIndex,
    private readonly surfaceHeight: (x: number, z: number) => number = () => 0,
  ) {
    this.root.name = "pedestrian-system-root";
    this.scene.add(this.root);
    this.spawnCrowd();
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    const targetCount = quality === "performance" ? 12 : quality === "balanced" ? 18 : 24;

    const enableShadows = quality === "quality";
    this.pedestrians.forEach((p) => {
      p.model.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = enableShadows;
        }
      });
    });

    if (this.pedestrians.length < targetCount) {
      if (quality !== "performance" && !this.pedestrians.some((p) => p.id.startsWith("historic_npc_"))) {
        this.spawnHistoricCharacters();
      }
      if (quality !== "performance" && !this.pedestrians.some((p) => p.id.startsWith("dakali_elder_"))) {
        this.spawnDakaliElders();
      }
      if (this.pedestrians.length < targetCount) {
        this.spawnAdditionalWalkers(targetCount - this.pedestrians.length);
      }
    } else if (this.pedestrians.length > targetCount) {
      const cullable = [
        ...this.pedestrians.filter((p) => p.state === "walking"),
        ...this.pedestrians.filter((p) => p.id.startsWith("dakali_elder_")),
        ...this.pedestrians.filter((p) => p.id.startsWith("historic_npc_")),
      ];
      while (this.pedestrians.length > targetCount && cullable.length > 0) {
        const removed = cullable.pop();
        if (removed) {
          const idx = this.pedestrians.indexOf(removed);
          if (idx !== -1) {
            this.pedestrians.splice(idx, 1);
            this.root.remove(removed.model.root);
          }
        }
      }
    }
  }

  public setTimeOfDay(hours: number) {
    this.timeOfDayHours = hours;
  }

  public async upgradeWithRealisticAvatars() {
    try {
      const [maleChar, femaleChar] = await Promise.all([
        loadHumanoidCharacter("/assets/characters/Black_M_1_Casual.glb"),
        loadHumanoidCharacter("/assets/characters/Black_F_1_Casual.glb"),
      ]);

      if (!maleChar && !femaleChar) return;

      this.pedestrians.forEach((p, idx) => {
        const sourceChar = idx % 2 === 0 ? maleChar || femaleChar : femaleChar || maleChar;
        if (sourceChar) {
          const clonedRoot = cloneSkeleton(sourceChar.characterRoot) as THREE.Group;
          p.model.attachRiggedCharacter(clonedRoot, sourceChar.animations);
        }
      });
    } catch (e) {
      console.warn("[PedestrianSystem] Realistic avatars upgrade skipped:", e);
    }
  }

  private spawnCrowd() {
    this.spawnMarketVendors();
    this.spawnIndustrialWorkers();
    this.spawnHistoricCharacters();
    this.spawnDakaliElders();
    const initialWalkerCount = this.quality === "performance" ? 2 : this.quality === "balanced" ? 4 : 8;
    this.spawnAdditionalWalkers(initialWalkerCount);
  }

  private spawnDakaliElders() {
    const elderLocations = [
      {
        x: -72,
        z: -78.2,
        yaw: 0,
        name: "Alhaji Bello Dan-Iya",
        cry: "Barka da yamma. Welcome to sit with us on the Dakali, my son.",
        dest: "Dandali Square Dakali Ledge",
      },
      {
        x: -70.5,
        z: -65.6,
        yaw: Math.PI,
        name: "Malam Sanusi Kurmi",
        cry: "The cool evening breeze of Kano always gathers good friends here.",
        dest: "Dandali Square Neem Shade",
      },
    ];

    elderLocations.forEach((elder, index) => {
      const palette = NPC_PALETTES[(index + 1) % NPC_PALETTES.length];
      const model = createPedestrianModel(this.materials, palette);
      const y = this.surfaceHeight(elder.x, elder.z) + 0.35;

      model.root.position.set(elder.x, y, elder.z);
      model.root.rotation.set(0, elder.yaw, 0);
      this.root.add(model.root);

      this.pedestrians.push({
        id: `dakali_elder_${index}`,
        name: elder.name,
        role: "resident",
        model,
        position: new THREE.Vector3(elder.x, y, elder.z),
        yaw: elder.yaw,
        speed: 0,
        state: "sitting",
        stateTimer: 0,
        currentWaypoint: null,
        targetWaypoint: null,
        destinationName: elder.dest,
        destinationPoint: new THREE.Vector3(elder.x, y, elder.z),
        dialogues: [elder.cry, "The history of this ancient city runs deeper than the rocks of Dala."],
        vendorCry: elder.cry,
        walkPhase: 0,
        personalSpeed: 0,
        lookSeed: index * 3.7 + 1.2,
        blockedRetries: 0,
        schedulePhase: "leisure",
      });
    });
  }

  private spawnHistoricCharacters() {
    const historicCharacters = [
      {
        name: "Malam Kabiru Dan-Kano",
        role: "resident" as NPCRole,
        x: -85,
        z: -68,
        yaw: 0,
        destinationName: "Alhaji Dan-Kano Ancestral Trading House",
        cry: "Assalamu Alaikum. May the blessings of peace rest upon our ancestral home.",
        dialogues: [
          "Assalamu Alaikum, my son. The ancient foundations of our family were laid right here in the shadow of Dala Hill.",
          "Our ancestors held the trans-Saharan trade routes. We must secure our rightful title before modern speculators strip the compound.",
          "Take this 1968 Indenture. Consult the Dandali Clan Elders or the Arewa Bank ledgers to confirm our heritage.",
        ],
      },
      {
        name: "Balarabe Craftsman",
        role: "trader" as NPCRole,
        x: -75,
        z: -85,
        yaw: Math.PI * 0.5,
        destinationName: "Kasuwar Kurmi Leather & Brass Workshop",
        cry: "Finest hand-tanned Kano leather, embossed wallets, and brass filigree! Kasuwar Kurmi quality!",
        dialogues: [
          "Marhaba! For over five hundred years, artisans in Kurmi have carved calabashes and beaten brass with these very tools.",
          "This tanned goat leather was dyed at Kofar Mata. Real vegetal tanning lasts a century without cracking.",
          "Our craftsmanship is celebrated across the Sahel. Trade with honor and your name will outlive you.",
        ],
      },
      {
        name: "Maimuna Mai Masa",
        role: "trader" as NPCRole,
        x: -72,
        z: -72,
        yaw: 0,
        destinationName: "Dandali Community Square Food Stall",
        cry: "Hot crispy Masa rice cakes and spicy pepper sauce! Fresh from the earthen pan!",
        dialogues: [
          "Sannu! Masa is best eaten steaming hot off the charcoal griddle with yaji pepper and honey.",
          "The elders gather under the shade of this grand neem tree every afternoon to settle neighborhood disputes.",
          "A full stomach brings clear thoughts. Sit on the clay dakali and taste authentic Kano tradition.",
        ],
      },
      {
        name: "Master Isa Dyer",
        role: "trader" as NPCRole,
        x: -68,
        z: -105,
        yaw: -Math.PI * 0.5,
        destinationName: "Kofar Mata Historic Dye Pits",
        cry: "True natural indigo! Tie-dyed cotton and royal robes steeped in centuries-old earthen pits!",
        dialogues: [
          "The indigo pits of Kofar Mata have fermented natural dye from ash, potash, and indigo leaves since 1498 CE.",
          "Dip the cotton three times for sky blue, eight times for royal Saharan indigo that shines like bronze.",
          "Tourists and merchants travel from all corners of the world to study our ancient pit chemistry.",
        ],
      },
      {
        name: "Sarkin Pawa Dan-Ladi",
        role: "trader" as NPCRole,
        x: -78,
        z: -78,
        yaw: Math.PI,
        destinationName: "Dandali Meat & Kilishi Drying Court",
        cry: "Thin sun-dried Kilishi beef spiced with ground peanuts and ginger! Prepared by the masters of Kano!",
        dialogues: [
          "Barkade! Good Kilishi requires lean beef sliced wafer-thin, marinated in kuli-kuli paste, and sun-dried on reed mats.",
          "Kilishi fed the desert camel caravans for months without spoiling. It is the food of conquerors and traders.",
          "Take a parcel for your journey across the city. No road trip in Kano is complete without it.",
        ],
      },
    ];

    historicCharacters.forEach((npc, index) => {
      const palette = NPC_PALETTES[(index + 1) % NPC_PALETTES.length];
      const model = createPedestrianModel(this.materials, palette);
      const y = this.surfaceHeight(npc.x, npc.z);

      model.root.position.set(npc.x, y, npc.z);
      model.root.rotation.set(0, npc.yaw, 0);
      this.root.add(model.root);

      this.pedestrians.push({
        id: `historic_npc_${index}`,
        name: npc.name,
        role: npc.role,
        model,
        position: new THREE.Vector3(npc.x, y, npc.z),
        yaw: npc.yaw,
        speed: 0,
        state: "visiting",
        stateTimer: 0,
        currentWaypoint: null,
        targetWaypoint: null,
        destinationName: npc.destinationName,
        destinationPoint: new THREE.Vector3(npc.x, y, npc.z),
        dialogues: npc.dialogues,
        vendorCry: npc.cry,
        walkPhase: index * 1.5,
        personalSpeed: 0,
        lookSeed: index * 2.7,
        blockedRetries: 0,
        schedulePhase: "work",
      });
    });
  }

  private spawnIndustrialWorkers() {
    const industrialWorkers = [
      {
        name: "Habiba Mai Shayi",
        role: "trader" as NPCRole,
        x: -15,
        z: -155,
        yaw: 0,
        destinationName: "Industrial Workers Canteen & Mai Shayi Hub",
        cry: "Maraba! Fresh spiced tea, fried eggs, and warm Kano bread ready for hard-working drivers!",
        dialogues: [
          "Maraba! Fresh spiced tea, fried eggs, and warm Kano bread ready for hard-working drivers!",
          "Industrial logistics never sleeps! We keep the tea kettles boiling all day and night for the shift crews.",
          "Eat well and drive safely on the northern highway. May your trade be blessed with great profit!",
        ],
      },
      {
        name: "Garba Mechanic",
        role: "craftsman" as NPCRole,
        x: -38,
        z: -135,
        yaw: Math.PI * 0.5,
        destinationName: "Arewa Heavy Vehicle Repairs Workshop",
        cry: "Heavy diesel engines, gearboxes, and suspension overhauls! Master Garba handles all fleet repairs!",
        dialogues: [
          "Heavy diesel engines, gearboxes, and suspension overhauls! Master Garba handles all fleet repairs!",
          "Those freight trucks carry 30 tons of produce across Nigeria. Keep their injectors clean!",
          "Sani over on the ring road is a genius with carburetors, but for heavy haulage diesel, we do it here.",
        ],
      },
      {
        name: "Malam Danladi",
        role: "clerk" as NPCRole,
        x: -42,
        z: -175,
        yaw: Math.PI,
        destinationName: "Kawu Central Freight Terminal",
        cry: "Interstate haulage manifests and cargo consignment clearing! Verify your freight documents!",
        dialogues: [
          "Interstate haulage manifests and cargo consignment clearing! Verify your freight documents!",
          "We load grain, machinery, and textiles for Kaduna, Abuja, and Lagos daily. Keep to your dispatch times!",
          "If you are looking for driving contracts, check the Dispatch Board near the entrance gate.",
        ],
      },
      {
        name: "Aliyu Sambo",
        role: "trader" as NPCRole,
        x: 45,
        z: -175,
        yaw: -Math.PI * 0.5,
        destinationName: "Dawanau Grain & Produce Wholesale Depot",
        cry: "Wholesale millet, sorghum, and northern suya spice consignments direct from Dawanau growers!",
        dialogues: [
          "Wholesale millet, sorghum, and northern suya spice consignments direct from Dawanau growers!",
          "Dawanau is the largest grain market in West Africa. Millions in produce move through here every week.",
          "Supplying the local restaurants like Arewa Suya Lounge keeps the city fed and business booming.",
        ],
      },
      {
        name: "Bala Driver",
        role: "driver" as NPCRole,
        x: 42,
        z: -135,
        yaw: 0,
        destinationName: "Kano Inland Container Yard",
        cry: "Container freight cleared and inspected! Waiting for the next heavy haulage dispatch.",
        dialogues: [
          "Container freight cleared and inspected! Waiting for the next heavy haulage dispatch.",
          "Driving a 6-wheeler haulage truck through Kano traffic takes real patience and skill.",
          "Check your air brakes and tire pressure before you hit the highway heading south.",
        ],
      },
    ];

    industrialWorkers.forEach((worker, index) => {
      const palette = NPC_PALETTES[(index + 3) % NPC_PALETTES.length];
      const model = createPedestrianModel(this.materials, palette);
      const y = this.surfaceHeight(worker.x, worker.z);

      model.root.position.set(worker.x, y, worker.z);
      model.root.rotation.set(0, worker.yaw, 0);
      this.root.add(model.root);

      this.pedestrians.push({
        id: `industrial_worker_${index}`,
        name: worker.name,
        role: worker.role,
        model,
        position: new THREE.Vector3(worker.x, y, worker.z),
        yaw: worker.yaw,
        speed: 0,
        state: "visiting",
        stateTimer: 0,
        currentWaypoint: null,
        targetWaypoint: null,
        destinationName: worker.destinationName,
        destinationPoint: new THREE.Vector3(worker.x, y, worker.z),
        dialogues: worker.dialogues,
        vendorCry: worker.cry,
        walkPhase: index * 1.7,
        personalSpeed: 0,
        lookSeed: index * 3.1,
        blockedRetries: 0,
        schedulePhase: "work",
      });
    });
  }

  private spawnMarketVendors() {
    const vendorLocations = [
      { x: -31 - 5.1, z: 31 - 4.2 - 1.1, yaw: 0 },
      { x: -31 + 5.1, z: 31 - 4.2 - 1.1, yaw: 0 },
      { x: -31 - 5.1, z: 31 + 4.2 + 1.1, yaw: Math.PI },
      { x: -31 + 5.1, z: 31 + 4.2 + 1.1, yaw: Math.PI },
      { x: -31, z: 31 - 1.25, yaw: 0 },
    ];

    vendorLocations.forEach((loc, index) => {
      const vProfile = VENDOR_PROFILES[index % VENDOR_PROFILES.length];
      const palette = NPC_PALETTES[index % NPC_PALETTES.length];
      const model = createPedestrianModel(this.materials, palette);
      const y = this.surfaceHeight(loc.x, loc.z);

      model.root.position.set(loc.x, y, loc.z);
      model.root.rotation.set(0, loc.yaw, 0);
      this.root.add(model.root);

      this.pedestrians.push({
        id: `vendor_${index}`,
        name: vProfile.name,
        role: "trader",
        model,
        position: new THREE.Vector3(loc.x, y, loc.z),
        yaw: loc.yaw,
        speed: 0,
        state: "vendor",
        stateTimer: 0,
        currentWaypoint: null,
        targetWaypoint: null,
        destinationName: "Sabon Gari Kasuwa Stall",
        destinationPoint: new THREE.Vector3(loc.x, y, loc.z),
        dialogues: [vProfile.cry, "Welcome to my market stall! Fresh goods everyday!"],
        vendorCry: vProfile.cry,
        walkPhase: index * 1.5,
        personalSpeed: 0,
        lookSeed: index * 2.3,
        blockedRetries: 0,
        schedulePhase: "work",
      });
    });
  }

  private spawnAdditionalWalkers(count: number) {
    const waypoints = this.network.pedestrianWaypointList;
    if (waypoints.length === 0) return;

    for (let i = 0; i < count; i += 1) {
      const valid = waypoints.filter((wp) => {
        const distToPlayer = Math.hypot(wp.x - (-4), wp.z - (-4));
        if (distToPlayer < 12) return false;
        const colliders = this.colliderIndex.query(wp.x, wp.z, 0.45);
        if (colliders.length > 0) return false;
        return true;
      });

      if (valid.length === 0) break;
      const startWp = valid[Math.floor(Math.random() * valid.length)];
      const nextId = startWp.nextIds[Math.floor(Math.random() * startWp.nextIds.length)];
      const nextWp = nextId ? this.network.pedestrianWaypoints.get(nextId) ?? null : null;

      const profile = NPC_ROUTINE_PROFILES[(this.pedestrians.length + i) % NPC_ROUTINE_PROFILES.length];
      const palette = NPC_PALETTES[(this.pedestrians.length + i) % NPC_PALETTES.length];
      const model = createPedestrianModel(this.materials, palette);
      const y = this.surfaceHeight(startWp.x, startWp.z);
      const dx = nextWp ? nextWp.x - startWp.x : 0;
      const dz = nextWp ? nextWp.z - startWp.z : 1;
      const initialYaw = Math.atan2(dx, dz);

      model.root.position.set(startWp.x, y, startWp.z);
      model.root.rotation.set(0, initialYaw, 0);
      this.root.add(model.root);

      this.pedestrians.push({
        id: `ped_${Date.now()}_${i}`,
        name: profile.name,
        role: profile.role,
        model,
        position: new THREE.Vector3(startWp.x, y, startWp.z),
        yaw: initialYaw,
        speed: 1.25,
        state: "walking",
        stateTimer: 4 + Math.random() * 8,
        currentWaypoint: startWp,
        targetWaypoint: nextWp,
        destinationName: profile.destinationName,
        destinationPoint: new THREE.Vector3(profile.destX, 0, profile.destZ),
        dialogues: profile.dialogues,
        walkPhase: Math.random() * Math.PI * 2,
        personalSpeed: 1.1 + Math.random() * 0.35,
        lookSeed: Math.random() * 10,
        blockedRetries: 0,
        schedulePhase: "work",
      });
    }
  }

  public checkPedestrianInteraction(playerPos: THREE.Vector3): { prompt: string; action: () => string } | null {
    for (const p of this.pedestrians) {
      if (p.position.distanceTo(playerPos) <= 2.4) {
        return {
          prompt: `Talk to ${p.name} (${p.role.toUpperCase()})`,
          action: () => {
            if (p.vendorCry) {
              return `${p.name} (${p.role.toUpperCase()}): '${p.vendorCry}'`;
            }
            const quote = p.dialogues[Math.floor(Math.random() * p.dialogues.length)];
            return `${p.name} (${p.role.toUpperCase()}): '${quote}' [Destination: ${p.destinationName}]`;
          },
        };
      }
    }
    return null;
  }

  public update(dt: number, playerPosition: THREE.Vector3, playerVehiclePos: THREE.Vector3 | null) {
    this.time += dt;
    this.frameCounter = (this.frameCounter + 1) % 60;

    for (let i = 0; i < this.pedestrians.length; i += 1) {
      const p = this.pedestrians[i];
      const distToPlayer = p.position.distanceTo(playerPosition);

      if (distToPlayer > 85) {
        continue;
      }

      // Milestone 7: Distance-based LOD update frequency
      if (distToPlayer >= 35 && distToPlayer < 75) {
        if ((this.frameCounter + i) % 3 !== 0) {
          continue;
        }
        this.updatePedestrian(p, dt * 3, playerPosition, playerVehiclePos, i);
      } else if (distToPlayer >= 75) {
        if ((this.frameCounter + i) % 15 !== 0) {
          continue;
        }
        this.updatePedestrian(p, dt * 15, playerPosition, playerVehiclePos, i);
      } else {
        this.updatePedestrian(p, dt, playerPosition, playerVehiclePos, i);
      }
    }
  }

  private updatePedestrian(
    p: Pedestrian,
    dt: number,
    playerPosition: THREE.Vector3,
    playerVehiclePos: THREE.Vector3 | null,
    pedIdx: number,
  ) {
    if (p.state === "vendor") {
      this.animateVendor(p, dt);
      return;
    }

    if (p.state === "sitting") {
      this.animateSitting(p, dt);
      return;
    }

    p.stateTimer -= dt;

    // Check interaction with nearby pedestrians (spontaneous street chatting)
    if (p.state === "walking" && p.stateTimer > 0 && Math.random() < 0.008) {
      for (let j = 0; j < this.pedestrians.length; j++) {
        if (j === pedIdx) continue;
        const other = this.pedestrians[j];
        if (other.state === "walking" && p.position.distanceTo(other.position) <= 2.2) {
          p.state = "talking";
          p.stateTimer = 4.0;
          other.state = "talking";
          other.stateTimer = 4.0;
          p.yaw = Math.atan2(other.position.x - p.position.x, other.position.z - p.position.z);
          other.yaw = Math.atan2(p.position.x - other.position.x, p.position.z - other.position.z);
          break;
        }
      }
    }

    if (p.state === "talking") {
      p.speed = THREE.MathUtils.damp(p.speed, 0, 8, dt);
      if (p.stateTimer <= 0) {
        p.state = "walking";
        p.stateTimer = 6 + Math.random() * 8;
      }
    } else if (p.state === "idle" || p.state === "visiting") {
      p.speed = THREE.MathUtils.damp(p.speed, 0, 8, dt);
      if (p.stateTimer <= 0) {
        p.state = "walking";
        p.stateTimer = 5 + Math.random() * 10;
        if (p.currentWaypoint && p.currentWaypoint.nextIds.length > 0) {
          const nextId = p.currentWaypoint.nextIds[Math.floor(Math.random() * p.currentWaypoint.nextIds.length)];
          p.targetWaypoint = this.network.pedestrianWaypoints.get(nextId) ?? null;
        }
      }
    } else if (p.state === "walking") {
      // Schedule phase & pace adjustment based on time of day
      let schedulePhase: "commute" | "work" | "leisure" | "rest" = "work";
      let scheduleSpeedMult = 1.0;
      if (this.timeOfDayHours >= 6.5 && this.timeOfDayHours < 9.5) {
        schedulePhase = "commute";
        scheduleSpeedMult = 1.25; // Morning rush to commercial hubs and market stalls
      } else if (this.timeOfDayHours >= 9.5 && this.timeOfDayHours < 17.0) {
        schedulePhase = "work";
        scheduleSpeedMult = 1.0; // Daytime trading and industrial logistics
      } else if (this.timeOfDayHours >= 17.0 && this.timeOfDayHours < 21.0) {
        schedulePhase = "leisure";
        scheduleSpeedMult = 0.95; // Evening strolls, Suya lounge, and Dandali square
      } else {
        schedulePhase = "rest";
        scheduleSpeedMult = 0.75; // Quiet night hours
      }
      p.schedulePhase = schedulePhase;

      p.speed = THREE.MathUtils.damp(p.speed, p.personalSpeed * scheduleSpeedMult, 6, dt);

      if (p.destinationPoint && p.position.distanceTo(p.destinationPoint) <= 6.0 && Math.random() < 0.05) {
        p.state = "visiting";
        p.stateTimer = 6.0 + Math.random() * 8.0;
      } else if (p.stateTimer <= 0 && Math.random() < 0.2) {
        p.state = "idle";
        p.stateTimer = 2.5 + Math.random() * 4;
      }

      if (p.targetWaypoint) {
        const dx = p.targetWaypoint.x - p.position.x;
        const dz = p.targetWaypoint.z - p.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < 1.4 * 1.4) {
          p.currentWaypoint = p.targetWaypoint;
          if (p.targetWaypoint.nextIds.length > 0) {
            // Intelligent waypoint selection: bias towards destination point if available
            if (p.destinationPoint) {
              const bestNext = p.targetWaypoint.nextIds
                .map((id) => this.network.pedestrianWaypoints.get(id))
                .filter((wp): wp is PedestrianWaypoint => Boolean(wp))
                .sort((a, b) => {
                  const distA = Math.hypot(a.x - p.destinationPoint!.x, a.z - p.destinationPoint!.z);
                  const distB = Math.hypot(b.x - p.destinationPoint!.x, b.z - p.destinationPoint!.z);
                  return distA - distB;
                })[0];
              p.targetWaypoint = bestNext ?? null;
            } else {
              const nextId = p.targetWaypoint.nextIds[Math.floor(Math.random() * p.targetWaypoint.nextIds.length)];
              p.targetWaypoint = this.network.pedestrianWaypoints.get(nextId) ?? null;
            }
          } else {
            // Safe fallback to any nearby sidewalk waypoint if chain ends
            const fallbackWp = this.network.pedestrianWaypointList.find(
              (wp) => Math.hypot(wp.x - p.position.x, wp.z - p.position.z) < 18 && wp.id !== p.currentWaypoint?.id,
            );
            if (fallbackWp) p.targetWaypoint = fallbackWp;
          }
        }

        if (p.targetWaypoint) {
          const desiredYaw = Math.atan2(
            p.targetWaypoint.x - p.position.x,
            p.targetWaypoint.z - p.position.z,
          );

          let yawDiff = desiredYaw - p.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

          p.yaw += THREE.MathUtils.clamp(yawDiff, -3.2 * dt, 3.2 * dt);
        }
      }
    }

    // Move and avoid obstacles with bounded retries
    if (p.speed > 0.05) {
      const moveX = Math.sin(p.yaw) * p.speed * dt;
      const moveZ = Math.cos(p.yaw) * p.speed * dt;

      const nextX = p.position.x + moveX;
      const nextZ = p.position.z + moveZ;
      const obstacles = this.colliderIndex.query(nextX, nextZ, 0.42);

      if (obstacles.length === 0) {
        p.position.x = nextX;
        p.position.z = nextZ;
        p.blockedRetries = 0;
      } else {
        p.blockedRetries = (p.blockedRetries || 0) + 1;
        p.state = "idle";
        p.stateTimer = 1.0;

        if (p.blockedRetries < 3) {
          // Attempt angle detour around obstacle
          const detourAngle = (p.lookSeed > 5 ? 1 : -1) * (Math.PI * 0.4);
          p.yaw += detourAngle;
        } else {
          // Bounded retries exhausted: choose alternate sidewalk waypoint to prevent infinite loops
          p.blockedRetries = 0;
          const candidateWaypoints = this.network.pedestrianWaypointList.filter((wp) => {
            const dist = Math.hypot(wp.x - p.position.x, wp.z - p.position.z);
            return dist > 4 && dist < 28;
          });
          if (candidateWaypoints.length > 0) {
            p.targetWaypoint = candidateWaypoints[Math.floor(Math.random() * candidateWaypoints.length)];
          } else if (p.currentWaypoint) {
            p.targetWaypoint = p.currentWaypoint;
          }
          if (p.targetWaypoint) {
            p.yaw = Math.atan2(p.targetWaypoint.x - p.position.x, p.targetWaypoint.z - p.position.z);
          }
          p.state = "walking";
          p.stateTimer = 4.0;
        }
      }

      p.position.y = this.surfaceHeight(p.position.x, p.position.z);
    }

    const isMoving = p.speed > 0.15;
    if (p.model.riggedCharacter) {
      if (isMoving) {
        p.model.playAction("walk", 0.2);
      } else {
        p.model.playAction("idle", 0.25);
      }
      p.model.updateAnimation(dt);
      p.model.root.position.set(p.position.x, p.position.y, p.position.z);
      p.model.root.rotation.set(0, p.yaw, 0);
      return;
    }

    if (isMoving) {
      p.walkPhase += dt * (p.speed * 4.2);
    }

    const swing = isMoving ? Math.sin(p.walkPhase) * 0.46 : 0;
    p.model.leftArm.rotation.x = THREE.MathUtils.damp(p.model.leftArm.rotation.x, -swing, 8, dt);
    p.model.rightArm.rotation.x = THREE.MathUtils.damp(p.model.rightArm.rotation.x, swing, 8, dt);
    p.model.leftLeg.rotation.x = THREE.MathUtils.damp(p.model.leftLeg.rotation.x, swing, 8, dt);
    p.model.rightLeg.rotation.x = THREE.MathUtils.damp(p.model.rightLeg.rotation.x, -swing, 8, dt);

    const bounce = isMoving ? Math.abs(Math.sin(p.walkPhase * 2)) * 0.03 : 0;
    p.model.root.position.set(p.position.x, p.position.y + bounce, p.position.z);
    p.model.root.rotation.set(0, p.yaw, 0);

    if (p.model.head) {
      const headYaw = Math.sin(this.time * 0.7 + p.lookSeed) * 0.22;
      p.model.head.rotation.y = THREE.MathUtils.damp(p.model.head.rotation.y, headYaw, 4, dt);
    }
  }

  private animateVendor(p: Pedestrian, dt: number) {
    p.position.y = this.surfaceHeight(p.position.x, p.position.z);
    if (p.model.riggedCharacter) {
      p.model.playAction("idle", 0.25);
      p.model.updateAnimation(dt);
      p.model.root.position.copy(p.position);
      p.model.root.rotation.set(0, p.yaw, 0);
      return;
    }

    const breath = Math.sin(this.time * 1.6 + p.lookSeed) * 0.035;
    p.model.leftArm.rotation.x = THREE.MathUtils.damp(p.model.leftArm.rotation.x, breath, 4, dt);
    p.model.rightArm.rotation.x = THREE.MathUtils.damp(p.model.rightArm.rotation.x, -breath, 4, dt);

    if (p.model.head) {
      const lookAround = Math.sin(this.time * 0.4 + p.lookSeed) * 0.35;
      p.model.head.rotation.y = THREE.MathUtils.damp(p.model.head.rotation.y, lookAround, 3, dt);
    }

    p.model.root.position.copy(p.position);
    p.model.root.rotation.set(0, p.yaw, 0);
  }

  private animateSitting(p: Pedestrian, dt: number) {
    if (p.model.riggedCharacter) {
      p.model.playAction("idle", 0.3);
      p.model.updateAnimation(dt);
      p.model.root.position.copy(p.position);
      p.model.root.rotation.set(0, p.yaw, 0);
      return;
    }

    // Procedural seated pose on clay Dakali ledge
    p.model.leftLeg.rotation.x = Math.PI * 0.42;
    p.model.rightLeg.rotation.x = Math.PI * 0.42;
    p.model.leftLeg.position.y = 0.32;
    p.model.rightLeg.position.y = 0.32;

    const breath = Math.sin(this.time * 1.4 + p.lookSeed) * 0.025;
    p.model.leftArm.rotation.x = THREE.MathUtils.damp(p.model.leftArm.rotation.x, breath + 0.2, 4, dt);
    p.model.rightArm.rotation.x = THREE.MathUtils.damp(p.model.rightArm.rotation.x, -breath + 0.2, 4, dt);

    if (p.model.head) {
      const lookAround = Math.sin(this.time * 0.3 + p.lookSeed) * 0.35;
      p.model.head.rotation.y = THREE.MathUtils.damp(p.model.head.rotation.y, lookAround, 3, dt);
    }

    p.model.root.position.copy(p.position);
    p.model.root.rotation.set(0, p.yaw, 0);
  }

  public dispose() {
    this.pedestrians.forEach((p) => {
      this.root.remove(p.model.root);
    });
    this.pedestrians = [];
    this.scene.remove(this.root);
  }
}
