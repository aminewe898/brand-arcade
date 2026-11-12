// ─────────────────────────────────────────────────────────────────────────────
// SOLMARA — fictional demo brand (sparkling citrus soda).
// A brand file is pure data: copy it, change the values, register it in
// ./index.js and you have a new campaign. No engine code needs to change.
// Text fields accept either a string or a { es, en, … } object.
// ─────────────────────────────────────────────────────────────────────────────
export default {
  id: 'solmara',

  brand: {
    name: 'Solmara',
    logoText: 'Solmara', // drawn on the product label, the gates and the share card
    tagline: { es: 'Refresco cítrico con burbujas', en: 'Sparkling citrus soda' },
    url: 'https://example.com/solmara', // call-to-action destination
    cta: { es: 'Descubre Solmara', en: 'Discover Solmara' },
  },

  game: {
    title: { es: 'Ruta del Sol', en: 'Sunset Run' },
    pitch: {
      es: 'Surfea el atardecer, encadena cítricos y desbloquea premios.',
      en: 'Surf the sunset, chain citrus and unlock rewards.',
    },
    powerName: { es: 'FIZZ', en: 'FIZZ' }, // name of the power mode
    zoneName: { es: 'Playa', en: 'Beach' }, // "Playa 2", "Playa 3"…
  },

  locale: { default: 'es', available: ['es', 'en'] },

  // UI palette (CSS variables)
  colors: {
    primary: '#FF6A2B',
    secondary: '#FFD23F',
    accent: '#16C7B5',
    ink: '#2A1650',
    paper: '#FFF6E6',
    danger: '#FF2E7E',
  },

  // 3D world palette
  world: {
    skyTop: '#3A2A92',
    skyMid: '#FF5F8F',
    horizon: '#FFC46B',
    sun: '#FFF2C0',
    sea: '#1AA3A8',
    track: '#FFF1D8',
    trackEdge: '#FF6A2B',
    trackLine: '#2A1650',
    rail: '#19E6D2',
    lightSky: '#FFC2B0',
    lightGround: '#4A5FB0',
    sunLight: '#FFD9A6',
    rock: '#D4694A',
    grass: '#35C487',
    leaf: '#22A56E',
    trunk: '#8A5638',
    cloud: '#FFD3D8',
    topper: 'palm', // 'palm' | 'pine' | 'none'
    stars: false,
  },

  // The product the player rides. type: 'can' | 'cup'
  hero: {
    type: 'can',
    body: '#FF6A2B',
    accent: '#FFF6E6',
    detail: '#FFD23F',
    metal: '#EEF2F5',
    board: '#FFF6E6',
    boardStripe: '#16C7B5',
  },

  // What the player collects (1–3 variants). kind: 'citrus' | 'coin' | 'bean'
  collectibles: [
    { kind: 'citrus', rind: '#FF8A1F', pulp: '#FFB23E' },
    { kind: 'citrus', rind: '#FFD21F', pulp: '#FFE86B' },
    { kind: 'citrus', rind: '#7BD63B', pulp: '#C2F26B' },
  ],

  // Rare premium pickup
  token: { color: '#FFC93C', glyph: 'S' },

  hazards: { body: '#2A1650', tip: '#FF2E7E' },

  // Score thresholds → prizes. Codes here are DEMO values: for a real campaign
  // issue codes from a server (see README → "Real rewards").
  rewards: [
    {
      id: 'bronze', score: 2000, color: '#E08A4F',
      name: { es: 'Chapa Bronce', en: 'Bronze Cap' },
      prize: { es: '5% de descuento', en: '5% off' },
      code: 'SOL-DEMO-05',
    },
    {
      id: 'silver', score: 8000, color: '#B9C4D0',
      name: { es: 'Chapa Plata', en: 'Silver Cap' },
      prize: { es: '10% + envío gratis', en: '10% off + free shipping' },
      code: 'SOL-DEMO-10',
    },
    {
      id: 'gold', score: 20000, color: '#FFC93C',
      name: { es: 'Chapa Oro', en: 'Gold Cap' },
      prize: { es: 'Pack degustación gratis', en: 'Free tasting pack' },
      code: 'SOL-DEMO-ORO',
    },
  ],

  share: {
    hashtag: '#RutaDelSol',
    text: {
      es: 'He hecho {score} puntos en {game} de {brand}. ¿Me superas?',
      en: 'I scored {score} in {brand} {game}. Can you beat me?',
    },
  },

  legal: {
    es: 'Demo con marca ficticia. Los códigos no tienen validez comercial.',
    en: 'Demo with a fictional brand. Codes have no commercial value.',
  },

  // Optional gameplay overrides (see src/game/tuning.js)
  tuning: {},
};
