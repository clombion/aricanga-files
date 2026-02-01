/**
 * svg-enhance.js - Post-process SVG output for visual polish
 *
 * Adds CSS styling, filters for shadows, and typography improvements
 * to Graphviz-generated SVG files.
 *
 * @example
 * import { enhanceSvg } from './lib/svg-enhance.js';
 * const polishedSvg = enhanceSvg(rawSvg, { shadows: true });
 */

/**
 * CSS styles to inject into the SVG
 */
const SVG_STYLES = `
  /* Typography improvements */
  text {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  /* Smooth transitions for interactive use */
  .node, .edge, .cluster {
    transition: opacity 0.15s ease;
  }

  /* Subtle hover effects (when embedded in HTML) */
  .node:hover {
    opacity: 0.85;
  }

  /* Softer edge rendering */
  .edge path {
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Cluster styling refinements */
  .cluster polygon {
    rx: 8;
    ry: 8;
  }
`;

/**
 * SVG filter definitions for shadows and effects
 */
const SVG_FILTERS = `
  <defs>
    <!-- Subtle drop shadow for nodes -->
    <filter id="shadow-sm" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.08"/>
    </filter>

    <!-- Medium shadow for clusters -->
    <filter id="shadow-md" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.06"/>
    </filter>

    <!-- Glow effect for highlighted elements -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
`;

/**
 * Apply shadow filters to specific elements
 */
function applyShadows(svg) {
  // Add shadow to cluster backgrounds (the polygon inside clusters)
  svg = svg.replace(
    /(<g[^>]*class="cluster"[^>]*>[\s\S]*?<polygon)/g,
    '$1 filter="url(#shadow-md)"'
  );

  // Add shadow to node shapes (ellipse, polygon in nodes)
  svg = svg.replace(
    /(<g[^>]*class="node"[^>]*>[\s\S]*?<(?:ellipse|polygon))/g,
    (match) => {
      // Only add if not already has filter
      if (!match.includes('filter=')) {
        return match.replace(/<(ellipse|polygon)/, '<$1 filter="url(#shadow-sm)"');
      }
      return match;
    }
  );

  return svg;
}

/**
 * Inject styles into the SVG
 */
function injectStyles(svg, styles) {
  // Find the opening <svg ...> tag (the actual svg element, not xml/doctype)
  const svgMatch = svg.match(/<svg[^>]*>/);
  if (!svgMatch) return svg;

  const svgTagEnd = svg.indexOf(svgMatch[0]) + svgMatch[0].length;
  const beforeContent = svg.slice(0, svgTagEnd);
  const afterContent = svg.slice(svgTagEnd);

  return `${beforeContent}
<style type="text/css"><![CDATA[${styles}]]></style>
${afterContent}`;
}

/**
 * Inject filter definitions into the SVG
 */
function injectFilters(svg, filters) {
  // Find the opening <svg> tag and inject after styles (or after svg tag)
  const styleEnd = svg.indexOf('</style>');
  if (styleEnd !== -1) {
    const insertPoint = styleEnd + '</style>'.length;
    return svg.slice(0, insertPoint) + '\n' + filters + svg.slice(insertPoint);
  }

  // No style tag, insert after svg opening tag
  const svgMatch = svg.match(/<svg[^>]*>/);
  if (!svgMatch) return svg;

  const svgTagEnd = svg.indexOf(svgMatch[0]) + svgMatch[0].length;
  return svg.slice(0, svgTagEnd) + '\n' + filters + svg.slice(svgTagEnd);
}

/**
 * Round rectangle corners in clusters (Graphviz doesn't support rx/ry on polygon)
 * This replaces cluster polygons with rounded rect paths
 */
function roundClusterCorners(svg, radius = 8) {
  // Match cluster polygons and convert to rounded paths
  return svg.replace(
    /<polygon([^>]*?)points="([^"]+)"([^>]*?)\/>/g,
    (match, before, points, after) => {
      // Parse points
      const coords = points.trim().split(/\s+/).map((p) => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });

      if (coords.length !== 4) return match; // Only handle rectangles

      // Get bounding box
      const xs = coords.map((c) => c.x);
      const ys = coords.map((c) => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = maxX - minX;
      const height = maxY - minY;

      // Create rounded rect
      return `<rect${before}x="${minX}" y="${minY}" width="${width}" height="${height}" rx="${radius}" ry="${radius}"${after}/>`;
    }
  );
}

/**
 * Enhance SVG with visual polish
 *
 * @param {string} svg - Raw SVG content from Graphviz
 * @param {Object} options - Enhancement options
 * @param {boolean} options.shadows - Add drop shadows (default: true)
 * @param {boolean} options.roundedClusters - Round cluster corners (default: true)
 * @param {boolean} options.styles - Inject CSS styles (default: true)
 * @param {number} options.cornerRadius - Corner radius for clusters (default: 8)
 * @returns {string} Enhanced SVG content
 */
export function enhanceSvg(svg, options = {}) {
  const {
    shadows = true,
    roundedClusters = true,
    styles = true,
    cornerRadius = 8,
  } = options;

  let result = svg;

  // Inject CSS styles
  if (styles) {
    result = injectStyles(result, SVG_STYLES);
  }

  // Inject filter definitions (needed for shadows)
  if (shadows) {
    result = injectFilters(result, SVG_FILTERS);
    result = applyShadows(result);
  }

  // Round cluster corners
  if (roundedClusters) {
    result = roundClusterCorners(result, cornerRadius);
  }

  return result;
}

/**
 * Minify SVG by removing unnecessary whitespace
 * (Optional - use for production)
 */
export function minifySvg(svg) {
  return svg
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
