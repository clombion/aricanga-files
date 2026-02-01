/**
 * render-dot.js - Render DOT graph language to SVG
 *
 * Uses viz-js for pure JavaScript rendering (no system Graphviz required).
 * Caches the viz instance for performance on repeated calls.
 * Optionally enhances output with CSS styling and visual polish.
 *
 * @example
 * import { renderDotToSvg } from './lib/render-dot.js';
 * const svg = await renderDotToSvg('digraph { A -> B }');
 * const polishedSvg = await renderDotToSvg('digraph { A -> B }', { enhance: true });
 */

import { instance } from '@viz-js/viz';
import { enhanceSvg } from './svg-enhance.js';

let vizInstance = null;

async function getViz() {
  if (!vizInstance) {
    vizInstance = await instance();
  }
  return vizInstance;
}

/**
 * Render DOT content to SVG
 *
 * @param {string} dotContent - DOT graph language content
 * @param {Object} options - Rendering options
 * @param {boolean} options.enhance - Apply visual enhancements (default: true)
 * @param {boolean} options.shadows - Add drop shadows (default: true)
 * @param {boolean} options.roundedClusters - Round cluster corners (default: true)
 * @returns {Promise<string>} SVG content
 */
export async function renderDotToSvg(dotContent, options = {}) {
  const {
    enhance = true,
    shadows = true,
    roundedClusters = true,
  } = options;

  const viz = await getViz();
  let svg = viz.renderString(dotContent, { format: 'svg' });

  if (enhance) {
    svg = enhanceSvg(svg, { shadows, roundedClusters });
  }

  return svg;
}
