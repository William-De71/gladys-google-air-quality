// From the answers to the readings: levels, conversions, the worst hour,
// and the monthly plan.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, toMicrograms, readingOf, forecastHourOf, worstHour } from '../src/reading.js';
import { readHour } from '../src/air-quality-api.js';
import { planOf, plannedPerMonth } from '../src/plan.js';
import { conditions, forecast } from './helpers/fixtures.js';

test('UAQI levels: higher is better, the five fixed categories', () => {
  assert.deepEqual([100, 80, 79, 60, 59, 40, 39, 20, 19, 0].map(levelOf), [
    'excellent',
    'excellent',
    'good',
    'good',
    'moderate',
    'moderate',
    'low',
    'low',
    'poor',
    'poor',
  ]);
  assert.equal(levelOf(null), null);
});

test('concentrations in µg/m³: particles as they are, gases from ppb at 25 °C', () => {
  assert.equal(toMicrograms('pm25', { value: 9.16, units: 'MICROGRAMS_PER_CUBIC_METER' }), 9.2);
  assert.equal(toMicrograms('no2', { value: 10, units: 'PARTS_PER_BILLION' }), 18.8);
  assert.equal(toMicrograms('o3', { value: 50, units: 'PARTS_PER_BILLION' }), 98.2);
  assert.equal(toMicrograms('co', { value: 200, units: 'PARTS_PER_BILLION' }), 229.1);
  assert.equal(toMicrograms('nh3', { value: 1, units: 'PARTS_PER_BILLION' }), null);
  assert.equal(toMicrograms('so2', { value: -1, units: 'PARTS_PER_BILLION' }), 0);
});

test('a reading keeps what the integration shows, the local index first for the dominant', () => {
  const reading = readingOf(readHour(conditions()));
  assert.equal(reading.uaqi, 72);
  assert.equal(reading.level, 'good');
  assert.equal(reading.local.name, 'IQA (FR)');
  assert.equal(reading.dominant, 'no2');
  assert.deepEqual(Object.keys(reading.pollutants), ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co']);
  assert.equal(reading.health.generalPopulation.length > 10, true);
  assert.equal(readingOf(readHour({ indexes: [] })).level, null);
});

test('the worst hour of a horizon (lowest UAQI, first on a tie)', () => {
  const from = Date.parse('2026-10-19T05:30:00Z');
  const hours = forecast('2026-10-19T05:00:00Z', [70, 50, 30, 30, 90, 10])
    .hourlyForecasts.map(readHour)
    .map(forecastHourOf);
  assert.equal(worstHour(hours, from, 4).t, '2026-10-19T07:00:00.000Z');
  assert.equal(worstHour(hours, from, 6).uaqi, 10);
  assert.equal(worstHour(hours, from + 10 * 3600000, 6), null);
});

test('the plan stays within the budget by stretching both intervals', () => {
  assert.equal(plannedPerMonth(1, 60, 360), 744 + 124);
  const small = planOf({ places: 2, refreshMinutes: 60, forecastHours: 6, budget: 9000 });
  assert.deepEqual(
    [small.stretched, small.refreshMinutes, small.forecastMinutes],
    [false, 60, 360],
  );
  const big = planOf({ places: 15, refreshMinutes: 60, forecastHours: 6, budget: 9000 });
  assert.equal(big.stretched, true);
  assert.ok(big.planned <= 9000, String(big.planned));
  assert.ok(big.refreshMinutes > 60 && big.forecastMinutes > 360);
  const none = planOf({ places: 15, refreshMinutes: 60, forecastHours: 0, budget: 9000 });
  assert.equal(none.forecastMinutes, 0);
  assert.ok(none.planned <= 9000);
});
