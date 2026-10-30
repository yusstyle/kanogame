import * as THREE from "three";

export type SeatType = "dakali" | "shelter" | "bench" | "cafe_seat" | "sofa";

export interface ValidSeat {
  id: string;
  name: string;
  type: SeatType;
  position: THREE.Vector3;
  yaw: number;
  description: string;
}

export const VALID_SEATS: ValidSeat[] = [
  // 1. Traditional Earthen Dakali Benches
  {
    id: "seat_dakali_dandali",
    name: "Dandali Square Dakali Bench",
    type: "dakali",
    position: new THREE.Vector3(-72.0, 0.45, -78.2),
    yaw: 0,
    description: "Traditional mud conversation bench shaded by neem trees at Dandali Square.",
  },
  {
    id: "seat_dakali_neem",
    name: "Dala Hill Neem Shade Dakali Ledge",
    type: "dakali",
    position: new THREE.Vector3(-70.5, 0.45, -65.6),
    yaw: Math.PI,
    description: "Shaded earthen seating ledge under ancient neem canopy near Dala Hill.",
  },
  {
    id: "seat_dakali_dankano",
    name: "Dan-Kano Compound Zaure Dakali",
    type: "dakali",
    position: new THREE.Vector3(-85.0, 0.45, -68.0),
    yaw: 0,
    description: "Sculpted earthen veranda bench outside the historic Dan-Kano family compound.",
  },
  {
    id: "seat_dakali_albaraka",
    name: "Al-Baraka Zaure Veranda Dakali",
    type: "dakali",
    position: new THREE.Vector3(44.0, 0.45, 39.0),
    yaw: 0,
    description: "Cool shaded clay Dakali bench on the entrance veranda of Al-Baraka Villa.",
  },

  // 2. Commuter Transit Shelters
  {
    id: "seat_shelter_murtala",
    name: "Murtala Mohammed Way Commuter Stand",
    type: "shelter",
    position: new THREE.Vector3(14.0, 0.48, -11.8),
    yaw: 0,
    description: "Covered passenger seating bench along Murtala Mohammed Way.",
  },
  {
    id: "seat_shelter_airport_rd",
    name: "Airport Road Central Bus Stop",
    type: "shelter",
    position: new THREE.Vector3(65.2, 0.48, -22.0),
    yaw: Math.PI / 2,
    description: "Public transit shelter bench servicing the modern commercial district.",
  },
  {
    id: "seat_shelter_sabongari",
    name: "Sabon Gari Tricycle Passenger Shelter",
    type: "shelter",
    position: new THREE.Vector3(-46.0, 0.48, 18.8),
    yaw: 0,
    description: "Commuter transit bench at the Sabon Gari tricycle and minibus terminal.",
  },

  // 3. Mai Shayi Roadside Tea Stand Bench
  {
    id: "seat_maishayi_sabongari",
    name: "Sabon Gari Mai Shayi Tea Stand Bench",
    type: "bench",
    position: new THREE.Vector3(-36.0, 0.35, 19.65),
    yaw: 0,
    description: "Long wooden customer bench for hot spiced tea and freshly baked bread.",
  },

  // 4. Public Neighborhood Benches
  {
    id: "seat_bench_sabongari_park",
    name: "Sabon Gari Sidewalk Bench",
    type: "bench",
    position: new THREE.Vector3(-44.0, 0.52, 27.0),
    yaw: 0,
    description: "Sturdy wooden public bench along Sabon Gari market walkway.",
  },
  {
    id: "seat_bench_residential_w",
    name: "West Quarter Neighborhood Bench",
    type: "bench",
    position: new THREE.Vector3(-20.0, 0.52, 35.0),
    yaw: Math.PI / 2,
    description: "Shaded street bench under acacia canopy in the residential area.",
  },
  {
    id: "seat_bench_central_park",
    name: "Central Promenade Rest Bench",
    type: "bench",
    position: new THREE.Vector3(32.0, 0.52, -34.0),
    yaw: 0,
    description: "Park bench along the central boulevard sidewalk.",
  },
  {
    id: "seat_bench_east_avenue",
    name: "Bompai Way Public Bench",
    type: "bench",
    position: new THREE.Vector3(40.0, 0.52, -27.0),
    yaw: Math.PI / 2,
    description: "Street bench overlooking Bompai avenue.",
  },
];

export function findNearestValidSeat(
  position: THREE.Vector3,
  maxDistance = 2.4,
): ValidSeat | null {
  let nearest: ValidSeat | null = null;
  let minDistance = maxDistance;

  for (const seat of VALID_SEATS) {
    const dist = position.distanceTo(seat.position);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = seat;
    }
  }

  return nearest;
}

export function isValidSeatNearby(
  position: THREE.Vector3,
  maxDistance = 2.5,
): boolean {
  return findNearestValidSeat(position, maxDistance) !== null;
}
