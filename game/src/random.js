// NEON BAY — tiny seeded random helpers (mulberry32). Written fresh.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small bag of helpers over one seeded stream.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    // Fisher-Yates shuffle, returns a new array.
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

// Round 3 addition: a weighted draw over one seeded stream. Give it the
// values and a matching weight each — a bigger weight means that value
// turns up more often, so everyday choices dominate while rare ones still
// appear now and then. A zero or missing total falls back to the last
// value instead of crashing, and the draw always consumes exactly one
// number from the stream, keeping later draws deterministic.
export function weightedPick(rng, values, weights) {
  let total = 0;
  for (const w of weights) total += w;
  if (!(total > 0) || values.length === 0) return values[values.length - 1];
  let roll = rng.next() * total;
  for (let i = 0; i < values.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return values[i];
  }
  return values[values.length - 1];
}

// Round 3 note: weightedPick is the round 3 addition — traffic colours in
// vehicles.js draw through it now, so the dusk streets carry more everyday
// paint (silver, dark) and fewer flashy yellows and purples.
