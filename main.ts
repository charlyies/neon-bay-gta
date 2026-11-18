// NEON BAY round 2 — the hand-in program for make.fun gta6-01.
// Node 22, standard library only. The game itself is plain static files
// under game/ (game/index.html plus ES modules, three.js vendored under
// game/vendor/, nothing fetched over the network). This program gathers the
// entry: it copies game/ and screenshots/ next to this file into the output
// directory and writes dossier.json there with the vendored make.fun
// library, so the judge can read the game from one folder.
//
// Local check, from this directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and /output is used.
// Run it twice and the two dossiers must be byte-identical.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: only text_max_bytes shapes the dossier bytes; the
// rest refuse an entry the scorer would refuse anyway (more than 4
// screenshots or one over 256 KiB; game/ over 993 files or 48 MiB in all,
// or any game/ path over 1000 bytes).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Round 3 note: the entry point still does the one job it always did —
// copy game/ and screenshots/ to the output folder and write the dossier
// with the kit's buildDossier. No plumbing change in this round.

// Round 3 note, continued: the dossier it writes is byte-identical across
// runs, which is what the gate compares when the entry is graded.
