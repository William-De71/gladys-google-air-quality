// -----------------------------------------------------------------------------
// Dashboard widgets of the Google Air Quality integration.
//
//   - `air_quality`  one place: Universal AQI gauge (colored by its level),
//                    the local index when it is a number, PM2.5, PM10, NO₂,
//                    O₃, the categories, the dominant pollutant and the health
//                    advice of Google for the general population;
//   - `forecast`     one place: the Universal AQI of the next 48 hours as a
//                    chart, the worst hour of the next 24 hours marked;
//   - `budget`       the requests of the month against the budget, what the
//                    places plan, and whether Google accepts the key.
// No refresh button: the API updates its data once an hour, and every
// request is billed. Every text exists in the four languages (the content is
// cached per language). Content budget of a card: 8 components, 1 main one,
// 6 tiles, 2 texts (1 body), 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { t, ago, formatNumber, formatMonth } from './i18n.js';
import { LEVEL_COLORS, pollutantName, worstHour } from './reading.js';
import { categoryOf, localTime } from './events.js';

const WIDGETS = { AIR_QUALITY: 'air_quality', FORECAST: 'forecast', BUDGET: 'budget' };
const TTL = 600;
const UGM3 = 'µg/m³';
// The worst hour of the forecast widget is looked for in this horizon.
const WORST_HORIZON = 24;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
const messageContent = (message, ttl = TTL) => ({
  ttl_seconds: ttl,
  components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
});

/**
 * @description The message of a widget that cannot show its place, or null.
 * @param {object} options - `{ hasKey, place, chosen, state, language, timezone? }`.
 * @returns {object|null} The content.
 */
function unavailable({ hasKey, place, chosen, state, language }) {
  if (!hasKey) return messageContent(t('widgetNoKey', language));
  if (!place)
    return messageContent(t(chosen ? 'widgetUnknownPlace' : 'widgetChoosePlace', language));
  if (!state?.reading) {
    const error = state?.error?.message;
    return messageContent(
      error
        ? t('widgetError', language, { name: place.name, message: error })
        : t('widgetNoReading', language, { name: place.name }),
    );
  }
  return null;
}

/**
 * @description A concentration tile.
 * @param {string} code - The pollutant.
 * @param {object} reading - The reading.
 * @returns {object} The value component.
 */
const tile = (code, reading) => ({
  type: 'value',
  value: typeof reading.pollutants?.[code] === 'number' ? reading.pollutants[code] : '—',
  unit: UGM3,
  label: pollutantName(code),
  icon: 'wind',
});

/**
 * @description The "air_quality" widget of one place.
 * @param {object} options - Options.
 * @param {object|null} options.place - The place (null: not chosen or gone).
 * @param {object|null} options.state - Its state (state.js).
 * @param {boolean} [options.chosen] - Whether a place is chosen in the settings.
 * @param {boolean} options.hasKey - Whether an API key is configured.
 * @param {string} options.language - The language.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 */
function buildAirQualityWidget({ place, state, chosen = true, hasKey, language, now }) {
  const blocked = unavailable({ hasKey, place, chosen, state, language });
  if (blocked) return blocked;
  const { reading } = state;
  const color = LEVEL_COLORS[reading.level] ?? 'neutral';
  const local = reading.local;
  const components = [
    { type: 'text', variant: 'heading', text: clip(place.name, 40) },
    {
      type: 'gauge',
      value: reading.uaqi ?? 0,
      min: 0,
      max: 100,
      label: clip(t('tileUaqi', language), 24),
      color,
    },
  ];
  const tiles = ['pm25', 'pm10', 'no2', 'o3'];
  if (typeof local?.aqi === 'number') {
    components.push({
      type: 'value',
      value: clip(local.display || String(local.aqi), 12),
      label: clip(local.name, 24),
      icon: 'activity',
    });
    // Five tiles at most beside the gauge: PM10 makes room for the index.
    tiles.splice(1, 1);
  }
  tiles.forEach((code) => components.push(tile(code, reading)));
  const items = [
    { label: t('statusCategory', language), value: categoryOf(reading, language) || '—', color },
  ];
  if (local?.category) {
    items.push({ label: local.name, value: local.category, color: 'neutral' });
  }
  if (reading.dominant) {
    items.push({
      label: t('statusDominant', language),
      value: pollutantName(reading.dominant),
      color: 'neutral',
    });
  }
  items.push({
    label: t('statusUpdated', language),
    value: ago(state.at, now, language),
    color: state.error ? 'warning' : 'neutral',
  });
  components.push({
    type: 'status',
    items: items.map((item) => ({
      ...item,
      label: clip(item.label, 40),
      value: clip(item.value, 40),
    })),
  });
  const advice = reading.health?.generalPopulation;
  if (advice) components.push({ type: 'text', variant: 'body', text: clip(advice, 300) });
  return { ttl_seconds: TTL, components };
}

