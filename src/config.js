// -----------------------------------------------------------------------------
// Configuration of the Google Air Quality integration.
//
// Fields of the config_schema:
//   - `api_key`          the Google Maps Platform key of the user (Air Quality
//                        API enabled), a secret: never logged;
//   - `use_houses`       one device per located house of Gladys (true by
//                        default); the places added with "Add a place" come
//                        on top;
//   - `refresh_minutes`  how often the current conditions of a place are read
//                        (the API updates them once an hour);
//   - `forecast_hours`   how often the 48-hour forecast of a place is read
//                        (0: never — no forecast widget nor forecast action);
//   - `local_index`      the code of another local index (eaqi, usa_epa…),
//                        empty for the default index of the country;
//   - `budget_percent`   share of the 10,000 free monthly requests the
//                        integration may spend (90 by default; above 100,
//                        Google bills the extra requests);
//   - `language`         language of the texts Gladys does not ask for in a
//                        language (feature names, categories from Google,
//                        scene summaries, messages of the configuration
//                        buttons): `auto` follows the last widget request, and
//                        guesses it from the timezone of Gladys until then.
//
// Internal keys, outside the config_schema (never shown in the UI, stored by
// setConfig in the Gladys database, so they follow the Gladys backups):
//   - `places`         the registry of the added places (see places.js);
//   - `last_language`  language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const REFRESH_MINUTES = { min: 30, max: 360, default: 60 };
const FORECAST_INTERVAL = { min: 0, max: 24, default: 6 };
const BUDGET_PERCENT = { min: 1, max: 1000, default: 90 };
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { registry: 'places', language: 'last_language' };
// The codes of the local indexes: "eaqi", "usa_epa_nowcast", "fra_atmo"…
const LOCAL_INDEX_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

/**
 * @description Read a bounded whole number, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('20', REFRESH_MINUTES); // -> 20
 */
function readNumber(raw, bounds) {
  if (raw === '' || raw === null || raw === undefined) {
    return bounds.default;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Read a boolean of the form (true by default).
 * @param {unknown} raw - The raw value.
 * @param {boolean} fallback - The default.
 * @returns {boolean} The value.
 */
function readBoolean(raw, fallback) {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return fallback;
}

/**
 * @description Read the code of a local index; anything else is ignored.
 * @param {unknown} raw - The typed code.
 * @returns {string} The code, '' for the default index of the country.
 * @example
 * readLocalIndex(' EAQI '); // -> 'eaqi'
 */
function readLocalIndex(raw) {
  const code = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return LOCAL_INDEX_PATTERN.test(code) && code.length <= 40 ? code : '';
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ apiKey: string, useHouses: boolean, refreshMinutes: number,
 *   forecastHours: number, localIndex: string, budgetPercent: number,
 *   language: string }} The config.
 * @example
 * normalizeConfig({ api_key: ' AIza… ', refresh_minutes: 120 });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    apiKey: typeof config.api_key === 'string' ? config.api_key.trim() : '',
    useHouses: readBoolean(config.use_houses, true),
    refreshMinutes: readNumber(config.refresh_minutes, REFRESH_MINUTES),
    forecastHours: readNumber(config.forecast_hours, FORECAST_INTERVAL),
    localIndex: readLocalIndex(config.local_index),
    budgetPercent: readNumber(config.budget_percent, BUDGET_PERCENT),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

// Timezones of the countries speaking one of the languages of the
// integration; any other one is English. A guess for the first devices only:
// the first widget shown gives the real language.
const TIMEZONE_LANGUAGES = {
  fr: [
    'Europe/Paris',
    'Europe/Monaco',
    'Europe/Brussels',
    'Europe/Luxembourg',
    'Indian/Reunion',
    'Indian/Mayotte',
    'America/Guadeloupe',
    'America/Martinique',
    'America/Cayenne',
    'America/Miquelon',
    'Pacific/Noumea',
    'Pacific/Tahiti',
    'America/Montreal',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  de: ['Europe/Berlin', 'Europe/Busingen', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Vaduz'],
  es: [
    'Europe/Madrid',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Caracas',
    'America/Montevideo',
    'America/Asuncion',
    'America/La_Paz',
    'America/Guayaquil',
    'America/Havana',
    'America/Panama',
    'America/Costa_Rica',
    'America/Guatemala',
    'America/Santo_Domingo',
    'America/Puerto_Rico',
  ],
};

/**
 * @description The language of the texts guessed from a timezone, before
 * any widget was shown.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {string} en, fr, de or es.
 * @example
 * guessLanguage('Europe/Paris'); // -> 'fr'
 */
function guessLanguage(timezone) {
  const zone = String(timezone ?? '');
  if (zone.startsWith('America/Argentina/')) return 'es';
  const found = Object.entries(TIMEZONE_LANGUAGES).find(([, zones]) => zones.includes(zone));
  return found ? found[0] : 'en';
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  REFRESH_MINUTES,
  FORECAST_INTERVAL,
  BUDGET_PERCENT,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  readNumber,
  readBoolean,
  readLocalIndex,
  guessLanguage,
  normalizeConfig,
  readLanguage,
};
