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
import { isValidSeatNearby, findNearestValidSeat, type ValidSeat } from "./seats";

export type PedestrianState = "walking" | "idle" | "vendor" | "talking" | "visiting" | "sitting";
export type NPCRole = "resident" | "trader" | "worker" | "customer" | "worshipper" | "visitor";
export type DiurnalSchedulePhase = "commute" | "work" | "leisure" | "rest";

export interface RoutineDestination {
  destinationName: string;
  destX: number;
  destZ: number;
}

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
  schedulePhase: DiurnalSchedulePhase;
  schedule?: Record<DiurnalSchedulePhase, RoutineDestination>;
}

export function getDiurnalPhase(hours: number): DiurnalSchedulePhase {
  if (hours >= 6.0 && hours < 9.5) return "commute";
  if (hours >= 9.5 && hours < 17.0) return "work";
  if (hours >= 17.0 && hours < 21.0) return "leisure";
  return "rest";
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
  // 6. Charcoal / Minimalist Modern
  {
    skinColor: "#734833",
    tunicColor: "#333333",
    trousersColor: "#222222",
    capColor: "#c4a770",
    embroideryColor: "#cbb17b",
    hasCap: true,
  },
  // 7. Royal Saharan Indigo & Gold
  {
    skinColor: "#633f2c",
    tunicColor: "#1d2b4f",
    trousersColor: "#1a243a",
    capColor: "#dfb45f",
    embroideryColor: "#ecc978",
    hasCap: true,
  },
  // 8. Desert Sand / Harmattan Beige
  {
    skinColor: "#825338",
    tunicColor: "#c9b693",
    trousersColor: "#5e5241",
    capColor: "#aa8e60",
    embroideryColor: "#dfcca3",
    hasCap: true,
  },
  // 9. Deep Maroon / Ancient Dye
  {
    skinColor: "#523321",
    tunicColor: "#692a2a",
    trousersColor: "#3d2222",
    capColor: "#cca062",
    embroideryColor: "#dab77f",
    hasCap: true,
  },
  // 10. Forest Green & Bronze
  {
    skinColor: "#784b34",
    tunicColor: "#234a34",
    trousersColor: "#1a3325",
    capColor: "#bda069",
    embroideryColor: "#c9ab73",
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
    schedule: {
      commute: { destinationName: "Murtala Mohammed Way Transit Stop", destX: 14, destZ: -12 },
      work: { destinationName: "Arewa Commercial Bank Plaza", destX: 80, destZ: -22 },
      leisure: { destinationName: "Dandali Community Square", destX: -72, destZ: -72 },
      rest: { destinationName: "Bompai Heights Luxury Flats", destX: 18, destZ: 42 },
    },
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
    schedule: {
      commute: { destinationName: "Sabon Gari Market Entrance Gate", destX: -24, destZ: 22 },
      work: { destinationName: "Sabon Gari Open-Air Kasuwa", destX: -31, destZ: 31 },
      leisure: { destinationName: "Arewa Fast Food & Suya Lounge", destX: 16, destZ: -42 },
      rest: { destinationName: "Airport Road Residential Quarters", destX: -48, destZ: 42 },
    },
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
    schedule: {
      commute: { destinationName: "Bank Junction Crosswalk", destX: 76, destZ: -14 },
      work: { destinationName: "Arewa Commercial Bank Plaza", destX: 80, destZ: -22 },
      leisure: { destinationName: "Kano Cyber & PS5 Game Hub", destX: 80, destZ: -46 },
      rest: { destinationName: "Bompai Heights Luxury Flats", destX: 18, destZ: 42 },
    },
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
    schedule: {
      commute: { destinationName: "Sabon Gari Kasuwa Stalls", destX: -31, destZ: 31 },
      work: { destinationName: "Electronics & Textile Arcade", destX: -36, destZ: 26 },
      leisure: { destinationName: "Arewa Fast Food & Suya Lounge", destX: 16, destZ: -42 },
      rest: { destinationName: "Airport Road Residential Apartments", destX: 14, destZ: 36 },
    },
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
    schedule: {
      commute: { destinationName: "Murtala Mohammed Way Walkway", destX: 42, destZ: -12 },
      work: { destinationName: "Arewa Commercial Bank Plaza", destX: 80, destZ: -22 },
      leisure: { destinationName: "Kano Cyber & PS5 Game Hub", destX: 80, destZ: -46 },
      rest: { destinationName: "Al-Baraka Executive Villa", destX: 44, destZ: 39 },
    },
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
    schedule: {
      commute: { destinationName: "St. Stephen's Church Walkway", destX: -42, destZ: 32 },
      work: { destinationName: "Sabon Gari Community Center", destX: -48, destZ: 37 },
      leisure: { destinationName: "Sabon Gari Kasuwa Market Square", destX: -31, destZ: 31 },
      rest: { destinationName: "Airport Road Residential Apartments", destX: -48, destZ: 42 },
    },
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
    schedule: {
      commute: { destinationName: "Community Friday Mosque", destX: -31, destZ: -31 },
      work: { destinationName: "Dandali Heritage Square", destX: -72, destZ: -72 },
      leisure: { destinationName: "Dandali Neem Shade Dakali", destX: -70, destZ: -65 },
      rest: { destinationName: "Ancestral Dala Quarters", destX: -85, destZ: -68 },
    },
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
    schedule: {
      commute: { destinationName: "Bompai Tree-Lined Avenue", destX: 35, destZ: 25 },
      work: { destinationName: "Sabon Gari Market Stalls", destX: -31, destZ: 31 },
      leisure: { destinationName: "Arewa Suya Lounge Garden", destX: 16, destZ: -42 },
      rest: { destinationName: "Al-Baraka Executive Villa", destX: 44, destZ: 39 },
    },
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
    schedule: {
      commute: { destinationName: "Kawu Freight Dispatch Board", destX: -42, destZ: -140 },
      work: { destinationName: "Kawu Central Freight Terminal", destX: -42, destZ: -175 },
      leisure: { destinationName: "Industrial Workers Canteen", destX: -15, destZ: -155 },
      rest: { destinationName: "Kawu Drivers Bunkhouse", destX: -38, destZ: -160 },
    },
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
    schedule: {
      commute: { destinationName: "Container Yard Inspection Gate", destX: 42, destZ: -125 },
      work: { destinationName: "Kano Container Yard & Customs Gatehouse", destX: 42, destZ: -135 },
      leisure: { destinationName: "Industrial Workers Canteen", destX: -15, destZ: -155 },
      rest: { destinationName: "Northern Logistics Quarters", destX: 35, destZ: -145 },
    },
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
    schedule: {
      commute: { destinationName: "Arewa Repairs Workshop Gate", destX: -38, destZ: -125 },
      work: { destinationName: "Arewa Heavy Vehicle Repairs Workshop", destX: -38, destZ: -135 },
      leisure: { destinationName: "Industrial Workers Canteen", destX: -15, destZ: -155 },
      rest: { destinationName: "Workers Dormitory", destX: -25, destZ: -145 },
    },
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
    schedule: {
      commute: { destinationName: "Highway Service Station", destX: 10, destZ: -125 },
      work: { destinationName: "Dawanau Produce Wholesale Depot", destX: 45, destZ: -175 },
      leisure: { destinationName: "Industrial Workers Canteen", destX: -15, destZ: -155 },
      rest: { destinationName: "Kawu Drivers Rest Area", destX: -15, destZ: -165 },
    },
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
  public trafficVehicles: { position: THREE.Vector3; speed: number; yaw: number }[] = [];

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

  public setTrafficVehicles(vehicles: { position: THREE.Vector3; speed: number; yaw: number }[]) {
    this.trafficVehicles = vehicles;
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
        // Preserve procedural seated geometry for seated citizens (e.g. Dakali elders on clay benches)
        // because rigged humanoid avatars only contain standing locomotion mocap clips.
        if (p.state === "sitting") return;

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

  public isPositionBlocked(
    x: number,
    z: number,
    radius = 0.38,
    playerVehiclePos?: THREE.Vector3 | null,
  ): boolean {
    if (this.hasObstacleAt(x, z, radius)) return true;

    for (let i = 0; i < this.trafficVehicles.length; i++) {
      const v = this.trafficVehicles[i];
      const dx = x - v.position.x;
      const dz = z - v.position.z;
      const vRad = 1.6;
      if (dx * dx + dz * dz < (radius + vRad) * (radius + vRad)) {
        return true;
      }
    }

    if (playerVehiclePos) {
      const dx = x - playerVehiclePos.x;
      const dz = z - playerVehiclePos.z;
      const vRad = 1.7;
      if (dx * dx + dz * dz < (radius + vRad) * (radius + vRad)) {
        return true;
      }
    }

    return false;
  }

  private hasObstacleAt(x: number, z: number, radius = 0.35): boolean {
    const nearby = this.colliderIndex.query(x, z, radius + 1.0);
    return nearby.some((col) => {
      const closestX = THREE.MathUtils.clamp(x, col.x - col.halfX, col.x + col.halfX);
      const closestZ = THREE.MathUtils.clamp(z, col.z - col.halfZ, col.z + col.halfZ);
      const dx = x - closestX;
      const dz = z - closestZ;
      return dx * dx + dz * dz < radius * radius;
    });
  }

  private spawnAdditionalWalkers(count: number) {
    const waypoints = this.network.pedestrianWaypointList;
    if (waypoints.length === 0) return;

    for (let i = 0; i < count; i += 1) {
      const valid = waypoints.filter((wp) => {
        const distToPlayer = Math.hypot(wp.x - (-4), wp.z - (-4));
        if (distToPlayer < 12) return false;
        if (this.hasObstacleAt(wp.x, wp.z, 0.35)) return false;
        return true;
      });

      if (valid.length === 0) break;

      // Prioritize active Northern Nigerian urban hubs (Kasuwa Market, Transit Stops, Bompai Plaza, Dandali Square)
      const hubCandidates = valid.filter((wp) => {
        if (wp.area === "market" || wp.area === "crosswalk") return true;
        const distKasuwa = Math.hypot(wp.x - (-31), wp.z - 31);
        const distBusStop = Math.hypot(wp.x - 65, wp.z - (-22));
        const distMurtalaStop = Math.hypot(wp.x - 14, wp.z - (-11.8));
        const distBompai = Math.hypot(wp.x - 76, wp.z - (-18));
        const distDandali = Math.hypot(wp.x - (-72), wp.z - (-72));
        return distKasuwa < 26 || distBusStop < 24 || distMurtalaStop < 22 || distBompai < 24 || distDandali < 26;
      });

      const pool = hubCandidates.length > 0 && Math.random() < 0.75 ? hubCandidates : valid;
      const startWp = pool[Math.floor(Math.random() * pool.length)];
      const nextId = startWp.nextIds[Math.floor(Math.random() * startWp.nextIds.length)];
      const nextWp = nextId ? this.network.pedestrianWaypoints.get(nextId) ?? null : null;

      const profile = NPC_ROUTINE_PROFILES[i % NPC_ROUTINE_PROFILES.length];
      const palette = NPC_PALETTES[i % NPC_PALETTES.length];
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
        schedule: profile.schedule,
      });
    }
  }

  public isAtValidSeat(p: Pedestrian): boolean {
    return isValidSeatNearby(p.position, 2.8);
  }

  public checkPedestrianInteraction(
    playerPos: THREE.Vector3,
    consequenceResolver?: (
      npcName: string,
      dialogues: string[],
    ) => { greeting: string; quote: string; trustStatus: string; perkOffered?: string } | null,
  ): { prompt: string; action: () => string; perkOffered?: string } | null {
    for (const p of this.pedestrians) {
      if (p.position.distanceTo(playerPos) <= 2.4) {
        return {
          prompt: `Talk to ${p.name} (${p.role.toUpperCase()})`,
          action: () => {
            // NPC turns smoothly and immediately to face the player
            p.yaw = Math.atan2(playerPos.x - p.position.x, playerPos.z - p.position.z);
            p.model.root.rotation.set(0, p.yaw, 0);
            p.state = "talking";
            p.stateTimer = 5.0;
            p.speed = 0;

            if (consequenceResolver) {
              const res = consequenceResolver(p.name, p.dialogues);
              if (res) {
                return `${p.name} (${p.role.toUpperCase()}): ${res.greeting} '${res.quote}' [Reputation: ${res.trustStatus.toUpperCase()}]`;
              }
            }

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

    // Schedule phase & dynamic routine transition without abrupt teleportation
    const schedulePhase = getDiurnalPhase(this.timeOfDayHours);
    if (p.schedule && p.schedule[schedulePhase]) {
      const targetRoutine = p.schedule[schedulePhase];
      if (p.schedulePhase !== schedulePhase) {
        p.schedulePhase = schedulePhase;
        p.destinationName = targetRoutine.destinationName;
        p.destinationPoint = new THREE.Vector3(targetRoutine.destX, 0, targetRoutine.destZ);
        if (p.state === "visiting" || p.state === "idle") {
          p.state = "walking";
          p.stateTimer = 4.0 + Math.random() * 6.0;
        }
      }
    } else {
      p.schedulePhase = schedulePhase;
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
      const distToPlayer = p.position.distanceTo(playerPosition);
      if (distToPlayer <= 3.5) {
        const targetYaw = Math.atan2(playerPosition.x - p.position.x, playerPosition.z - p.position.z);
        let yawDiff = targetYaw - p.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        p.yaw += THREE.MathUtils.clamp(yawDiff, -4.5 * dt, 4.5 * dt);
      }
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
      let scheduleSpeedMult = 1.0;
      if (schedulePhase === "commute") {
        scheduleSpeedMult = 1.2; // Brisk morning rush to commercial hubs and market stalls
      } else if (schedulePhase === "work") {
        scheduleSpeedMult = 1.0; // Daytime trading and industrial logistics
      } else if (schedulePhase === "leisure") {
        scheduleSpeedMult = 0.95; // Evening strolls, Suya lounge, and Dandali square
      } else {
        scheduleSpeedMult = 0.75; // Quiet night hours
      }

      // Safe road crossing behavior at crosswalks
      if (p.targetWaypoint?.area === "crosswalk") {
        const oncomingFastVeh = this.trafficVehicles.some((v) => {
          const dist = Math.hypot(v.position.x - p.position.x, v.position.z - p.position.z);
          return dist < 14.0 && Math.abs(v.speed) > 1.8;
        });
        if (oncomingFastVeh && p.stateTimer > 0) {
          p.speed = THREE.MathUtils.damp(p.speed, 0, 8.0, dt);
          p.state = "idle";
          p.stateTimer = 1.8;
          return;
        }
      }

      p.speed = THREE.MathUtils.damp(p.speed, p.personalSpeed * scheduleSpeedMult, 6, dt);

      // Nighttime residential rest check: resting at residential quarters during night phase
      if (schedulePhase === "rest" && p.destinationPoint && p.position.distanceTo(p.destinationPoint) <= 6.0) {
        if (Math.random() < 0.1) {
          p.state = "idle";
          p.stateTimer = 15.0 + Math.random() * 20.0;
        }
      } else if (p.destinationPoint && p.position.distanceTo(p.destinationPoint) <= 6.0 && Math.random() < 0.05) {
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

    // Move and avoid obstacles with forward whisker and pedestrian-to-pedestrian separation
    if (p.speed > 0.05) {
      const sinYaw = Math.sin(p.yaw);
      const cosYaw = Math.cos(p.yaw);

      // 1. Forward whisker probe (0.85m ahead) to detect obstacles early and steer smoothly
      const whiskerDist = 0.85;
      const whiskerX = p.position.x + sinYaw * whiskerDist;
      const whiskerZ = p.position.z + cosYaw * whiskerDist;
      const whiskerBlocked = this.isPositionBlocked(whiskerX, whiskerZ, 0.38, playerVehiclePos);

      if (whiskerBlocked) {
        const steerDir = p.lookSeed > 5 ? 1 : -1;
        p.yaw += steerDir * 2.6 * dt;
        p.speed = THREE.MathUtils.damp(p.speed, p.personalSpeed * 0.45, 6.0, dt);
      }

      const stepDist = p.speed * dt;
      const nextX = p.position.x + Math.sin(p.yaw) * stepDist;
      const nextZ = p.position.z + Math.cos(p.yaw) * stepDist;
      const isBlocked = this.isPositionBlocked(nextX, nextZ, 0.35, playerVehiclePos);

      if (!isBlocked) {
        // Pedestrian-to-pedestrian personal space separation (prevents crowding and overlapping)
        let sepX = 0;
        let sepZ = 0;
        for (let j = 0; j < this.pedestrians.length; j++) {
          if (j === pedIdx) continue;
          const other = this.pedestrians[j];
          const dx = p.position.x - other.position.x;
          const dz = p.position.z - other.position.z;
          const distSq = dx * dx + dz * dz;
          const personalSpace = 0.92;
          if (distSq < personalSpace * personalSpace && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const push = (personalSpace - dist) / personalSpace;
            sepX += (dx / dist) * push * 2.4;
            sepZ += (dz / dist) * push * 2.4;
          }
        }

        p.position.x = nextX + sepX * dt;
        p.position.z = nextZ + sepZ * dt;
        p.blockedRetries = 0;
      } else {
        p.blockedRetries = (p.blockedRetries || 0) + 1;
        p.state = "idle";
        p.stateTimer = 0.8;
        p.speed = 0;

        if (p.blockedRetries < 3) {
          // Attempt angle detour around obstacle
          const detourAngle = (p.lookSeed > 5 ? 1 : -1) * (Math.PI * 0.4);
          p.yaw += detourAngle;
        } else {
          // Bounded retries exhausted: choose alternate sidewalk waypoint to prevent infinite loops
          p.blockedRetries = 0;
          const candidateWaypoints = this.network.pedestrianWaypointList.filter((wp) => {
            const dist = Math.hypot(wp.x - p.position.x, wp.z - p.position.z);
            return dist > 4 && dist < 28 && !this.isPositionBlocked(wp.x, wp.z, 0.4, playerVehiclePos);
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
    }

    // Firm ground contact: ensure feet are always accurately grounded on surface height
    p.position.y = this.surfaceHeight(p.position.x, p.position.z);

    // Strict upright posture guarantee: no pitch (x=0) and no roll (z=0)
    p.model.root.rotation.set(0, p.yaw, 0);
    p.model.proceduralBody.rotation.set(0, 0, 0);
    if (p.model.riggedCharacter) {
      p.model.riggedCharacter.rotation.set(0, 0, 0);
    }

    const isMoving = p.speed > 0.15;
    if (p.model.riggedCharacter) {
      if (isMoving) {
        p.model.playAction("walk", 0.2);
        p.model.setTimeScale?.(Math.min(1.8, Math.max(0.6, p.speed / 1.35)));
      } else {
        p.model.playAction("idle", 0.25);
        p.model.setTimeScale?.(1.0);
      }
      p.model.updateAnimation(dt);
      p.model.root.position.set(p.position.x, p.position.y, p.position.z);
      return;
    }

    if (isMoving) {
      p.walkPhase += dt * (p.speed * 4.2);
    }

    const swing = isMoving ? Math.sin(p.walkPhase) * 0.46 : 0;
    const idleBreath = !isMoving ? Math.sin(this.time * 2.1 + p.lookSeed) * 0.035 : 0;

    if (p.state === "talking") {
      // Natural conversational arm gesture and head nod while talking
      const talkGesture = Math.sin(this.time * 3.2 + p.lookSeed) * 0.16 + 0.14;
      p.model.rightArm.rotation.x = THREE.MathUtils.damp(p.model.rightArm.rotation.x, talkGesture, 6, dt);
      p.model.leftArm.rotation.x = THREE.MathUtils.damp(p.model.leftArm.rotation.x, idleBreath, 6, dt);
      p.model.leftLeg.rotation.x = THREE.MathUtils.damp(p.model.leftLeg.rotation.x, 0, 8, dt);
      p.model.rightLeg.rotation.x = THREE.MathUtils.damp(p.model.rightLeg.rotation.x, 0, 8, dt);
    } else {
      p.model.leftArm.rotation.x = THREE.MathUtils.damp(p.model.leftArm.rotation.x, -swing + idleBreath, 8, dt);
      p.model.rightArm.rotation.x = THREE.MathUtils.damp(p.model.rightArm.rotation.x, swing - idleBreath, 8, dt);
      p.model.leftLeg.rotation.x = THREE.MathUtils.damp(p.model.leftLeg.rotation.x, swing, 8, dt);
      p.model.rightLeg.rotation.x = THREE.MathUtils.damp(p.model.rightLeg.rotation.x, -swing, 8, dt);
    }

    const bounce = isMoving ? Math.abs(Math.sin(p.walkPhase * 2)) * 0.03 : 0;
    p.model.root.position.set(p.position.x, p.position.y + bounce, p.position.z);
    p.model.root.rotation.set(0, p.yaw, 0);

    if (p.model.head) {
      const distToPlayer = p.position.distanceTo(playerPosition);
      let targetHeadYaw = Math.sin(this.time * 0.7 + p.lookSeed) * 0.22;
      if (distToPlayer <= 2.8) {
        const toPlayer = Math.atan2(playerPosition.x - p.position.x, playerPosition.z - p.position.z) - p.yaw;
        let headDiff = toPlayer;
        while (headDiff > Math.PI) headDiff -= Math.PI * 2;
        while (headDiff < -Math.PI) headDiff += Math.PI * 2;
        if (Math.abs(headDiff) < 1.2) {
          targetHeadYaw = headDiff * 0.55;
        }
      }
      p.model.head.rotation.y = THREE.MathUtils.damp(p.model.head.rotation.y, targetHeadYaw, 4, dt);
    }
  }

  private animateVendor(p: Pedestrian, dt: number) {
    p.position.y = this.surfaceHeight(p.position.x, p.position.z);
    p.model.root.rotation.set(0, p.yaw, 0);
    p.model.proceduralBody.rotation.set(0, 0, 0);
    if (p.model.riggedCharacter) {
      p.model.riggedCharacter.rotation.set(0, 0, 0);
      p.model.playAction("idle", 0.25);
      p.model.updateAnimation(dt);
      p.model.root.position.copy(p.position);
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
  }

  private animateSitting(p: Pedestrian, dt: number) {
    p.position.y = this.surfaceHeight(p.position.x, p.position.z) + 0.35;
    p.model.root.rotation.set(0, p.yaw, 0);
    p.model.proceduralBody.rotation.set(0, 0, 0);
    if (p.model.riggedCharacter) {
      p.model.riggedCharacter.rotation.set(0, 0, 0);
      p.model.proceduralBody.visible = true;
      p.model.riggedCharacter.visible = false;
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
  }

  public dispose() {
    this.pedestrians.forEach((p) => {
      this.root.remove(p.model.root);
    });
    this.pedestrians = [];
    this.scene.remove(this.root);
  }
}
