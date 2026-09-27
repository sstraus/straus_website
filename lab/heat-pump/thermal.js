/**
 * Steady-state temperatures of the house surfaces, for the thermal-camera
 * view. No three.js, so node can test it. The shaders read these numbers
 * through uniforms; nothing here is recomputed on the GPU.
 */
import { model } from './physics.js';
import { WALL_LAYERS } from './layout.js';

/** Conductivity in W/(m·K): gypsum plaster, insulating clay block, EPS, mineral render. */
const CONDUCTIVITY = { plaster: 0.7, block: 0.25, eps: 0.035, render: 0.8 };
/** Wall build-up from the inner face outwards. */
export const WALL = WALL_LAYERS.map((layer) => ({ ...layer, conductivity: CONDUCTIVITY[layer.key] }));
const RSI = 0.13; // m²K/W, inner surface resistance (EN ISO 6946)
const RSE = 0.04; // m²K/W, outer surface resistance

/**
 * Temperature through the wall. `depths` are measured from the inner face;
 * `temps[i]` is the temperature at `depths[i]`: the inner surface, each layer
 * interface and the outer surface.
 */
export function wallProfile(outside, inside = model.indoor) {
  const resistance = RSI + RSE + WALL.reduce((sum, l) => sum + l.thickness / l.conductivity, 0);
  const U = 1 / resistance;
  const flux = U * (inside - outside);
  const depths = [0];
  const temps = [inside - flux * RSI];
  for (const layer of WALL) {
    depths.push(depths.at(-1) + layer.thickness);
    temps.push(temps.at(-1) - flux * layer.thickness / layer.conductivity);
  }
  return { U, flux, depths, temps };
}

/** Floor area the heat pump serves; the diorama shows one room of it. */
export const HEATED_AREA = 110;

/**
 * Floor surface temperature for a given heat output, from the EN 1264 base
 * curve q = 8.92 · (θs − θi)^1.1 W/m², with all the heat leaving through the floor.
 */
export function floorSurface(heatKW, inside = model.indoor) {
  const q = (heatKW * 1000) / HEATED_AREA;
  return inside + Math.pow(Math.max(q, 0) / 8.92, 1 / 1.1);
}

/**
 * Floor surface temperature in cooling mode. EN 1264 rates a cooling floor at
 * about 7 W/(m²K) between the room and the surface, far less than in heating
 * because cold air stays on the floor instead of rising.
 */
export function floorSurfaceCooling(coolingKW, inside) {
  const q = (coolingKW * 1000) / HEATED_AREA;
  return inside - Math.max(q, 0) / 7;
}

const WINDOW_U = 0.8; // W/(m²K), triple glazing
/** Inner surface of the glass, the coldest thing in the room. */
export function windowSurface(outside, inside = model.indoor) {
  return inside - WINDOW_U * RSI * (inside - outside);
}

/**
 * Soil temperature. Below a few metres the ground sits near the yearly mean;
 * the air temperature reaches down with an exponential damping (a steady
 * simplification of the periodic heat equation).
 */
export const SOIL = { deep: 10, damping: 0.4 };
export function groundTemperature(depth, outside) {
  return SOIL.deep + (outside - SOIL.deep) * Math.exp(-Math.max(depth, 0) / SOIL.damping);
}
/** Depth where the soil reaches 0 °C, or 0 when the air is above freezing. */
export function frostDepth(outside) {
  if (outside >= 0) return 0;
  return SOIL.damping * Math.log((SOIL.deep - outside) / SOIL.deep);
}
