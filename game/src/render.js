// NEON BAY round 2 — three.js stage: dusk sky, fog, neon-rich lighting
// and the chase camera rig. The sun sits low over the water to the south,
// the sky runs violet into ember orange, and a few coloured fill lights
// sell the neon without costing a light per sign.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.colors.fog, 90, 560);

  // Dusk sky dome: violet overhead, ember at the horizon, a warm glow
  // around the low sun over the water.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(CFG.colors.skyTop) },
      horizon: { value: new THREE.Color(CFG.colors.skyHorizon) },
      sunDir: { value: new THREE.Vector3(0.15, 0.12, 1).normalize() },
      sunCol: { value: new THREE.Color(CFG.colors.sun) },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec3 vDir;',
      'uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol;',
      'void main() {',
      '  float h = clamp(vDir.y, 0.0, 1.0);',
      '  vec3 col = mix(horizon, top, pow(h, 0.55));',
      '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
      '  col += sunCol * pow(s, 24.0) * 0.9 + sunCol * pow(s, 4.0) * 0.25;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), skyMat);
  scene.add(sky);

  // Low warm sun over the water + cool violet hemisphere fill.
  // The sun sits high enough to light the streets, not just the rooftops.
  const sun = new THREE.DirectionalLight(CFG.colors.sun, 2.2);
  sun.position.set(80, 150, 300);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(CFG.colors.hemiSky, CFG.colors.hemiGround, 1.35);
  scene.add(hemi);
  // One big coloured wash so the city never looks flat grey at dusk:
  // magenta light spilling from the north-east blocks.
  const washPink = new THREE.PointLight(0xff2e88, 900, 320);
  washPink.position.set(120, 40, -120);
  scene.add(washPink);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 14, 32);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, resize };
}

// Chase camera: follows a target, user orbits with the mouse, auto-centres
// behind a moving vehicle. `mode` is 'foot' or 'drive'. `shake` adds a
// random jolt scaled by the effects system (crashes, stunts).
export function createCameraRig(camera) {
  const rig = {
    yaw: 0,
    pitch: 0.34,
    dist: 9.5, // on-foot follow distance; shots may widen it
    pos: new THREE.Vector3(0, 14, 32),
    look: new THREE.Vector3(0, 1.5, 0),
    shake: 0,
    orbit(dx, dy) {
      rig.yaw -= dx * 0.005;
      rig.pitch = Math.max(0.08, Math.min(1.05, rig.pitch + dy * 0.004));
    },
    snapBehind(heading) {
      // Camera sits BEHIND the target: update() places it at
      // target - (sin yaw, cos yaw) * dist, so yaw must equal heading.
      rig.yaw = heading;
    },
    // Jump straight to the follow position (used by screenshot staging).
    snapTo(target, heading) {
      rig.yaw = heading;
      const cx = target.x - Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
      const cz = target.z - Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
      const cy = target.y + 1.6 + Math.sin(rig.pitch) * rig.dist;
      rig.pos.set(cx, cy, cz);
      rig.look.set(target.x, 1.6, target.z);
    },
    update(target, heading, speed, mode, dt) {
      // When driving, gently pull the camera behind the car.
      if (mode === 'drive' && speed > 3) {
        const want = heading;
        let d = want - rig.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        rig.yaw += d * Math.min(1, 1.6 * dt);
      }
      const wantDist = mode === 'drive' ? 12.5 : 9.5;
      rig.dist += (wantDist - rig.dist) * Math.min(1, 3 * dt);
      const cx = target.x - Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
      const cz = target.z - Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
      const cy = target.y + 1.6 + Math.sin(rig.pitch) * rig.dist;
      const lookX = target.x + Math.sin(rig.yaw) * 2;
      const lookZ = target.z + Math.cos(rig.yaw) * 2;
      rig.pos.x += (cx - rig.pos.x) * Math.min(1, 8 * dt);
      rig.pos.y += (cy - rig.pos.y) * Math.min(1, 8 * dt);
      rig.pos.z += (cz - rig.pos.z) * Math.min(1, 8 * dt);
      rig.look.x += (lookX - rig.look.x) * Math.min(1, 10 * dt);
      rig.look.y += (1.6 - rig.look.y) * Math.min(1, 10 * dt);
      rig.look.z += (lookZ - rig.look.z) * Math.min(1, 10 * dt);
      camera.position.copy(rig.pos);
      if (rig.shake > 0.01) {
        camera.position.x += (Math.random() - 0.5) * rig.shake;
        camera.position.y += (Math.random() - 0.5) * rig.shake * 0.7;
        camera.position.z += (Math.random() - 0.5) * rig.shake;
      }
      camera.lookAt(rig.look);
    },
  };
  return rig;
}

// Round 3 note: the dusk look stays — low sun, fog, neon and the camera
// rig with its shake on crashes and stunts, all as round 2 framed it.

// Round 3 note, continued: the dusk sky and fog do most of the art
// direction — the city reads as one place from every camera angle.
