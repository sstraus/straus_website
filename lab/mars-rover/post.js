// Post-processing, per the lab's common style: GTAO on the indirect light, bloom on real emitters
// only (the emissive MRT: here, only the sun disc) and a subtle vignette. No depth of field: a game
// must stay sharp everywhere.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive, normalView, builtinAOContext, screenUV, vec4, length, smoothstep, mix } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const BLOOM = { strength: 0.7, radius: 0.55, threshold: 0.1 };

export function createPipeline(renderer, scene, camera) {
  const pipeline = new THREE.RenderPipeline(renderer);

  // Pre-pass for depth and normals, so the AO darkens the indirect light of the main pass.
  const prePass = pass(scene, camera, { samples: 0 });
  prePass.setMRT(mrt({ output: normalView }));
  const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), camera);
  aoPass.resolutionScale = 0.5;
  aoPass.radius.value = 0.6; // metres: the wheels in their wells, the rocks on the sand
  aoPass.thickness.value = 0.5;

  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
  const color = scenePass.getTextureNode('output');
  const glow = bloom(scenePass.getTextureNode('emissive'), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  const vignette = mix(0.82, 1, smoothstep(0.95, 0.35, length(screenUV.sub(0.5))));
  pipeline.outputNode = vec4(color.rgb.add(glow.rgb).mul(vignette), 1);

  return { render: () => pipeline.render() };
}
