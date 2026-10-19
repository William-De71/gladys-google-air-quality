// -----------------------------------------------------------------------------
// From the answers of the Air Quality API to the readings the integration
// stores, publishes and shows.
//
// Universal AQI (UAQI, code `uaqi`): 0 to 100, and HIGHER IS BETTER (100:
// excellent air, 0: poor). Its five categories are fixed, so the integration
// derives a stable level from the value (excellent, good, moderate, low,
// poor) and writes the category in its own four languages: the scene filters
// and the widget colors never depend on a text translated by Google.
//
// Local index (the default index of the country, or the one chosen in the
// configuration): its scale is its own (US EPA 0-500, higher is worse;
// DAQI 1-10…), and some have no number at all (ATMO in France, EAQI in
// Europe: a category only). Its category is Google's text, in the language
// asked for.
//
// Concentrations: Google gives the particles in µg/m³ and the gases in ppb.
// The Gladys categories of NO2, O3 and SO2 hold µg/m³, so the gases are
// converted at 25 °C and 1 atm (µg/m³ = ppb × molar mass / 24.45), the
// convention of the WHO and the US EPA; CO goes from ppb to µg/m³ the same
// way (it has no concentration category in Gladys: widgets and scenes only).
// -----------------------------------------------------------------------------

const MOLAR_VOLUME = 24.45;
const MOLAR_MASS = { no2: 46.0055, o3: 47.9982, so2: 64.066, co: 28.0101 };
// The pollutants the integration shows, in their display order.
const POLLUTANTS = ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'];
const POLLUTANT_NAMES = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  o3: 'O₃',
  so2: 'SO₂',
  co: 'CO',
  nh3: 'NH₃',
  no: 'NO',
  nox: 'NOx',
  c6h6: 'C₆H₆',
  ox: 'Ox',
  nmhc: 'NMHC',
  trs: 'TRS',
};
const LEVELS = ['excellent', 'good', 'moderate', 'low', 'poor'];
// The colors of the levels, in the semantic palette of the widgets.
const LEVEL_COLORS = {
  excellent: 'success',
  good: 'success',
  moderate: 'warning',
  low: 'warning',
  poor: 'danger',
};
const HEALTH_GROUPS = [
  'generalPopulation',
  'elderly',
  'lungDiseasePopulation',
  'heartDiseasePopulation',
  'athletes',
  'pregnantWomen',
  'children',
];

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * @description The level of a Universal AQI value (higher is better).
 * @param {number|null} aqi - The UAQI, 0 to 100.
 * @returns {string|null} excellent, good, moderate, low, poor; null without a value.
 * @example
 * levelOf(72); // -> 'good'
 */
function levelOf(aqi) {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) return null;
  if (aqi >= 80) return 'excellent';
  if (aqi >= 60) return 'good';
  if (aqi >= 40) return 'moderate';
  if (aqi >= 20) return 'low';
  return 'poor';
}

/**
 * @description A concentration in µg/m³.
 * @param {string} code - The pollutant code.
 * @param {{ value: number, units: string }} concentration - As Google gives it.
 * @returns {number|null} µg/m³ with one decimal, null when it cannot be converted.
 * @example
 * toMicrograms('no2', { value: 10, units: 'PARTS_PER_BILLION' }); // -> 18.8
 */
function toMicrograms(code, concentration) {
  if (!concentration || !Number.isFinite(concentration.value)) return null;
  const value = Math.max(0, concentration.value);
  if (concentration.units === 'MICROGRAMS_PER_CUBIC_METER') return round1(value);
  if (concentration.units === 'PARTS_PER_BILLION' && MOLAR_MASS[code]) {
    return round1((value * MOLAR_MASS[code]) / MOLAR_VOLUME);
  }
  return null;
}

/**
 * @description The display name of a pollutant code.
 * @param {string} code - pm25, no2…
 * @returns {string} PM2.5, NO₂… ('' for none).
 */
const pollutantName = (code) => (code ? (POLLUTANT_NAMES[code] ?? String(code).toUpperCase()) : '');

/**
 * @description The reading of a place from one hour of the API (readHour).
 * @param {object} hour - `{ dateTime, universal, local, pollutants, health, regionCode? }`.
 * @returns {object} The reading.
 */
function readingOf(hour) {
  const pollutants = {};
  POLLUTANTS.forEach((code) => {
    const value = toMicrograms(code, hour.pollutants?.[code]);
    if (value !== null) pollutants[code] = value;
  });
  const health = {};
  HEALTH_GROUPS.forEach((group) => {
    if (hour.health?.[group]) health[group] = hour.health[group];
  });
  const universal = hour.universal
    ? { aqi: hour.universal.aqi, dominant: hour.universal.dominant }
    : null;
  const local = hour.local
    ? {
        code: hour.local.code,
        name: hour.local.name.slice(0, 40),
        aqi: hour.local.aqi,
        display: hour.local.display.slice(0, 12),
        category: hour.local.category.slice(0, 80),
        dominant: hour.local.dominant,
      }
    : null;
  return {
    dateTime: hour.dateTime,
    regionCode: hour.regionCode ?? null,
    uaqi: universal?.aqi ?? null,
    level: levelOf(universal?.aqi ?? null),
    local,
    // The pollutant the local index blames, else the one of the UAQI.
    dominant: local?.dominant || universal?.dominant || '',
    pollutants,
    health,
  };
}

/**
 * @description One hour of a forecast, reduced to what the chart and the
 * forecast action use.
 * @param {object} hour - One hour of the API (readHour).
 * @returns {object} `{ t, uaqi, level, local, localCategory, dominant }`.
 */
function forecastHourOf(hour) {
  const reading = readingOf(hour);
  return {
    t: reading.dateTime,
    uaqi: reading.uaqi,
    level: reading.level,
    local: reading.local?.aqi ?? null,
    localCategory: reading.local?.category ?? '',
    dominant: reading.dominant,
  };
}

/**
 * @description The worst hour of a forecast within a horizon (the lowest
 * UAQI; the first one on a tie).
 * @param {object[]} hours - The forecast hours.
 * @param {number} from - Now, in ms.
 * @param {number} horizon - Hours to look at.
 * @returns {object|null} The hour, null when none has a UAQI.
 */
function worstHour(hours, from, horizon) {
  const until = from + horizon * 3600000;
  return (hours ?? [])
    .filter((hour) => {
      const time = Date.parse(hour.t);
      return time + 3600000 > from && time < until && typeof hour.uaqi === 'number';
    })
    .reduce((worst, hour) => (worst === null || hour.uaqi < worst.uaqi ? hour : worst), null);
}

export {
  MOLAR_VOLUME,
  MOLAR_MASS,
  POLLUTANTS,
  POLLUTANT_NAMES,
  LEVELS,
  LEVEL_COLORS,
  HEALTH_GROUPS,
  levelOf,
  toMicrograms,
  pollutantName,
  readingOf,
  forecastHourOf,
  worstHour,
};
