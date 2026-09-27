// Post-processing for a phone budget: one scene pass with the emissive MRT, bloom on the real
// emitters only, then one full-screen pass that does the speed: a radial blur away from the
// vanishing point of the motion, a chromatic split on hits, a white
// flash and a vignette.
// No AO, no DOF.
import * as THREE from 'three/webgpu';
import {
  pass, mrt, output, emissive, screenUV, uniform, vec3, vec4, float, length, smoothstep, mix,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const BLOOM = { strength: 0.8, radius: 0.5, threshold: 0.1 };
const BLUR_TAPS = 6;

export function createPipeline(renderer, scene, camera) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const color = scenePass.getTextureNode('output');
  const glow = bloom(scenePass.getTextureNode('emissive'), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  const flash = uniform(0);      // a white-hot flash on a hit, 0..1
  const speed = uniform(0);      // 0 at rest .. 1 at top speed, more on a pad
  const chroma = uniform(0);     // chromatic kick on an impact, 0..1
  // Vanishing point of the motion: where the ship's velocity meets the screen. The blur
  // radiates from it, so it swings with the ship in a turn, a crest or a loop.
  const focus = uniform(new THREE.Vector2(0.5, 0.5));

  const d = screenUV.sub(focus);
  const r = length(d);
  const edge = smoothstep(0.08, 0.6, r);
  // Radial blur: taps toward the centre, longer at the edges and at speed.
  const reach = speed.mul(0.1).mul(edge);
  let sum = vec3(0);
  for (let i = 0; i < BLUR_TAPS; i++) sum = sum.add(color.sample(screenUV.sub(d.mul(reach.mul(i / BLUR_TAPS)))).rgb);
  let rgb = sum.div(BLUR_TAPS);
  // Chromatic split: red pushed out, blue pulled in.
  const split = chroma.mul(0.018).mul(r.add(0.2));
  const red = color.sample(screenUV.add(d.mul(split))).r, blue = color.sample(screenUV.sub(d.mul(split))).b;
  rgb = vec3(mix(rgb.x, red, chroma.min(1)), rgb.y, mix(rgb.z, blue, chroma.min(1)));

  const vignette = mix(0.78, 1, smoothstep(0.95, 0.3, length(screenUV.sub(0.5))));
  const lit = rgb.add(glow.rgb);
  pipeline.outputNode = vec4(lit.mul(vignette).add(vec3(1, 0.95, 0.9).mul(flash.mul(0.3))), float(1));
  return {
    render: () => pipeline.render(),
    flash, speed, chroma, focus,
  };
}
