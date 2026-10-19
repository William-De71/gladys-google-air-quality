// The Air Quality API client against a fake fetch: request bodies, the key
// in a header only, the error classes, the billing count, the forecast pages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAirQualityApi,
  classifyError,
  ApiKeyError,
  QuotaError,
  OutOfCoverageError,
  BudgetExceededError,
  AirQualityError,
  API_BASE,
} from '../src/air-quality-api.js';
import { createUsage } from '../src/usage.js';
import { fakeFetch, conditions, forecast, keyError, silent, epa } from './helpers/fixtures.js';

const NOW = Date.parse('2026-10-19T05:30:00Z');
const make = (fetchImpl, { percent = 90, key = 'AIzaTEST' } = {}) => {
  const usage = createUsage({ path: null, getPercent: () => percent, now: () => NOW });
  const api = createAirQualityApi({
    getApiKey: () => key,
    usage,
    fetchImpl,
    now: () => NOW,
    logger: silent,
  });
  return { api, usage };
};
const PLACE = { latitude: 45.764012, longitude: 4.835659 };

test('current conditions: one POST, the key in a header, the extra computations, counted', async () => {
  const fetchImpl = fakeFetch([{ status: 200, body: conditions() }]);
  const { api, usage } = make(fetchImpl);
  const hour = await api.current(PLACE, { language: 'fr', localIndex: '' });
  const [call] = fetchImpl.calls;
  assert.equal(call.url, `${API_BASE}/currentConditions:lookup`);
  assert.equal(call.method, 'POST');
  assert.equal(call.headers['X-Goog-Api-Key'], 'AIzaTEST');
  assert.doesNotMatch(call.url, /AIza/);
  assert.deepEqual(call.json, {
    location: { latitude: 45.764, longitude: 4.8357 },
    universalAqi: true,
    extraComputations: ['LOCAL_AQI', 'HEALTH_RECOMMENDATIONS', 'POLLUTANT_CONCENTRATION'],
    languageCode: 'fr',
  });
  assert.equal(hour.universal.aqi, 72);
  assert.equal(hour.local.code, 'fra_atmo');
  assert.equal(hour.local.aqi, null, 'ATMO has no number');
  assert.equal(hour.pollutants.no2.units, 'PARTS_PER_BILLION');
  assert.equal(hour.regionCode, 'fr');
  assert.equal(usage.used(), 1);
});

test('another local index is asked for the country of the place, once known', async () => {
  const fetchImpl = fakeFetch([{ status: 200, body: conditions({ local: epa(40) }) }]);
  const { api } = make(fetchImpl);
  await api.current(PLACE, { language: 'en', localIndex: 'usa_epa' });
  assert.equal(fetchImpl.calls[0].json.customLocalAqis, undefined, 'country unknown yet');
  await api.current({ ...PLACE, regionCode: 'fr' }, { language: 'xx', localIndex: 'usa_epa' });
  assert.deepEqual(fetchImpl.calls[1].json.customLocalAqis, [{ regionCode: 'fr', aqi: 'usa_epa' }]);
  assert.equal(fetchImpl.calls[1].json.languageCode, 'en');
});

test('forecast: 48 hours from the next whole hour, in one page; at most two pages', async () => {
  const start = '2026-10-19T06:00:00Z';
  const page = forecast(start, [60, 50]);
  const fetchImpl = fakeFetch([
    { status: 200, body: { ...page, nextPageToken: 'next' } },
    { status: 200, body: { ...forecast('2026-10-19T08:00:00Z', [40]), nextPageToken: 'again' } },
  ]);
  const { api, usage } = make(fetchImpl);
  const hours = await api.forecast(PLACE, { language: 'en', localIndex: '' });
  assert.equal(fetchImpl.calls.length, 2, 'never a third page');
  assert.deepEqual(fetchImpl.calls[0].json.period, {
    startTime: '2026-10-19T06:00:00.000Z',
    endTime: '2026-10-21T05:00:00.000Z',
  });
  assert.equal(fetchImpl.calls[0].json.pageSize, 48);
  assert.equal(fetchImpl.calls[1].json.pageToken, 'next');
  assert.deepEqual(
    hours.map((hour) => hour.universal.aqi),
    [60, 50, 40],
  );
  assert.equal(usage.used(), 2, 'every page is billed');
});

test('errors: a wrong key is a 400, a disabled API a 403, 429, coverage, network', async () => {
  const { api } = make(fakeFetch([keyError]));
  await assert.rejects(
    api.current(PLACE, {}),
    (err) => err instanceof ApiKeyError && err.reason === 'API_KEY_INVALID',
  );
  const disabled = classifyError(403, {
    error: {
      status: 'PERMISSION_DENIED',
      message: 'Air Quality API has not been used in project 1 before or it is disabled.',
      details: [{ reason: 'SERVICE_DISABLED' }],
    },
  });
  assert.ok(disabled instanceof ApiKeyError);
  assert.equal(disabled.reason, 'SERVICE_DISABLED');
  assert.ok(
    classifyError(403, {
      error: { status: 'PERMISSION_DENIED', message: 'unregistered callers' },
    }) instanceof ApiKeyError,
  );
  assert.ok(classifyError(429, { error: { status: 'RESOURCE_EXHAUSTED' } }) instanceof QuotaError);
  assert.ok(
    classifyError(400, {
      error: { message: 'Information is unavailable for this location.' },
    }) instanceof OutOfCoverageError,
  );
  assert.ok(classifyError(500, null) instanceof AirQualityError);
  const offline = make(fakeFetch([new Error('ECONNRESET')])).api;
  await assert.rejects(offline.current(PLACE, {}), /unreachable: ECONNRESET/);
  const empty = make(fakeFetch([{ status: 200, body: {} }])).api;
  await assert.rejects(empty.current(PLACE, {}), OutOfCoverageError);
});

test('nothing goes out without a key or beyond the budget; a failure is not counted', async () => {
  const fetchImpl = fakeFetch([keyError]);
  const { api, usage } = make(fetchImpl, { key: '' });
  await assert.rejects(api.current(PLACE, {}), (err) => err.reason === 'API_KEY_MISSING');
  assert.equal(fetchImpl.calls.length, 0);
  const counted = make(fakeFetch([keyError]));
  await assert.rejects(counted.api.current(PLACE, {}));
  assert.equal(counted.usage.used(), 0);
  const spent = make(fakeFetch([{ status: 200, body: conditions() }]), { percent: 0.01 });
  await spent.api.current(PLACE, {});
  await assert.rejects(spent.api.current(PLACE, {}), BudgetExceededError);
  assert.equal(usage.used(), 0);
});
