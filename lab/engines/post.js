// Post-processing, per the lab's common style: GTAO on the indirect light only, bloom on real
// emitters only (the emissive MRT: flames, sparks, coil currents, the inverter light), a light depth
// of field only while the camera flies or looks at a part close up, and a subtle vignette.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive, normalView, builtinAOContext, screenUV, uniform, vec4, length, smoothstep, mix } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

const BLOOM = { strength: 0.85, radius: 0.4, threshold: 0.08 };
const BOKEH = 0.9; // DOF strength in flight and in close-ups; 0 at rest

export function createPipeline(renderer, scene, camera) {
  const pipeline = new THREE.RenderPipeline(renderer);

  // Pre-pass for depth and normals, so the AO darkens the indirect light of the main pass.
  const prePass = pass(scene, camera, { samples: 0 });
  prePass.setMRT(mrt({ output: normalView }));
  const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), camera);
  aoPass.resolutionScale = 0.5;
  aoPass.radius.value = 0.04; // metres: the gaps between the parts, not the whole machine
  aoPass.thickness.value = 0.03;

  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
  const color = scenePass.getTextureNode('output');

  const focus = uniform(2);
  const focalLength = uniform(1);
  const soft = uniform(0);
  // The DOF composite mixes in half-resolution fields even at zero bokeh, so at rest it is bypassed.
  const blurred = dof(color, scenePass.getViewZNode(), focus, focalLength, soft.mul(BOKEH));
  const base = mix(color.rgb, blurred.rgb, soft);
  const glow = bloom(scenePass.getTextureNode('emissive'), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  const vignette = mix(0.84, 1, smoothstep(0.95, 0.35, length(screenUV.sub(0.5))));
  pipeline.outputNode = vec4(base.add(glow.rgb).mul(vignette), 1);

  let blur = 0;
  return {
    render: () => pipeline.render(),
    // Keep the target sharp; `amount` in [0, 1] eases the blur in and out.
    focus(cam, target, amount = 0, dt = 1) {
      focus.value = cam.position.distanceTo(target);
      focalLength.value = focus.value * 0.45;
      blur += (amount - blur) * Math.min(1, dt * 4);
      soft.value = blur < 0.01 ? 0 : blur;
    },
  };
}
