// The set: backdrop gradient, a dark floor that fades into it, the anodised plinth that carries both
// machines, the lab lighting and the reflection environment. Units: metres; the plinth top is y = 0.
import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { color, mix, screenUV, positionWorld, smoothstep, length } from 'three/tsl';
import { mesh } from './materials.js';

export const PLINTH = { x: [-0.74, 0.7], z: [-0.52, 0.3], height: 0.06 };

/**
 * Backdrop and reflections. The scene gets the common lab RoomEnvironment (soft fill only); the
 * returned map is a dark room with softboxes and strips, for the hero metals: machined steel reads
 * as metal only when it reflects hard-edged highlights against dark.
 */
export function setupEnvironment(renderer, scene) {
  // Common lab backdrop: a vertical studio gradient, no fog.
  scene.backgroundNode = mix(color(0x141d2c), color(0x05070b), screenUV.y.oneMinus().pow(0.7).oneMinus());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  return pmrem.fromScene(softboxStudio(), 0.02).texture;
}

// A dark box room lit by emissive panels, for PMREMGenerator.fromScene (rendered from the origin).
function softboxStudio() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(100, 60, 100), new THREE.MeshBasicMaterial({ color: 0x07090d, side: THREE.BackSide })));
  const panel = (w, h, hex, intensity, position) => {
    const light = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity), side: THREE.DoubleSide }));
    light.position.set(...position);
    light.lookAt(0, 0, 0);
    scene.add(light);
  };
  panel(30, 18, 0xfff1e0, 3.2, [0, 28, 6]); // overhead softbox
  panel(26, 4, 0xfff4e8, 4, [-24, 20, -36]); // strip opposite the hero camera
  panel(8, 40, 0xffe2c4, 5, [-40, 8, 18]); // warm key strip, on the side of the key light
  panel(5, 36, 0x58a6ff, 4, [42, 6, -14]); // blue rim strip
  panel(30, 3, 0xffa657, 3, [0, 4, -48]); // low orange glow at the back
  panel(18, 10, 0xd8e4ff, 2.2, [20, 14, 44]); // soft fill behind the camera
  panel(3, 3, 0xffffff, 12, [8, 30, 22]); // small hard source: the glint on polished journals
  return scene;
}

export function buildStudio(m) {
  const group = new THREE.Group();
  const [x0, x1] = PLINTH.x;
  const [z0, z1] = PLINTH.z;
  const plinth = mesh(new RoundedBoxGeometry(x1 - x0, PLINTH.height, z1 - z0, 4, 0.012), m.plinth);
  plinth.position.set((x0 + x1) / 2, -PLINTH.height / 2, (z0 + z1) / 2);
  group.add(plinth);
  // A thin light line along the front edge of the plinth.
  const strip = mesh(new THREE.BoxGeometry(x1 - x0 - 0.04, 0.003, 0.003), m.strip, { cast: false, receive: false });
  strip.position.set((x0 + x1) / 2, -PLINTH.height * 0.55, z1 + 0.0005);
  group.add(strip);
  // Floor: dark under the plinth, fading into the bottom of the backdrop.
  const floorMaterial = m.floor.clone();
  const fade = smoothstep(1.2, 3.2, length(positionWorld.xz));
  floorMaterial.colorNode = mix(color(0x0d1219), color(0x05070b), fade);
  const floor = mesh(new THREE.CircleGeometry(4, 64), floorMaterial, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -PLINTH.height - 0.18;
  group.add(floor);
  // Legs under the plinth, set back so it reads as a floating slab.
  const leg = new THREE.BoxGeometry(0.06, 0.18, 0.06);
  for (const x of [x0 + 0.2, x1 - 0.2]) {
    for (const z of [z0 + 0.15, z1 - 0.15]) {
      const l = mesh(leg, m.powder);
      l.position.set(x, -PLINTH.height - 0.09, z);
      group.add(l);
    }
  }
  return group;
}

export function addLights(scene) {
  // Common lab lighting (lab/proto/README.md), scaled to a set about 1.5 m wide.
  scene.add(new THREE.HemisphereLight(0x2a3d5c, 0x07090d, 0.5));

  const key = new THREE.SpotLight(0xffd6a5, 48, 8, 0.5, 0.8, 2);
  key.position.set(-1.2, 2.4, 1.8);
  key.target.position.set(-0.05, 0.25, -0.05);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 6;
  scene.add(key, key.target);

  // Cool rim from the far side, opposite the key.
  const rim = new THREE.SpotLight(0xd6e4ff, 20, 8, 0.55, 0.7, 2);
  rim.position.set(1.4, 1.6, -2.0);
  rim.target.position.set(-0.1, 0.3, 0);
  scene.add(rim, rim.target);

  // Soft fill from behind the default camera, so the front is never a silhouette.
  const fill = new THREE.SpotLight(0xbcd4ff, 9, 8, 0.6, 1, 2);
  fill.position.set(1.6, 1.0, 2.6);
  fill.target.position.set(-0.1, 0.25, 0);
  scene.add(fill, fill.target);
  return { key, rim, fill };
}
