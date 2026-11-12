// "Curved world": every world material bends away from the camera in view space,
// which gives the rolling-horizon look and makes the straight track feel like it winds.
import * as THREE from 'three';

/** x = lateral bend, y = downward bend (per metre², in view space). Shared by all materials. */
export const curve = { value: new THREE.Vector2(0, 0.0011) };

export const BEND_GLSL = /* glsl */ `
  float bz = mvPosition.z * mvPosition.z;
  mvPosition.x += uCurve.x * bz;
  mvPosition.y -= uCurve.y * bz;
  gl_Position = projectionMatrix * mvPosition;
`;

export function bend(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve = curve;
    shader.vertexShader =
      'uniform vec2 uCurve;\n' +
      shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + BEND_GLSL);
  };
  material.customProgramCacheKey = () => 'bend';
  return material;
}
