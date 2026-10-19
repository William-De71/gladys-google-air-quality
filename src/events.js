// -----------------------------------------------------------------------------
// Scene triggers and scene actions of the integration.
//
// Triggers, one event per transition (never a periodic snapshot):
//   - `category_changed` at a scheduled reading, the category of the
//                        Universal AQI (`index: universal`) or of the local
//                        index (`index: local`) of a place differs from the
//                        previous reading's — never at the first reading;
//   - `budget_alert`     the requests of the month reach 80 % of the budget
//                        (`warning`), then 100 % (`exhausted`): once each a month;
//   - `api_key_refused`  Google starts refusing the key (invalid, API not
//                        enabled, no billing account): once, until a request
//                        succeeds again.
// The values (UAQI, PM2.5…) are device features: "PM2.5 above 25" is a
// device-state trigger of Gladys, not one of the integration.
//
// Actions:
//   - `get_air_quality`  the last reading of a place (a request only when it
//                        is older than the interval, or when asked to);
//   - `get_forecast`     the worst hour of the coming hours at a place.
// Every event value is a flat scalar; never an event as the consequence of
// an action.
// -----------------------------------------------------------------------------

import { idsOf } from './device.js';
import { pollutantName } from './reading.js';
import { t } from './i18n.js';
import { wallClock } from './time.js';

const TRIGGERS = {
  CATEGORY_CHANGED: 'category_changed',
  BUDGET_ALERT: 'budget_alert',
  API_KEY_REFUSED: 'api_key_refused',
};
const SCENE_ACTIONS = { GET_AIR_QUALITY: 'get_air_quality', GET_FORECAST: 'get_forecast' };
const BUDGET_LEVELS = { WARNING: 'warning', EXHAUSTED: 'exhausted' };
const INDEXES = { UNIVERSAL: 'universal', LOCAL: 'local' };
// Share of the budget that fires the warning.
const WARNING_SHARE = 0.8;

/**
 * @description The UAQI category of a reading, in a language.
 * @param {object} reading - The reading.
 * @param {string} language - The language.
 * @returns {string} The category ('' without a UAQI).
 */
const categoryOf = (reading, language) =>
  reading?.level ? t(`level_${reading.level}`, language) : '';

/**
 * @description The sentence of a reading, for a message or a voice.
 * @param {string} name - The name of the place.
 * @param {object} reading - The reading.
 * @param {string} language - The language.
 * @returns {string} The sentence.
 * @example
 * summaryOf('Home', reading, 'en'); // -> 'Home: good air quality (UAQI 72), …'
 */
function summaryOf(name, reading, language) {
  const parts = [];
  if (reading.local?.category) {
    parts.push(
      t('summaryLocal', language, {
        index: reading.local.name,
        category: reading.local.category,
      }),
    );
  }
  if (reading.dominant) {
    parts.push(t('summaryDominant', language, { pollutant: pollutantName(reading.dominant) }));
  }
  if (typeof reading.pollutants?.pm25 === 'number') {
    parts.push(`PM2.5 ${reading.pollutants.pm25} µg/m³`);
  }
  return t('summary', language, {
    name,
    category: categoryOf(reading, language).toLocaleLowerCase(language),
    aqi: reading.uaqi ?? '—',
    details: parts.length > 0 ? `, ${parts.join(', ')}` : '',
  });
}

/**
 * @description The outputs of `get_air_quality` (only the values the reading has).
 * @param {string} name - The name of the place.
 * @param {object} reading - The reading.
 * @param {string} language - The language of the texts.
 * @returns {object} The declared outputs, scalars only.
 */
function readingOutputs(name, reading, language) {
  const outputs = {
    uaqi: reading.uaqi,
    level: reading.level,
    category: categoryOf(reading, language) || null,
    local_index: reading.local?.name || null,
    local_aqi: reading.local?.aqi ?? null,
    local_category: reading.local?.category || null,
    dominant_pollutant: pollutantName(reading.dominant) || null,
    pm25: reading.pollutants?.pm25 ?? null,
    pm10: reading.pollutants?.pm10 ?? null,
    no2: reading.pollutants?.no2 ?? null,
    o3: reading.pollutants?.o3 ?? null,
    so2: reading.pollutants?.so2 ?? null,
    co: reading.pollutants?.co ?? null,
    health_recommendation: reading.health?.generalPopulation?.slice(0, 1000) ?? null,
    summary: summaryOf(name, reading, language).slice(0, 1000),
  };
  return Object.fromEntries(
    Object.entries(outputs).filter(([, value]) => value !== null && value !== undefined),
  );
}

