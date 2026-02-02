/**
 * status-icons.js - Shared status bar icon helpers
 *
 * Used by lock-screen and phone-status-bar to render signal, battery,
 * wifi, and mobile data indicators.
 */

/**
 * @param {number} level - 0-4
 * @returns {string} Material Symbol icon name
 */
export function getSignalIcon(level) {
  const icons = [
    'signal_cellular_0_bar',
    'signal_cellular_1_bar',
    'signal_cellular_2_bar',
    'signal_cellular_3_bar',
    'signal_cellular_4_bar',
  ];
  return icons[Math.max(0, Math.min(4, level))] || icons[0];
}

/**
 * @param {number} percent - 0-100
 * @returns {string} Material Symbol icon name
 */
export function getBatteryIcon(percent) {
  if (percent >= 95) return 'battery_full';
  if (percent >= 83) return 'battery_6_bar';
  if (percent >= 70) return 'battery_5_bar';
  if (percent >= 57) return 'battery_4_bar';
  if (percent >= 43) return 'battery_3_bar';
  if (percent >= 30) return 'battery_2_bar';
  if (percent >= 15) return 'battery_1_bar';
  return 'battery_0_bar';
}

/**
 * @param {number} level - 0-2
 * @returns {string} Material Symbol icon name
 */
export function getWifiIcon(level) {
  if (level === 0) return 'wifi_off';
  if (level === 1) return 'wifi_2_bar';
  return 'wifi';
}

/**
 * @param {number} level - 0-5 (0=no data, 1=G, 2=E, 3=3G, 4=4G, 5=5G)
 * @returns {string} SVG markup
 */
export function renderMobileIcon(level) {
  const labels = ['', 'G', 'E', '3G', '4G', '5G'];
  const label = labels[level] || '';
  if (!label) {
    return `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><text x="7" y="11" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" opacity="0.3">G</text><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  const w = label.length <= 1 ? 10 : label.length === 2 ? 16 : 20;
  return `<svg width="${w}" height="14" viewBox="0 0 ${w} 14" aria-hidden="true"><text x="${w / 2}" y="11.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${label}</text></svg>`;
}

/**
 * @param {string} type - wifi0-2, mobile0-5, airplane, none
 * @param {object} [options]
 * @param {string} [options.iconClass='icon'] - CSS class for Material Symbol spans
 * @returns {string} HTML markup
 */
export function renderInternetIcon(type, { iconClass = 'icon' } = {}) {
  if (!type || type === 'none') return '';

  if (type === 'airplane') {
    return `<span class="material-symbols-outlined ${iconClass}" aria-hidden="true">airplanemode_active</span>`;
  }

  const wifiMatch = type.match(/^wifi(\d)$/);
  if (wifiMatch) {
    const icon = getWifiIcon(parseInt(wifiMatch[1], 10));
    return `<span class="material-symbols-outlined ${iconClass}" aria-hidden="true">${icon}</span>`;
  }

  const mobileMatch = type.match(/^mobile(\d)$/);
  if (mobileMatch) {
    return renderMobileIcon(parseInt(mobileMatch[1], 10));
  }

  return '';
}