/**
 * @description The "forecast" widget of one place.
 * @param {object} options - Options.
 * @param {object|null} options.place - The place.
 * @param {object|null} options.state - Its state.
 * @param {boolean} [options.chosen] - Whether a place is chosen in the settings.
 * @param {boolean} options.hasKey - Whether an API key is configured.
 * @param {boolean} options.enabled - Whether the forecast is read (forecast_hours > 0).
 * @param {string} options.language - The language.
 * @param {string} options.timezone - IANA timezone of Gladys.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 */
function buildForecastWidget({
  place,
  state,
  chosen = true,
  hasKey,
  enabled,
  language,
  timezone,
  now,
}) {
  if (hasKey && !enabled) return messageContent(t('widgetForecastOff', language));
  if (!hasKey || !place) return unavailable({ hasKey, place, chosen, state, language });
  const hours = (state?.forecast ?? []).filter(
    (hour) => Date.parse(hour.t) + 3600000 > now && typeof hour.uaqi === 'number',
  );
  if (hours.length === 0) {
    return messageContent(t('widgetNoForecast', language, { name: place.name }));
  }
  const worst = worstHour(hours, now, WORST_HORIZON);
  const components = [
    { type: 'text', variant: 'heading', text: clip(place.name, 40) },
    {
      type: 'chart',
      chart_type: 'area',
      title: clip(t('chartTitle', language), 40),
      unit: 'UAQI',
      series: [{ name: 'UAQI', points: hours.map((hour) => ({ t: hour.t, v: hour.uaqi })) }],
      ...(worst
        ? {
            annotations: [
              {
                t: worst.t,
                value: worst.uaqi,
                label: clip(t('annotationWorst', language), 16),
                color: LEVEL_COLORS[worst.level] ?? 'neutral',
              },
            ],
          }
        : {}),
    },
  ];
  const items = [];
  if (worst) {
    items.push({
      label: t('statusWorst', language),
      value: `${localTime(worst.t, timezone)} · UAQI ${worst.uaqi}`,
      color: LEVEL_COLORS[worst.level] ?? 'neutral',
    });
    if (worst.dominant) {
      items.push({
        label: t('statusDominant', language),
        value: pollutantName(worst.dominant),
        color: 'neutral',
      });
    }
  }
  items.push({
    label: t('statusForecastUpdated', language),
    value: ago(state.forecastAt, now, language),
    color: 'neutral',
  });
  components.push({
    type: 'status',
    items: items.map((item) => ({
      ...item,
      label: clip(item.label, 40),
      value: clip(item.value, 40),
    })),
  });
  return { ttl_seconds: TTL, components };
}

/**
 * @description The "budget" widget.
 * @param {object} options - Options.
 * @param {object} options.usage - The usage counter.
 * @param {number} options.planned - Requests a month the places plan.
 * @param {number} options.places - The number of followed places.
 * @param {number} options.percent - The budget, in % of the free usage.
 * @param {string} options.keyState - missing, unknown, ok, refused or paused.
 * @param {string} options.language - The language.
 * @returns {object} The content.
 */
function buildBudgetWidget({ usage, planned, places, percent, keyState, language }) {
  const used = usage.used();
  const budget = usage.budget();
  const keyColors = { ok: 'success', unknown: 'neutral', refused: 'danger', missing: 'warning' };
  const keyTexts = {
    ok: 'budgetKeyOk',
    unknown: 'budgetKeyUnknown',
    refused: 'budgetKeyRefused',
    missing: 'budgetKeyMissing',
    paused: 'budgetPaused',
  };
  return {
    ttl_seconds: TTL,
    components: [
      { type: 'text', variant: 'heading', text: clip(formatMonth(usage.month(), language), 40) },
      {
        type: 'text',
        variant: 'caption',
        text: clip(t('budgetCaption', language, { percent }), 80),
      },
      {
        type: 'gauge',
        value: Math.min(used, budget),
        min: 0,
        max: budget,
        label: clip(t('gaugeLabel', language, { budget: formatNumber(budget, language) }), 24),
        color: used >= budget ? 'danger' : used >= budget * 0.8 ? 'warning' : 'success',
      },
      {
        type: 'status',
        items: [
          {
            label: t('budgetPlannedLabel', language),
            value: clip(
              t('budgetPlanned', language, {
                count: formatNumber(planned, language),
                places,
              }),
              40,
            ),
            color: planned > budget ? 'warning' : 'neutral',
          },
          {
            label: t('budgetKey', language),
            value: clip(t(keyTexts[keyState] ?? 'budgetKeyUnknown', language), 40),
            color: keyColors[keyState] ?? 'warning',
          },
        ],
      },
    ],
  };
}

export {
  WIDGETS,
  TTL,
  WORST_HORIZON,
  clip,
  messageContent,
  buildAirQualityWidget,
  buildForecastWidget,
  buildBudgetWidget,
};
