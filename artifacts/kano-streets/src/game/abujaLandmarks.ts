import type { LandmarkLocation } from "./landmarks";

export const ABUJA_LANDMARKS: LandmarkLocation[] = [
  {
    id: "aso-rock",
    name: "Aso Rock Granitic Monolith Lookout",
    district: "THREE ARMS ZONE",
    x: 40,
    z: -220,
    category: "civic",
    description: "Towering 400-meter ancient granite inselberg monolith overlooking the presidential and civic zone.",
  },
  {
    id: "national-assembly",
    name: "National Assembly & Three Arms Complex",
    district: "THREE ARMS ZONE",
    x: 0,
    z: -105,
    category: "civic",
    description: "Soaring green dome, 32-column ceremonial portico, and Nigerian National Coat of Arms.",
  },
  {
    id: "national-mosque",
    name: "Abuja National Mosque (Golden Dome)",
    district: "CBD MONUMENTS",
    x: 48,
    z: -42,
    category: "worship",
    description: "Grand central golden dome with four 28-meter slender pencil minarets and marble courtyards.",
  },
  {
    id: "national-christian-centre",
    name: "National Christian Ecumenical Centre",
    district: "CBD EAST",
    x: 48,
    z: 42,
    category: "worship",
    description: "Soaring hyperbolic neo-Gothic concrete spire with stained glass facade and bell tower.",
  },
  {
    id: "cbn-tower",
    name: "Central Bank of Nigeria Corporate Tower",
    district: "FINANCIAL DISTRICT",
    x: 90,
    z: -35,
    category: "commercial",
    description: "Architectural curved high-rise tower with reflective blue-cyan glass curtain wall and rooftop helipad.",
  },
  {
    id: "nnpc-twin-towers",
    name: "NNPC Twin Corporate Towers & Skybridge",
    district: "HERBERT MACAULAY WAY",
    x: 90,
    z: 40,
    category: "commercial",
    description: "Twin cylindrical modern towers with dark green glazing linked by an elevated 30m skybridge.",
  },
  {
    id: "grand-mall",
    name: "Grand Jabi Lake Shopping Mall & Cineplex",
    district: "WUSE 2 COMMERCIAL",
    x: -55,
    z: 88,
    category: "commercial",
    description: "Multi-level modern retail arcade with glass atrium, food court, supermarket, and cinema.",
  },
  {
    id: "luxury-hotel",
    name: "Abuja Continental 5-Star Hotel & Suites",
    district: "WUSE 2 / MAITAMA BORDER",
    x: -55,
    z: 140,
    category: "commercial",
    description: "Tiered luxury hotel with illuminated balconies, turquoise swimming pool, and fine dining terraces.",
  },
  {
    id: "maitama-villa-1",
    name: "Maitama Crest Luxury Executive Residence",
    district: "MAITAMA DIPLOMATIC ESTATES",
    x: -55,
    z: -38,
    category: "residence",
    description: "Ultra-luxury gated contemporary villa with private swimming pool, double carport, and guard booth.",
  },
  {
    id: "maitama-villa-2",
    name: "Zuma View Diplomatic Compound",
    district: "ASOKORO DIPLOMATIC ZONE",
    x: -55,
    z: 38,
    category: "residence",
    description: "Gated multi-room executive mansion with landscaped gardens, solar inverter array, and perimeter wall.",
  },
  {
    id: "central-park",
    name: "Millennium Park Botanical Gardens & Fountains",
    district: "CENTRAL RECREATION",
    x: 0,
    z: 50,
    category: "civic",
    description: "Manicured botanical gardens, multi-tiered water fountain basin, shaded gazebos, and rose walkways.",
  },
  {
    id: "nnpc-mega-station",
    name: "NNPC Mega Fuel Station & QuickMart",
    district: "EXPRESSWAY BYPASS",
    x: 35,
    z: 120,
    category: "commercial",
    description: "8-pump dual-island modern fuel station, digital LED price totem, 24/7 QuickMart, and car wash bay.",
  },
  {
    id: "wuse-market",
    name: "Wuse Kasuwa Modern Market Pavilions",
    district: "WUSE COMMERCIAL",
    x: -18,
    z: 120,
    category: "commercial",
    description: "Covered steel-truss market halls with fresh produce tables, spice stalls, and electronics shops.",
  },
  {
    id: "abuja-toll-gate",
    name: "Highway A2 Intercity Toll Plaza (To Kano)",
    district: "NORTHERN HIGHWAY GATEWAY",
    x: 0,
    z: -160,
    category: "civic",
    description: "Federal Highway A2 toll gateway connecting Abuja north through Kaduna and Zaria to Kano (420 km).",
  },
  {
    id: "abuja-airport-terminal",
    name: "Nnamdi Azikiwe International Airport Shuttle",
    district: "AIRPORT EXPRESSWAY",
    x: 90,
    z: 120,
    category: "civic",
    description: "VIP flight shuttle and terminal concourse with direct domestic flights to Mallam Aminu Kano Airport.",
  },
];

export function getAbujaDistrict(x: number, z: number): string {
  if (z <= -140) return "HIGHWAY A2 · KANO EXPRESSWAY GATEWAY";
  if (z <= -70) return "THREE ARMS ZONE · GOVERNMENT & CIVIC";
  if (x < -30 && z < 60) return "MAITAMA & ASOKORO DIPLOMATIC ESTATES";
  if (x > 30 && z < 60) return "CENTRAL BUSINESS DISTRICT & MONUMENTS";
  if (x < -20 && z >= 60) return "WUSE 2 COMMERCIAL & SHOPPING ARCADE";
  if (Math.abs(x) <= 20 && z > 20 && z <= 80) return "MILLENNIUM PARK & RECREATION GARDENS";
  if (z > 80) return "SOUTHERN OUTSKIRTS · NNPC MEGA STATION & AIRPORT";
  return "CENTRAL ROUNDABOUT · SHEHU SHAGARI WAY";
}

