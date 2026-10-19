// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets on a made-up house in Lyon, on a fixed morning (Monday
// 19 October 2026, 7:30 in Paris): the air quality of the house, its 48-hour
// forecast (a seeded random walk with an evening dip) and the requests of
// the month.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildAirQualityWidget, buildForecastWidget, buildBudgetWidget } =
  await load('src/widgets.js');
const { readingOf, forecastHourOf } = await load('src/reading.js');
const { readHour } = await load('src/air-quality-api.js');
const { createUsage } = await load('src/usage.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const NOW = Date.parse('2026-10-19T05:30:00Z');
// Mulberry32: the same "random" curve on every run.
let seed = 20261019;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// What Google writes in each language (the local index of France, ATMO,
// has categories only; the health advice of the general population).
const GOOGLE = {
  en: {
    atmo: 'Medium air quality',
    advice: 'With this level of air quality, you have no limitations. Enjoy the outdoors!',
  },
  fr: {
    atmo: 'Qualité de l’air moyenne',
    advice:
      'Avec ce niveau de qualité de l’air, aucune restriction ne s’applique. Profitez des activités en plein air !',
  },
  de: {
    atmo: 'Mittlere Luftqualität',
    advice:
      'Bei dieser Luftqualität gibt es keine Einschränkungen. Genießen Sie die Zeit im Freien!',
  },
  es: {
    atmo: 'Calidad del aire media',
    advice: 'Con este nivel de calidad del aire, no hay limitaciones. ¡Disfrute del aire libre!',
  },
};
const NAMES = { en: 'Home', fr: 'Maison', de: 'Zuhause', es: 'Casa' };
const pollutant = (code, value, units) => ({ code, concentration: { value, units } });
const answer = (language) => ({
  dateTime: '2026-10-19T05:00:00Z',
  regionCode: 'fr',
  indexes: [
    {
      code: 'uaqi',
      displayName: 'Universal AQI',
      aqi: 68,
      category: 'Good air quality',
      dominantPollutant: 'pm25',
    },
    {
      code: 'fra_atmo',
      displayName: 'IQA (FR)',
      category: GOOGLE[language].atmo,
      dominantPollutant: 'no2',
    },
  ],
  pollutants: [
    pollutant('pm25', 11.4, 'MICROGRAMS_PER_CUBIC_METER'),
    pollutant('pm10', 19.8, 'MICROGRAMS_PER_CUBIC_METER'),
    pollutant('no2', 14.2, 'PARTS_PER_BILLION'),
    pollutant('o3', 21.5, 'PARTS_PER_BILLION'),
    pollutant('so2', 0.9, 'PARTS_PER_BILLION'),
    pollutant('co', 212, 'PARTS_PER_BILLION'),
  ],
  healthRecommendations: { generalPopulation: GOOGLE[language].advice },
});

// 48 hours from 8:00 (Paris): a slow walk, worse in the evening rush.
let level = 68;
const forecast = Array.from({ length: 48 }, (_, i) => {
  const t = new Date(Date.parse('2026-10-19T06:00:00Z') + i * 3600000).toISOString();
  const hour = (i + 8) % 24;
  level += (random() - 0.5) * 6;
  const rush = hour >= 17 && hour <= 20 ? 18 : hour >= 7 && hour <= 9 ? 8 : 0;
  const aqi = Math.max(5, Math.min(95, Math.round(level - rush)));
  return forecastHourOf(readHour({ dateTime: t, indexes: [{ code: 'uaqi', aqi }] }));
});

const usage = createUsage({ path: null, getPercent: () => 90, now: () => NOW });
for (let i = 0; i < 1590; i += 1) usage.record();

const contents = {};
for (const language of LANGUAGES) {
  const place = { key: 'house:1', kind: 'house', id: '1', name: NAMES[language] };
  const state = {
    at: NOW - 30 * 60000,
    attempt: NOW - 30 * 60000,
    reading: readingOf({ ...readHour(answer(language)), regionCode: 'fr' }),
    error: null,
    forecastAt: NOW - 90 * 60000,
    forecastAttempt: NOW - 90 * 60000,
    forecast,
  };
  contents[language] = {
    air_quality: buildAirQualityWidget({ place, state, hasKey: true, language, now: NOW }),
    forecast: buildForecastWidget({
      place,
      state,
      hasKey: true,
      enabled: true,
      language,
      timezone: 'Europe/Paris',
      now: NOW,
    }),
    budget: buildBudgetWidget({
      usage,
      planned: 1736,
      places: 2,
      percent: 90,
      keyState: 'ok',
      language,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
