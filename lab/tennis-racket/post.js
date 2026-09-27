/**
 * Post-processing: GTAO contact shadows on the indirect light, bloom on the
 * emissive MRT only (floodlight lamps, glowing trim, flip ring). No depth of
 * field: the racket and the court stay sharp.
 */
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive, normalView, builtinAOContext, screenUV, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export const BLOOM_STRENGTH = 0.55;

/**
 * Layer for unlit and transparent objects (lamps, beams, trim, ghosts, net). The AO pre-pass does
 * not see it: those objects need no contact shadow, and it saves one shader program each.
 */
export const UNLIT_LAYER = 2;
export function unlit(object) {
  object.layers.set(UNLIT_LAYER);
  return object;
}

/** MRT override for unlit materials: `glow` (vec3 node) goes to bloom, or nothing when omitted. */
export const glowOutput = (glow = null) => mrt({ emissive: glow ? vec4(glow, 1) : vec4(0, 0, 0, 1) });

export function createPipeline(renderer, scene, camera) {
  const pipeline = new THREE.RenderPipeline(renderer);
  camera.layers.enable(UNLIT_LAYER);
  // Same view as `camera`, without the unlit layer. Synced before every render.
  const aoCamera = new THREE.PerspectiveCamera();
  const syncAoCamera = () => {
    aoCamera.copy(camera);
    aoCamera.layers.set(0);
    aoCamera.updateMatrixWorld();
  };

  // Pre-pass for depth and normals, so the AO can darken the indirect light of the main pass.
  const prePass = pass(scene, aoCamera, { samples: 0 });
  prePass.setMRT(mrt({ output: normalView }));
  const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), aoCamera);
  aoPass.resolutionScale = 0.5;
  aoPass.radius.value = 0.6;

  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
  const color = scenePass.getTextureNode('output');
  const glow = bloom(scenePass.getTextureNode('emissive'), BLOOM_STRENGTH, 0.55, 1.1);

  pipeline.outputNode = vec4(color.rgb.add(glow.rgb), 1);

  return {
    render() {
      syncAoCamera();
      pipeline.render();
    },
    bloom: glow,
  };
}
