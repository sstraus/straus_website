/**
 * Post-processing: GTAO contact shadows, bloom on the emissive output only
 * (the lamp shade, the power pulses, the water bands) and a light depth of
 * field that exists only while the camera flies. At rest the image is sharp.
 */
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive, normalView, builtinAOContext, screenUV, uniform, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

export function createPipeline(renderer, scene, camera) {
  const pipeline = new THREE.RenderPipeline(renderer);

  // Pre-pass for depth and normals, so the AO can darken the indirect light of the main pass.
  // Transparent effects (glass, plume, streaks) stay out of it: they must not occlude.
  // One unlit override material draws every object, so this pass adds a few small programs, not one per material.
  const prePass = pass(scene, camera, { samples: 0 });
  prePass.setMRT(mrt({ output: normalView }));
  prePass.transparent = false;
  prePass.overrideMaterial = new THREE.MeshBasicNodeMaterial();
  const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), camera);
  aoPass.resolutionScale = 0.5;
  aoPass.radius.value = 0.6;

  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
  const color = scenePass.getTextureNode('output');

  const focus = uniform(8);
  const blur = uniform(0); // bokeh scale: 0 at rest, raised only during a flight
  const sharp = dof(color, scenePass.getViewZNode(), focus, uniform(3), blur);
  const glow = bloom(scenePass.getTextureNode('emissive'), 0.6, 0.4, 0.05);
  pipeline.outputNode = vec4(sharp.rgb.add(glow.rgb), 1);

  /** Draws a frame into the canvas. */
  function render() {
    renderer.setRenderTarget(null);
    pipeline.render();
  }

  return { render, focus, blur, bloom: glow };
}