/**
 * @description "07:00" in the timezone of Gladys.
 * @param {string} iso - The instant.
 * @param {string} timezone - IANA timezone.
 * @returns {string} The local time.
 */
function localTime(iso, timezone) {
  const { hour, minute } = wallClock(new Date(iso), timezone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * @description The outputs of `get_forecast`.
 * @param {string} name - The name of the place.
 * @param {object} worst - The worst hour (reading.js worstHour).
 * @param {number} hours - The horizon.
 * @param {string} timezone - IANA timezone.
 * @param {string} language - The language.
 * @returns {object} The declared outputs.
 */
function forecastOutputs(name, worst, hours, timezone, language) {
  const time = localTime(worst.t, timezone);
  const category = t(`level_${worst.level}`, language);
  const outputs = {
    worst_uaqi: worst.uaqi,
    worst_level: worst.level,
    worst_category: category,
    worst_time: time,
    worst_local_category: worst.localCategory || null,
    summary: t('forecastSummary', language, {
      name,
      hours,
      category: category.toLocaleLowerCase(language),
      aqi: worst.uaqi,
      time,
    }).slice(0, 1000),
  };
  return Object.fromEntries(Object.entries(outputs).filter(([, value]) => value !== null));
}

/**
 * @description The events of a new reading compared with the previous one:
 * one per index whose category changed.
 * @param {object} gladys - The SDK client (external ids).
 * @param {object} place - The place.
 * @param {object|null} previous - The previous reading.
 * @param {object} reading - The new reading.
 * @param {string} language - The language of the texts.
 * @returns {object[]} The flat data of each event.
 */
function categoryChanges(gladys, place, previous, reading, language) {
  if (!previous) return [];
  const base = {
    place: idsOf(gladys, place).device,
    name: place.name,
    dominant_pollutant: pollutantName(reading.dominant),
  };
  const events = [];
  if (reading.level && previous.level && reading.level !== previous.level) {
    const category = categoryOf(reading, language);
    const before = categoryOf(previous, language);
    events.push({
      ...base,
      index: INDEXES.UNIVERSAL,
      level: reading.level,
      previous_level: previous.level,
      category,
      previous_category: before,
      aqi: reading.uaqi,
      summary: t('changedSummary', language, {
        name: place.name,
        index: 'UAQI',
        category: category.toLocaleLowerCase(language),
        previous: before.toLocaleLowerCase(language),
      }).slice(0, 1000),
    });
  }
  const now = reading.local;
  const then = previous.local;
  if (now?.category && then?.category && now.code === then.code && now.category !== then.category) {
    events.push({
      ...base,
      index: INDEXES.LOCAL,
      level: '',
      previous_level: '',
      category: now.category,
      previous_category: then.category,
      aqi: now.aqi,
      summary: t('changedSummary', language, {
        name: place.name,
        index: now.name,
        category: now.category,
        previous: then.category,
      }).slice(0, 1000),
    });
  }
  return events;
}

/**
 * @description The budget level reached by a count.
 * @param {number} used - Requests of the month.
 * @param {number} budget - The monthly budget.
 * @returns {string|null} warning, exhausted, or null.
 */
function budgetLevel(used, budget) {
  if (used >= budget) return BUDGET_LEVELS.EXHAUSTED;
  if (used >= Math.ceil(budget * WARNING_SHARE)) return BUDGET_LEVELS.WARNING;
  return null;
}

/**
 * @description The data of a budget_alert event.
 * @param {string} level - warning or exhausted.
 * @param {number} used - Requests of the month.
 * @param {number} budget - The monthly budget.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function budgetData(level, used, budget, language) {
  return {
    level,
    used,
    budget,
    summary: t(
      level === BUDGET_LEVELS.EXHAUSTED ? 'budgetExhaustedSummary' : 'budgetWarningSummary',
      language,
      { used, budget },
    ),
  };
}

/**
 * @description The data of an api_key_refused event.
 * @param {string} reason - The Google reason.
 * @param {string} hint - What to do, in the language.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function keyRefusedData(reason, hint, language) {
  return { reason, summary: t('apiErrorSummary', language, { reason, hint }).slice(0, 1000) };
}

export {
  TRIGGERS,
  SCENE_ACTIONS,
  BUDGET_LEVELS,
  INDEXES,
  WARNING_SHARE,
  categoryOf,
  summaryOf,
  readingOutputs,
  localTime,
  forecastOutputs,
  categoryChanges,
  budgetLevel,
  budgetData,
  keyRefusedData,
};
