// Small platform services: persistent storage and the analytics / embed event bus.

/** localStorage that never throws (private mode, blocked storage, iframes). */
export function makeStore(brandId) {
  const prefix = `brand-arcade:${brandId}:`;
  const mem = {};
  return {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(prefix + key);
        return v == null ? (mem[key] ?? fallback) : JSON.parse(v);
      } catch {
        return mem[key] ?? fallback;
      }
    },
    set(key, value) {
      mem[key] = value;
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch {
        /* storage unavailable: keep the in-memory copy */
      }
    },
  };
}

/**
 * Campaign events. Each one is:
 *   • pushed to window.dataLayer (Google Tag Manager) if it exists
 *   • dispatched as a DOM CustomEvent 'brandgame'
 *   • posted to the parent window when the game is embedded in an iframe
 * Events: ready, start, zone, power, reward, over, share, cta
 * No personal data is ever included.
 */
export function track(brandId, name, data = {}) {
  const payload = { event: `brandgame_${name}`, brand: brandId, ...data };
  try {
    window.dataLayer?.push(payload);
    window.dispatchEvent(new CustomEvent('brandgame', { detail: payload }));
    if (window.parent !== window) window.parent.postMessage({ source: 'brand-arcade', ...payload }, '*');
  } catch {
    /* analytics must never break the game */
  }
}
