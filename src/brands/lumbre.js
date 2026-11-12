// ─────────────────────────────────────────────────────────────────────────────
// CAFÉ LUMBRE — second fictional brand (specialty coffee), included to prove the
// re-skin: same engine, different product, palette, collectibles, rewards and copy.
// Open the game with ?brand=lumbre to see it.
// ─────────────────────────────────────────────────────────────────────────────
export default {
  id: 'lumbre',

  brand: {
    name: 'Café Lumbre',
    logoText: 'Lumbre',
    tagline: { es: 'Café de especialidad', en: 'Specialty coffee' },
    url: 'https://example.com/lumbre',
    cta: { es: 'Visita Café Lumbre', en: 'Visit Café Lumbre' },
  },

  game: {
    title: { es: 'Turno de Noche', en: 'Night Shift' },
    pitch: {
      es: 'Cruza la ciudad dormida, encadena granos y gana tu café.',
      en: 'Cross the sleeping city, chain beans and win your coffee.',
    },
    powerName: { es: 'ESPRESSO', en: 'ESPRESSO' },
    zoneName: { es: 'Barrio', en: 'District' },
  },

  locale: { default: 'es', available: ['es', 'en'] },

  colors: {
    primary: '#FF8A3C',
    secondary: '#FFD08A',
    accent: '#7C5CFF',
    ink: '#120E2E',
    paper: '#FFF4E4',
    danger: '#3FE0FF',
  },

  world: {
    skyTop: '#070A26',
    skyMid: '#2B1B5E',
    horizon: '#E0683A',
    sun: '#FFD9A0',
    sea: '#1B2168',
    track: '#3A2D63',
    trackEdge: '#FF8A3C',
    trackLine: '#FFD08A',
    rail: '#FFB347',
    lightSky: '#8C7BFF',
    lightGround: '#3A2470',
    sunLight: '#FFC08A',
    rock: '#2A2260',
    grass: '#4B3FA8',
    leaf: '#6A5BE0',
    trunk: '#231C4E',
    cloud: '#5B4AA8',
    topper: 'pine',
    stars: true,
  },

  hero: {
    type: 'cup',
    body: '#FFF4E4',
    accent: '#FF8A3C',
    detail: '#120E2E',
    metal: '#120E2E',
    board: '#FF8A3C',
    boardStripe: '#FFF4E4',
  },

  collectibles: [
    { kind: 'bean', rind: '#FFB95E', pulp: '#FFE0A8' },
    { kind: 'bean', rind: '#FF8A3C', pulp: '#FFC08A' },
  ],

  token: { color: '#FFD08A', glyph: 'L' },

  hazards: { body: '#0B1440', tip: '#3FE0FF' },

  rewards: [
    {
      id: 'bronze', score: 2000, color: '#E08A4F',
      name: { es: 'Taza Bronce', en: 'Bronze Cup' },
      prize: { es: 'Extra de leche gratis', en: 'Free milk upgrade' },
      code: 'LUM-DEMO-01',
    },
    {
      id: 'silver', score: 8000, color: '#B9C4D0',
      name: { es: 'Taza Plata', en: 'Silver Cup' },
      prize: { es: '2×1 en café', en: '2-for-1 coffee' },
      code: 'LUM-DEMO-2X1',
    },
    {
      id: 'gold', score: 20000, color: '#FFD08A',
      name: { es: 'Taza Oro', en: 'Gold Cup' },
      prize: { es: 'Café gratis toda la semana', en: 'Free coffee for a week' },
      code: 'LUM-DEMO-ORO',
    },
  ],

  share: {
    hashtag: '#TurnoDeNoche',
    text: {
      es: 'He hecho {score} puntos en {game} de {brand}. ¿Me superas?',
      en: 'I scored {score} in {brand} {game}. Can you beat me?',
    },
  },

  legal: {
    es: 'Demo con marca ficticia. Los códigos no tienen validez comercial.',
    en: 'Demo with a fictional brand. Codes have no commercial value.',
  },

  tuning: {},
};
