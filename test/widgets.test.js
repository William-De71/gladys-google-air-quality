// Every widget content through validateWidgetContent (the checks of the core,
// which only run in debug mode in production) and the content budget of a
// card, in the four languages and in the edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { buildAirQualityWidget, buildForecastWidget, buildBudgetWidget } from '../src/widgets.js';
import { readingOf, forecastHourOf } from '../src/reading.js';
import { readHour } from '../src/air-quality-api.js';
import { createUsage } from '../src/usage.js';
import { LANGUAGES } from '../src/i18n.js';
import { HOME, conditions, forecast, epa } from './helpers/fixtures.js';

const NOW = Date.parse('2026-10-19T05:30:00Z');
const types = (content) => content.components.map((component) => component.type);
const stateOf = (body, extra = {}) => ({
  at: NOW - 12 * 60000,
  attempt: NOW - 12 * 60000,
  reading: readingOf(readHour(body)),
  error: null,
  forecastAt: NOW - 60 * 60000,
  forecastAttempt: NOW - 60 * 60000,
  forecast: forecast(
    '2026-10-19T05:00:00Z',
    Array.from({ length: 48 }, (_, i) => 80 - Math.round(30 * Math.sin(i / 4) ** 2)),
  )
    .hourlyForecasts.map(readHour)
    .map(forecastHourOf),
  ...extra,
});

/**
 * @description Assert a content is valid and within the budget of a card.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (list) => types(content).filter((type) => list.includes(type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(count(['status']) <= 1, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
  for (const component of content.components) {
    if (component.type === 'status') {
      component.items.forEach((item) =>
        assert.ok(item.value, `${label}: a status row needs a value`),
      );
    }
  }
}

test('air quality widget: gauge, 4 tiles, status, health advice, in every language', () => {
  for (const language of LANGUAGES) {
    const content = buildAirQualityWidget({
      place: HOME,
      state: stateOf(conditions()),
      hasKey: true,
      language,
      now: NOW,
    });
    assertValid(content, language);
    assert.deepEqual(types(content), [
      'text',
      'gauge',
      'value',
      'value',
      'value',
      'value',
      'status',
      'text',
    ]);
    assert.equal(content.components[1].value, 72);
    assert.equal(content.components[1].color, 'success');
  }
});

test('air quality widget: the local index tile when it is a number, colors by level', () => {
  const content = buildAirQualityWidget({
    place: HOME,
    state: stateOf(conditions({ aqi: 12, local: epa(180) })),
    hasKey: true,
    language: 'en',
    now: NOW,
  });
  assertValid(content, 'epa');
  assert.equal(content.components[1].color, 'danger');
  assert.deepEqual(
    content.components.filter((c) => c.type === 'value').map((c) => [c.label, c.value]),
    [
      ['AQI (US)', '180'],
      ['PM2.5', 9.1],
      ['NO₂', 18.8],
      ['O₃', 58.9],
    ],
  );
});

test('air quality widget: no key, no place, no reading, an error', () => {
  const base = { place: HOME, hasKey: true, language: 'fr', now: NOW };
  const message = (content) => {
    assertValid(content, 'message');
    return content.components[0].text;
  };
  assert.match(
    message(buildAirQualityWidget({ ...base, hasKey: false, state: null })),
    /clé d’API/,
  );
  assert.match(
    message(buildAirQualityWidget({ ...base, place: null, chosen: false })),
    /Choisissez/,
  );
  assert.match(
    message(buildAirQualityWidget({ ...base, place: null, chosen: true })),
    /n’est plus suivi/,
  );
  assert.match(message(buildAirQualityWidget({ ...base, state: null })), /pas encore de mesure/);
  assert.match(
    message(
      buildAirQualityWidget({
        ...base,
        state: {
          reading: null,
          error: { message: 'Google has no air quality data for this place.' },
        },
      }),
    ),
    /aucune mesure\. Google has no/,
  );
});

test('forecast widget: a chart of the next hours with the worst one marked', () => {
  for (const language of LANGUAGES) {
    const content = buildForecastWidget({
      place: HOME,
      state: stateOf(conditions()),
      hasKey: true,
      enabled: true,
      language,
      timezone: 'Europe/Paris',
      now: NOW,
    });
    assertValid(content, language);
    const chart = content.components[1];
    assert.equal(chart.type, 'chart');
    assert.equal(chart.series[0].points.length, 48);
    assert.equal(chart.annotations.length, 1);
  }
  const off = buildForecastWidget({
    place: HOME,
    state: null,
    hasKey: true,
    enabled: false,
    language: 'en',
    now: NOW,
  });
  assert.match(off.components[0].text, /forecast is off/);
  const none = buildForecastWidget({
    place: HOME,
    state: stateOf(conditions(), { forecast: [] }),
    hasKey: true,
    enabled: true,
    language: 'en',
    now: NOW,
  });
  assert.match(none.components[0].text, /no forecast yet/);
});

test('budget widget: the gauge of the month, what is planned, the state of the key', () => {
  const usage = createUsage({ path: null, getPercent: () => 90, now: () => NOW });
  for (let i = 0; i < 7300; i += 1) usage.record();
  for (const language of LANGUAGES) {
    const content = buildBudgetWidget({
      usage,
      planned: 1736,
      places: 2,
      percent: 90,
      keyState: 'ok',
      language,
    });
    assertValid(content, language);
    assert.equal(content.components[2].color, 'warning');
  }
  const refused = buildBudgetWidget({
    usage,
    planned: 0,
    places: 0,
    percent: 90,
    keyState: 'refused',
    language: 'en',
  });
  assert.equal(refused.components[3].items[1].value, 'Refused');
});
