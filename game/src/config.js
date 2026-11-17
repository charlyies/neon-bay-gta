// NEON BAY — tuning constants, city layout and story data.
// Written fresh for the make.fun gta6-01 entry. Every value here is mine.
export const CFG = {
  // City grid: 7 x 7 blocks, 44 m blocks, 14 m roads (pitch 58 m).
  pitch: 58,
  blockHalf: 22,
  roadHalf: 7,
  cityHalf: 210,
  beachZ: 210, // sand starts at the south edge
  waterZ: 238, // water plane starts here
  dockX: 210, // docks start at the east edge

  // Road centre lines (8 each axis, derived from the grid above).
  roads: [-203, -145, -87, -29, 29, 87, 145, 203],
  laneOffset: 3.5,

  player: {
    walkSpeed: 6,
    runSpeed: 10,
    radius: 0.6,
    health: 100,
    punchDamage: 12,
    punchRange: 2.2,
    punchArc: 1.1,
    pistolDamage: 34,
    pistolRange: 90,
    magSize: 12,
    reloadTime: 1.1,
  },

  car: {
    accel: 16,
    brake: 30,
    reverseMax: 9,
    maxSpeed: 38,
    steerMax: 0.55,
    grip: 6,
    handbrakeGrip: 1.6,
    trafficSpeed: 9,
    trafficCount: 12,
  },

  ped: {
    count: 16,
    walkSpeed: 1.6,
    fleeSpeed: 4.2,
  },

  police: {
    maxCars: 4,
    maxFoot: 6,
    carSpeed: 42,
    footSpeed: 7.5,
    ramDamage: 14,
    arrestTime: 1.2,
    arrestRadius: 1.6,
    spawnDistance: 70,
    despawnDistance: 160,
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
  ],

  // Optional side work: taxi fares and a checkpoint time trial.
  taxi: { pay: 120, pickupRadius: 4, dropoffRadius: 6 },
  trial: { pay: 300, timeLimit: 75, checkpoints: 5 },

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
    buildingPalette: [0x4a3f66, 0x5d4a6e, 0x3e5570, 0x6e4a5d, 0x46586b, 0x7a5a4a],
    carPalette: [0xc23b2e, 0x2e6fc2, 0xe8b93c, 0x3cb56a, 0xd7d7de, 0x23232e, 0x7a3cc2, 0x2ec2b0],
    pedShirts: [0xe8e8e8, 0x3c78d8, 0xd83c3c, 0x3cd86a, 0xe8c93c, 0xd83cd8, 0x3cd8d8, 0xf08a3c],
  },

  audio: { master: 0.5, engineBase: 55, sirenHigh: 960, sirenLow: 700 },
};
