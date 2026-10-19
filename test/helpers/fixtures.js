// Shared fixtures of the tests: a few places, answers of the Air Quality API,
// a fake fetch, a silent logger. Tests never touch the network.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

// Only what the device builders use from the SDK client.
const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:test-integration:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

const HOUSE_ID = '6a8b2f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const HOME = {
  key: `house:${HOUSE_ID}`,
  kind: 'house',
  id: HOUSE_ID,
  name: 'Home',
  latitude: 45.764,
  longitude: 4.8357,
};
const OFFICE = {
  key: 'place:a1b2c3d4',
  kind: 'place',
  id: 'a1b2c3d4',
  name: 'Office',
  latitude: 45.75,
  longitude: 4.85,
};

const universal = (aqi, category = 'Good air quality', dominant = 'pm25') => ({
  code: 'uaqi',
  displayName: 'Universal AQI',
  aqi,
  aqiDisplay: String(aqi),
  color: { red: 0.5, green: 0.8, blue: 0.2 },
  category,
  dominantPollutant: dominant,
});
const atmo = (category = 'Medium air quality') => ({
  code: 'fra_atmo',
  displayName: 'IQA (FR)',
  color: { red: 0.31, green: 0.8, blue: 0.67 },
  category,
  dominantPollutant: 'no2',
});
const epa = (aqi) => ({
  code: 'usa_epa',
  displayName: 'AQI (US)',
  aqi,
  aqiDisplay: String(aqi),
  category: 'Moderate air quality',
  dominantPollutant: 'pm25',
});
const pollutant = (code, value, units) => ({
  code,
  displayName: code.toUpperCase(),
  fullName: code,
  concentration: { value, units },
});
const POLLUTANTS = [
  pollutant('co', 250.5, 'PARTS_PER_BILLION'),
  pollutant('no2', 10, 'PARTS_PER_BILLION'),
  pollutant('o3', 30, 'PARTS_PER_BILLION'),
  pollutant('pm10', 18.4, 'MICROGRAMS_PER_CUBIC_METER'),
  pollutant('pm25', 9.12, 'MICROGRAMS_PER_CUBIC_METER'),
  pollutant('so2', 1, 'PARTS_PER_BILLION'),
];

/**
 * @description A currentConditions:lookup answer.
 * @param {object} [values] - `{ aqi, category, local, dateTime }`.
 * @returns {object} The body.
 */
function conditions({ aqi = 72, category = 'Good air quality', local = atmo(), dateTime } = {}) {
  return {
    dateTime: dateTime ?? '2026-10-19T05:00:00Z',
    regionCode: 'fr',
    indexes: [universal(aqi, category), ...(local ? [local] : [])],
    pollutants: POLLUTANTS,
    healthRecommendations: {
      generalPopulation: 'With this level of air quality, you have no limitations.',
      children: 'Children can go out.',
    },
  };
}

/**
 * @description A forecast:lookup answer of `hours` hours from `start`.
 * @param {string} start - ISO of the first hour.
 * @param {number[]} values - The UAQI of each hour.
 * @returns {object} The body.
 */
function forecast(start, values) {
  return {
    regionCode: 'fr',
    hourlyForecasts: values.map((aqi, index) => ({
      dateTime: new Date(Date.parse(start) + index * 3600000).toISOString(),
      indexes: [universal(aqi), atmo()],
      pollutants: POLLUTANTS,
    })),
  };
}

/**
 * @description A temporary directory for the /data files.
 * @returns {{ state: string, usage: string }} The paths (the files do not exist).
 */
function dataPaths() {
  const dir = mkdtempSync(join(tmpdir(), 'air-quality-'));
  return { state: join(dir, 'state.json'), usage: join(dir, 'usage.json') };
}

/**
 * @description A fake fetch of the Air Quality API: the reply of each call is
 * chosen by `route(request)`, or taken in order from a queue (the last one
 * forever). Records the requests.
 * @param {Array<object|Function>|Function} replies - `{ status, body }`, or a
 *   function of the request, or an Error to throw.
 * @returns {Function & { calls: object[] }} The fetch.
 */
function fakeFetch(replies) {
  const queue = Array.isArray(replies) ? [...replies] : null;
  const calls = [];
  const impl = async (url, options) => {
    const request = { url, ...options, json: JSON.parse(options.body) };
    calls.push(request);
    let reply;
    if (typeof replies === 'function') reply = replies(request);
    else if (queue) reply = queue.length > 1 ? queue.shift() : queue[0];
    else reply = defaultReply(request);
    if (typeof reply === 'function') reply = reply(request);
    if (reply instanceof Error) throw reply;
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    };
  };
  impl.calls = calls;
  return impl;
}

/**
 * @description The default answers: conditions, or 48 hours of forecast.
 * @param {object} request - The request.
 * @returns {{ status: number, body: object }} The reply.
 */
function defaultReply(request) {
  if (request.url.endsWith('forecast:lookup')) {
    const values = Array.from({ length: 48 }, (_, i) => 70 - (i % 24 === 9 ? 35 : 0));
    return { status: 200, body: forecast(request.json.period.startTime, values) };
  }
  return { status: 200, body: conditions() };
}

const keyError = {
  status: 400,
  body: {
    error: {
      code: 400,
      message: 'API key not valid. Please pass a valid API key.',
      status: 'INVALID_ARGUMENT',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'API_KEY_INVALID',
          domain: 'googleapis.com',
          metadata: { service: 'airquality.googleapis.com' },
        },
      ],
    },
  },
};

export {
  silent,
  fakeGladys,
  HOUSE_ID,
  HOME,
  OFFICE,
  universal,
  atmo,
  epa,
  conditions,
  forecast,
  dataPaths,
  fakeFetch,
  keyError,
};
