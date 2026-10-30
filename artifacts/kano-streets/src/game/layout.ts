export type RoadAxis = "x" | "z";
export type DistrictId = "dala" | "sabon-gari" | "airport-road" | "residential" | "industrial";

export type RoadSpec = {
  axis: RoadAxis;
  center: number;
  width: number;
  name: string;
  arterial: boolean;
};

export const WORLD_BOUNDS = 136;
export const WORLD_EXTENT = WORLD_BOUNDS * 2;
export const WORLD_BOUNDS_NORTH = -230;
export const WORLD_BOUNDS_SOUTH = 136;
export const ROAD_CENTERS = [-124, -62, 0, 62, 124] as const;

export const ROAD_LAYOUT: RoadSpec[] = [
  ...ROAD_CENTERS.map((center): RoadSpec => ({
    axis: "x",
    center,
    width: center === 0 ? 20 : center === -62 ? 14 : Math.abs(center) === 124 ? 10 : 12,
    name: center === 0 ? "Murtala Mohammed Way" : center === -62 ? "Sabon Gari Avenue" : `Dala ${Math.abs(center)} Street`,
    arterial: center === 0 || center === -62,
  })),
  ...ROAD_CENTERS.map((center): RoadSpec => ({
    axis: "z",
    center,
    width: center === 62 ? 24 : center === 0 ? 16 : Math.abs(center) === 124 ? 10 : 12,
    name: center === 62 ? "Airport Road" : center === 0 ? "Bompai Road" : `Dala ${Math.abs(center)} Lane`,
    arterial: center === 0 || center === 62,
  })),
];

export function getDistrict(x: number, z: number): DistrictId {
  if (z <= -120) return "industrial";
  if (x < 0 && z < 0) return "dala";
  if (x < 0 && z >= 0) return "sabon-gari";
  if (x >= 0 && z < 0) return "airport-road";
  return "residential";
}

export function getDistrictLabel(district: DistrictId) {
  switch (district) {
    case "dala": return "DALA · OLD KANO";
    case "sabon-gari": return "SABON GARI";
    case "airport-road": return "AIRPORT ROAD";
    case "residential": return "RESIDENTIAL QUARTER";
    case "industrial": return "KAWU INDUSTRIAL & LOGISTICS DISTRICT";
  }
}

export function getRoadWidth(axis: RoadAxis, center: number) {
  return ROAD_LAYOUT.find((road) => road.axis === axis && road.center === center)?.width ?? 10;
}
