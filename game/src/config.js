// NEON BAY round 2 — tuning, city layout, story data and side content.
// My own numbers for this entry: a denser 7x7 city, six chained story
// missions, ten hidden neon tokens and three stunt ramps.
export const CFG = {
  // City grid: 7 x 7 blocks, 44 m blocks, 14 m roads (pitch 58 m).
  pitch: 58,
  blockHalf: 22,
  roadHalf: 7,
  cityHalf: 210,
  beachZ: 210, // sand starts at the south edge
  waterZ: 238, // water plane starts here
  dockX: 210, // docks start at the east edge
  yachtX: 188, // Mara's yacht moored off the south-east beach
  yachtZ: 226,

  // Road centre lines (8 each axis, derived from the grid above).
  roads: [-203, -145, -87, -29, 29, 87, 145, 203],
  laneOffset: 3.5,

  player: {
    walkSpeed: 6,
    runSpeed: 10.5,
    radius: 0.6,
    health: 100,
    punchDamage: 14,
    punchRange: 2.4,
    punchArc: 1.15,
    pistolDamage: 34,
    pistolRange: 90,
    magSize: 12,
    reloadTime: 1.1,
  },

  car: {
    accel: 16,
    brake: 32,
    reverseMax: 9,
    maxSpeed: 38,
    steerMax: 0.55,
    grip: 6,
    handbrakeGrip: 1.6,
    trafficSpeed: 9,
    trafficCount: 20, // round 2: busier streets
    sportsAccel: 22,
    sportsMax: 48, // the casino sports car is the fastest ride in town
    sportsGrip: 7.5,
    vanAccel: 12,
    vanMax: 30,
  },

  ped: {
    count: 28, // round 2: fuller sidewalks
    walkSpeed: 1.6,
    fleeSpeed: 4.4,
  },

  police: {
    maxCars: 5,
    maxFoot: 6,
    carSpeed: 43,
    footSpeed: 7.5,
    ramDamage: 14,
    arrestTime: 1.2,
    arrestRadius: 1.6,
    spawnDistance: 85,
    despawnDistance: 170,
    carNearRadius: 45, // a police car closer than this blocks heat decay
    footNearRadius: 40,
    heliMinStars: 4, // the police helicopter only hunts at 4-5 stars
    heliSpeed: 30,
    heliHeight: 26,
  },

  // Wanted: heat 0..100; stars = heat thresholds. Crimes add heat.
  wanted: {
    stealCar: 22,
    shoot: 14,
    punchPed: 10,
    killPed: 25,
    killCop: 45,
    ramPolice: 18,
    decayPerSec: 2.2, // only while no crime recently and no police close
    decayDelay: 6, // seconds after the last crime before decay starts
    starAt: [1, 20, 40, 60, 80], // heat needed for 1..5 stars
  },

  enemy: { count: 4, health: 60, damage: 7, shootRange: 42, shootInterval: 1.1 },

  // Story places (x, z) on the city map.
  places: {
    sedan: { x: 29, z: 87 }, // M1: the marked sedan waits here
    garage: { x: -87, z: -87 }, // M1: deliver the sedan here
    safehouse: { x: -145, z: 145 }, // M2: reach here after losing the heat
    docks: { x: 224, z: 60 }, // M3: rival crew at the docks
    bank: { x: 0, z: -58 }, // M4: the bank van
    bankVan: { x: 29, z: -58 },
    dropoff: { x: 145, z: 145 }, // M4: deliver the package here
    harbor: { x: 224, z: -20 }, // M5: pick up the cargo at the harbor docks
    yacht: { x: 188, z: 226 }, // M5 + M6: Mara's yacht, the final drop
    casino: { x: -145, z: -145 }, // M6: the rare sports car is parked here
    start: { x: -29, z: 116 }, // player spawn, near the beach road
  },

  missions: [
    {
      id: 1, name: 'Hot Wheels', pay: 500,
      brief: 'Mara needs a clean sedan. Steal the marked car and bring it to the garage.',
      objective: 'Steal the marked sedan',
    },
    {
      id: 2, name: 'Getaway', pay: 800,
      brief: 'The crew is hot. Lose the 2-star heat, then slip to the safehouse.',
      objective: 'Lose the heat, then reach the safehouse',
    },
    {
      id: 3, name: 'Payback', pay: 1200,
      brief: 'The rival crew jumped Jax at the docks. Settle it — all four of them.',
      objective: 'Take out the rival crew at the docks (0/4)',
    },
    {
      id: 4, name: 'The Big Score', pay: 2500,
      brief: 'Grab the package from the bank van and run it across town under 3-star heat.',
      objective: 'Grab the package from the bank van',
    },
    {
      id: 5, name: 'Harbor Lights', pay: 1800,
      brief: 'A cargo crate is waiting at the harbor docks. Grab it, then run it to Mara\'s yacht — fast leg, and keep the heat under 4 stars for the bonus.',
      objective: 'Pick up the cargo at the harbor',
    },
    {
      id: 6, name: 'The Last Job', pay: 4000,
      brief: 'The finale. Steal the rare sports car from the casino, shake the 4-star heat, and deliver it to Mara\'s yacht. No second chances.',
      objective: 'Steal the sports car from the casino',
    },
  ],

  // M5 timed leg: seconds to run the cargo from the harbor to the yacht.
  harborLegSeconds: 90,
  harborLowHeatBonus: 300, // extra cash if delivered with 3 stars or less

  // Optional side work: taxi fares and a checkpoint time trial.
  taxi: { pay: 120, pickupRadius: 4, dropoffRadius: 6 },
  trial: { pay: 300, timeLimit: 75, checkpoints: 5 },

  // Round 2 side content: 10 hidden neon tokens, 3 stunt ramps.
  tokens: {
    payEach: 150,
    payAllBonus: 1000,
    spots: [
      { x: -203, z: -203 }, { x: 203, z: -203 }, { x: -203, z: 203 },
      { x: 203, z: 116 }, { x: 0, z: -29 }, { x: -87, z: 29 },
      { x: 87, z: -145 }, { x: -29, z: 203 }, { x: 145, z: -87 },
      { x: 224, z: 20 },
    ],
  },
  ramps: {
    pay: 200,
    minSpeed: 18,
    spots: [
      { x: 29, z: -29, heading: 0 },
      { x: -145, z: 87, heading: Math.PI / 2 },
      { x: 145, z: 203, heading: -Math.PI / 2 },
    ],
  },

  colors: {
    skyTop: 0x2b1b4d,
    skyHorizon: 0xff7e3d,
    fog: 0x3a2350,
    sun: 0xffb36b,
    hemiSky: 0x8a6bbf,
    hemiGround: 0x2a1a2e,
    asphalt: 0x2e2e3a,
    sidewalk: 0x7a7a88,
    sand: 0xd9b380,
    water: 0x1d4e6b,
    buildingPalette: [0x4a3f66, 0x5d4a6e, 0x3e5570, 0x6e4a5d, 0x46586b, 0x7a5a4a, 0x54406e, 0x3d4a6e],
    neonPalette: [0xff2e88, 0x2ee6ff, 0xffd23c, 0x7cff4a, 0xb44aff, 0xff7e3d],
    carPalette: [0xc23b2e, 0x2e6fc2, 0xe8b93c, 0x3cb56a, 0xd7d7de, 0x23232e, 0x7a3cc2, 0x2ec2b0],
    pedShirts: [0xe8e8e8, 0x3c78d8, 0xd83c3c, 0x3cd86a, 0xe8c93c, 0xd83cd8, 0x3cd8d8, 0xf08a3c],
  },

  audio: { master: 0.5, engineBase: 55, sirenHigh: 960, sirenLow: 700 },
};

// How many story missions the game ships (round 2: six).
export const MISSION_COUNT = CFG.missions.length;

// Small helpers the game code shares: clamp a value and flat distance.
export function clampNum(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export function flatDist(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
