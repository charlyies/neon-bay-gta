# NEON BAY

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/charlyies/neon-bay-gta/rank.svg)
![reward](https://make.fun/badge/gta6-01/charlyies/neon-bay-gta/reward.svg)

An open-world crime game for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) on make.fun.
A coastal city at dusk, built with three.js — no Rockstar names, characters, art or
music anywhere: Neon Bay, Jax and Mara Voss are all original.

## The game

You are Jax, a driver for the fixer Mara Voss. Explore Neon Bay on foot and by car,
steal rides, outrun the police, and run four story jobs across town:

1. **Hot Wheels** — steal the marked sedan, deliver it to the garage.
2. **Getaway** — lose a 2-star wanted level, then slip to the safehouse.
3. **Payback** — settle it with the rival crew at the docks.
4. **The Big Score** — grab the package from the bank van and run it across town under 3-star heat.

Side work pays too: taxi fares ($120) and a checkpoint time trial ($300).
Progress saves to your browser — cash, mission and position.

The city has traffic with simple AI, pedestrians who flee gunfire, a wanted system
(0–5 stars) with police cars that chase and ram and cops on foot who can arrest you,
combat (fists + pistol), a HUD with a live minimap, dusk lighting, sirens, headlights
and fully synthesized WebAudio sound.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse drag | Orbit camera |
| Shift | Run |
| E | Enter / exit car, pick up taxi fares |
| Space | Handbrake |
| F | Punch |
| Click | Shoot (pistol) |
| R | Reload |
| 1 / 2 | Fists / pistol |
| T | Start time trial |
| P / Esc | Pause |
| M | Mute |
| H | Help |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — `game/index.html` runs from any static server with no network
requests. Screenshots are staged with `?shot=start|play|chase|mission&seed=1`.
