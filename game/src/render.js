// NEON BAY — three.js stage: dusk sky, fog, lights and the chase camera rig.
// Written fresh for the make.fun gta6-01 entry.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.colors.fog, 90, 560);

  // Dusk sky dome: violet overhead fading to ember orange at the horizon,
  // with a warm glow around the low sun.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(CFG.colors.skyTop) },
      horizon: { value: new THREE.Color(CFG.colors.skyHorizon) },
      sunDir: { value: new THREE.Vector3(-0.5, 0.16, -0.85).normalize() },
      sunColor: { value: new THREE.Color(CFG.colors.sun) },
    },
    vertexShader: [
      'varying vec3 vDir;',
      'void main() {',
      '  vDir = normalize(position);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vDir;',
      'uniform vec3 top;',
      'uniform vec3 horizon;',
      'uniform vec3 sunDir;',
      'uniform vec3 sunColor;',
      'void main() {',
      '  float h = clamp(vDir.y, 0.0, 1.0);',
      '  vec3 col = mix(horizon, top, pow(h, 0.55));',
      '  float g = pow(max(dot(normalize(vDir), sunDir), 0.0), 18.0);',
      '  col += sunColor * g * 0.9;',
      '  float g2 = pow(max(dot(normalize(vDir), sunDir), 0.0), 4.0);',
      '  col += sunColor * g2 * 0.25;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat);
  scene.add(sky);

  // Low sun disc, far out so it barely parallaxes.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }),
  );
  sunDisc.position.set(-400, 128, -680);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  const hemi = new THREE.HemisphereLight(CFG.colors.hemiSky, CFG.colors.hemiGround, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CFG.colors.sun, 1.9);
  sun.position.set(-140, 70, -210);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x403060, 0.7));

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 12, 30);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, resize };
}

// Chase camera: follows a target, user orbits with the mouse, auto-centres
// behind a moving vehicle. `mode` is 'foot' or 'drive'.
export function createCameraRig(camera) {
  const rig = {
    yaw: 0,
    pitch: 0.34,
    dist: 9.5, // on-foot follow distance; shots may widen it
    pos: new THREE.Vector3(0, 14, 32),
    look: new THREE.Vector3(0, 1.5, 0),
    orbit(dx, dy) {
      rig.yaw -= dx * 0.005;
      rig.pitch = Math.max(0.08, Math.min(1.05, rig.pitch + dy * 0.004));
    },
    snapBehind(heading) {
      // Camera sits BEHIND the target: update() places it at
      // target - (sin yaw, cos yaw) * dist, so yaw must equal heading.
      rig.yaw = heading;
    },
    update(target, heading, speed, mode, dt) {
      // When driving, gently pull the camera behind the car.
      if (mode === 'drive' && speed > 3) {
        const want = heading;
        let d = want - rig.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        rig.yaw += d * Math.min(1, 0.9 * dt);
      }
      const dist = mode === 'drive' ? 12 : rig.dist;
      const height = mode === 'drive' ? 4.6 : 3.4;
      const cx = target.x - Math.sin(rig.yaw) * Math.cos(rig.pitch) * dist;
      const cz = target.z - Math.cos(rig.yaw) * Math.cos(rig.pitch) * dist;
      const cy = target.y + height + Math.sin(rig.pitch) * dist * 0.55;
      const k = 1 - Math.exp(-7 * dt);
      rig.pos.x += (cx - rig.pos.x) * k;
      rig.pos.y += (cy - rig.pos.y) * k;
      rig.pos.z += (cz - rig.pos.z) * k;
      rig.look.x += (target.x - rig.look.x) * k;
      rig.look.y += (target.y + 1.7 - rig.look.y) * k;
      rig.look.z += (target.z - rig.look.z) * k;
      camera.position.copy(rig.pos);
      camera.lookAt(rig.look);
    },
  };
  return rig;
}
