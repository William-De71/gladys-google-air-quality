// The integration end to end, against the fake Gladys of the SDK and a fake
// fetch of the Air Quality API: the houses and the added places, the
// Discovery list, the clock (intervals, restart, budget), the errors
// (refused key, 429), the scene triggers and actions, the widgets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createApp, ACTIONS } from '../src/app.js';
import { TRIGGERS } from '../src/events.js';
import {
  dataPaths,
  fakeFetch,
  conditions,
  keyError,
  silent,
  HOUSE_ID,
  epa,
} from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const outputsOf = (key) =>
  manifest.scene_actions.find((a) => a.key === key).outputs.map((o) => o.key);
const variablesOf = (key) =>
  manifest.scene_triggers.find((t) => t.key === key).variables.map((v) => v.key);

const HOUSE = { id: HOUSE_ID, name: 'Home', selector: 'home', latitude: 45.764, longitude: 4.8357 };
const DEVICE = `ext:test-integration:house:${HOUSE_ID}`;

/**
 * @description A started integration on a controllable clock.
 * @param {object} [options] - Options.
 * @returns {Promise<object>} `{ gladys, app, clock, fetchImpl, paths }`.
 */
async function start({
  at = '2026-10-19T05:30:00Z',
  config = {},
  houses = [HOUSE],
  replies,
  paths = dataPaths(),
  fetchImpl = fakeFetch(replies),
} = {}) {
  const clock = { now: new Date(at) };
  const gladys = createFakeGladys({
    config: { language: 'en', api_key: 'AIzaTEST', ...config },
    houses,
  });
  let n = 0;
  const app = createApp(gladys, {
    now: () => clock.now,
    timezone: 'Europe/Paris',
    fetchImpl,
    statePath: paths.state,
    usagePath: paths.usage,
    sleep: async () => {},
    newId: () => `e000000${(n += 1)}`.slice(-8),
    tickMs: 0,
    logger: silent,
  });
  await gladys.connect();
  return { gladys, app, clock, fetchImpl, paths };
}

const ok = (ack) => {
  assert.equal(ack.success, true, ack.error);
  return ack.data.message ?? ack.data.content ?? ack.data.outputs;
};
const later = (clock, minutes) => {
  clock.now = new Date(clock.now.getTime() + minutes * 60000);
};
const create = async (gladys) => {
  for (const device of gladys.fake.discoveredDevices) await gladys.fake.deviceCreated(device);
};
const current = (fetchImpl) =>
  fetchImpl.calls.filter((c) => c.url.endsWith('currentConditions:lookup'));
const forecasts = (fetchImpl) => fetchImpl.calls.filter((c) => c.url.endsWith('forecast:lookup'));
const valid = (content) => {
  assert.deepEqual(validateWidgetContent(content), []);
  return content;
};

test('no key: the status says what to do, and nothing goes out', async () => {
  const { gladys, app, fetchImpl } = await start({ config: { api_key: '' } });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /clé d’API Google Maps Platform/);
  await app.tick();
  assert.equal(fetchImpl.calls.length, 0);
  const widget = ok(await gladys.fake.widgetGet('air_quality', { settings: { place: DEVICE } }));
  assert.match(widget.components[0].text, /API key/);
});

test('a located house: read at once, offered on Discovery, states once the device exists', async () => {
  const { gladys, fetchImpl } = await start();
  assert.equal(current(fetchImpl).length, 1);
  assert.equal(forecasts(fetchImpl).length, 1);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.name),
    ['Home'],
  );
  assert.equal(gladys.fake.states.length, 0, 'no device yet');
  await create(gladys);
  assert.equal(gladys.fake.lastState(`${DEVICE}:uaqi`), 72);
  assert.equal(gladys.fake.lastState(`${DEVICE}:no2`), 18.8);
  assert.equal(gladys.fake.lastState(`${DEVICE}:category`), 'Good air quality');
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /1 place\(s\)\. This month: 2 \/ 9,000 requests \(≈ 868 planned\)/,
  );
});

test('an unlocated house is not a place; "Add a place" adds one, "Remove" removes it', async () => {
  const { gladys, fetchImpl } = await start({
    houses: [{ ...HOUSE, latitude: null, longitude: null }],
  });
  assert.match(gladys.fake.connectionStatus.message.en, /No place yet/);
  assert.equal(fetchImpl.calls.length, 0);
  const message = ok(
    await gladys.fake.action(ACTIONS.ADD, { name: 'Office', coordinates: '45.75, 4.85' }),
  );
  assert.match(
    message.en,
    /^Added: #1 Office \(Added place\) — Office: good air quality \(UAQI 72\)/,
  );
  assert.match(message.fr, /onglet Découverte/);
  assert.equal(gladys.fake.config.places.length, 1);
  assert.equal(current(fetchImpl).length, 1);
  const refused = await gladys.fake.action(ACTIONS.ADD, { name: 'X', coordinates: 'Lyon' });
  assert.equal(refused.success, false);
  assert.match(refused.error, /latitude, longitude/);
  const list = ok(await gladys.fake.action(ACTIONS.LIST));
  assert.match(list.en, /1 place\(s\)\. A reading every 60 min, a forecast every 6 h\./);
  assert.match(list.en, /No house of Gladys has a location/);
  ok(await gladys.fake.action(ACTIONS.REMOVE, { place: 'office' }));
  assert.equal(gladys.fake.config.places.length, 0);
  assert.equal(gladys.fake.discoveredDevices.length, 0);
});

test('the clock: a reading each interval, a forecast each 6 h, nothing more after a restart', async () => {
  const paths = dataPaths();
  const { app, clock, fetchImpl } = await start({ paths });
  later(clock, 30);
  await app.tick();
  assert.equal(current(fetchImpl).length, 1);
  later(clock, 31);
  await app.tick();
  assert.equal(current(fetchImpl).length, 2);
  assert.equal(forecasts(fetchImpl).length, 1);
  later(clock, 5 * 60);
  await app.tick();
  assert.equal(forecasts(fetchImpl).length, 2);
  const restarted = await start({ paths, at: clock.now.toISOString() });
  assert.equal(restarted.fetchImpl.calls.length, 0, 'a restart reads nothing early');
  app.stop();
});

test('the budget stretches the intervals to fit the month', async () => {
  // 1 % of 10,000 = 100 requests: one place every hour would need 744.
  const { gladys, app, clock, fetchImpl } = await start({
    at: '2026-10-01T00:00:00Z',
    config: { budget_percent: 1, forecast_hours: 0 },
  });
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /To stay within the budget: a reading every 447 min/,
  );
  while (clock.now < new Date('2026-10-31T23:30:00Z')) {
    later(clock, 30);
    await app.tick();
  }
  assert.ok(current(fetchImpl).length <= 100, String(current(fetchImpl).length));
  assert.ok(current(fetchImpl).length >= 95, String(current(fetchImpl).length));
});

test('a spent budget stops the requests and fires its alerts once a month', async () => {
  const paths = dataPaths();
  writeFileSync(paths.usage, JSON.stringify({ month: '2026-10', calls: 78 }));
  const { gladys, app, clock, fetchImpl } = await start({
    paths,
    config: { budget_percent: 1 },
  });
  // A reading and a forecast: 80 of 100.
  let alerts = gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.BUDGET_ALERT);
  assert.deepEqual(
    alerts.map((e) => e.data.level),
    ['warning'],
  );
  assert.deepEqual(Object.keys(alerts[0].data).sort(), [...variablesOf('budget_alert')].sort());
  writeFileSync(paths.usage, JSON.stringify({ month: '2026-10', calls: 100 }));
  const again = await start({ paths, config: { budget_percent: 1 }, at: clock.now.toISOString() });
  later(again.clock, 24 * 60);
  await again.app.tick();
  assert.equal(again.fetchImpl.calls.length, 0, 'nothing goes out');
  alerts = again.gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.BUDGET_ALERT);
  assert.deepEqual(
    alerts.map((e) => e.data.level),
    ['exhausted'],
  );
  assert.equal(fetchImpl.calls.length, 2);
  app.stop();
});

test('category changes fire one event per index, never at the first reading', async () => {
  let aqi = 72;
  let category = 'Medium air quality';
  const fetchImpl = fakeFetch((request) =>
    request.url.endsWith('forecast:lookup')
      ? { status: 200, body: { hourlyForecasts: [] } }
      : {
          status: 200,
          body: conditions({
            aqi,
            local: {
              ...epa(0),
              code: 'fra_atmo',
              aqi: undefined,
              aqiDisplay: undefined,
              displayName: 'IQA (FR)',
              category,
            },
          }),
        },
  );
  const { gladys, app, clock } = await start({ fetchImpl });
  assert.equal(gladys.fake.sceneEvents.length, 0);
  later(clock, 61);
  await app.tick();
  assert.equal(gladys.fake.sceneEvents.length, 0, 'same categories');
  aqi = 35;
  category = 'Degraded air quality';
  later(clock, 61);
  await app.tick();
  const events = gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.CATEGORY_CHANGED);
  assert.deepEqual(
    events.map((e) => [e.data.index, e.data.level, e.data.category, e.data.previous_category]),
    [
      ['universal', 'low', 'Low air quality', 'Good air quality'],
      ['local', '', 'Degraded air quality', 'Medium air quality'],
    ],
  );
  assert.equal(events[0].data.place, DEVICE);
  for (const event of events) {
    assert.deepEqual(
      Object.keys(event.data)
        .filter((k) => k !== 'place')
        .sort(),
      [...variablesOf('category_changed')].sort(),
    );
    for (const value of Object.values(event.data)) {
      assert.ok(['string', 'number'].includes(typeof value) || value === null);
    }
  }
  assert.match(
    events[0].data.summary,
    /^Home: UAQI goes from good air quality to low air quality\.$/,
  );
});

test('a refused key: status, one event, the round stops, tried again an hour later', async () => {
  const { gladys, app, clock, fetchImpl } = await start({ replies: [keyError] });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /API_KEY_INVALID\)\. Check the key/);
  assert.equal(fetchImpl.calls.length, 1, 'the round stops at the first refusal');
  const events = gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.API_KEY_REFUSED);
  assert.equal(events.length, 1);
  assert.deepEqual(Object.keys(events[0].data).sort(), variablesOf('api_key_refused').sort());
  later(clock, 30);
  await app.tick();
  assert.equal(fetchImpl.calls.length, 1);
  later(clock, 31);
  await app.tick();
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.API_KEY_REFUSED).length, 1);
});

test('a 429 pauses every request for 15 minutes', async () => {
  const { app, clock, fetchImpl } = await start({
    replies: [{ status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED' } } }],
  });
  assert.equal(fetchImpl.calls.length, 1);
  later(clock, 10);
  await app.tick();
  assert.equal(fetchImpl.calls.length, 1);
  later(clock, 6);
  await app.tick();
  assert.equal(fetchImpl.calls.length, 2);
});

test('scene action get_air_quality: the stored reading, or a request when asked', async () => {
  const { gladys, clock, fetchImpl } = await start();
  const outputs = ok(await gladys.fake.sceneAction('get_air_quality', { place: DEVICE }));
  assert.equal(current(fetchImpl).length, 1, 'the reading is fresh');
  for (const key of Object.keys(outputs))
    assert.ok(outputsOf('get_air_quality').includes(key), key);
  assert.equal(outputs.uaqi, 72);
  assert.equal(outputs.co, 287);
  assert.equal(outputs.local_category, 'Medium air quality');
  assert.match(
    outputs.summary,
    /^Home: good air quality \(UAQI 72\), IQA \(FR\): Medium air quality, mainly NO₂, PM2\.5 9\.1 µg\/m³\.$/,
  );
  later(clock, 2);
  ok(await gladys.fake.sceneAction('get_air_quality', { place: DEVICE, refresh: true }));
  assert.equal(current(fetchImpl).length, 2);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'never an event from an action');
  const unknown = await gladys.fake.sceneAction('get_air_quality', {
    place: 'ext:test-integration:place:ffffffff',
  });
  assert.equal(unknown.success, false);
});

test('scene action get_forecast: the worst hour of the horizon, in the time of Gladys', async () => {
  const { gladys, fetchImpl } = await start();
  const outputs = ok(await gladys.fake.sceneAction('get_forecast', { place: DEVICE, hours: 12 }));
  assert.equal(forecasts(fetchImpl).length, 1, 'the stored forecast');
  assert.deepEqual(Object.keys(outputs).sort(), outputsOf('get_forecast').sort());
  // The default forecast dips at its 10th hour: 15:00 UTC, 17:00 in Paris.
  assert.deepEqual(
    [outputs.worst_uaqi, outputs.worst_level, outputs.worst_time],
    [35, 'low', '17:00'],
  );
  const short = ok(await gladys.fake.sceneAction('get_forecast', { place: DEVICE, hours: 3 }));
  assert.equal(short.worst_uaqi, 70);
});

test('widgets: valid contents in every language, the place of the settings', async () => {
  const { gladys } = await start();
  for (const language of ['en', 'fr', 'de', 'es']) {
    const air = valid(
      ok(await gladys.fake.widgetGet('air_quality', { settings: { place: DEVICE }, language })),
    );
    assert.ok(air.components.length <= 8);
    const forecast = valid(
      ok(await gladys.fake.widgetGet('forecast', { settings: { place: DEVICE }, language })),
    );
    assert.equal(forecast.components[1].type, 'chart');
    valid(ok(await gladys.fake.widgetGet('budget', { language })));
  }
  const choose = ok(await gladys.fake.widgetGet('air_quality', { settings: {}, language: 'fr' }));
  assert.match(choose.components[0].text, /Choisissez un lieu/);
});

test('the local index tile appears when the index is a number', async () => {
  const { gladys } = await start({
    replies: [{ status: 200, body: conditions({ local: epa(63) }) }],
  });
  const air = valid(
    ok(await gladys.fake.widgetGet('air_quality', { settings: { place: DEVICE } })),
  );
  const labels = air.components.filter((c) => c.type === 'value').map((c) => c.label);
  assert.deepEqual(labels, ['AQI (US)', 'PM2.5', 'NO₂', 'O₃']);
  assert.ok(
    gladys.fake.discoveredDevices[0].features.some((f) => f.external_id.endsWith(':local_aqi')),
  );
});

test('test the API key: one request, the answer in every language', async () => {
  const { gladys, fetchImpl } = await start({ houses: [] });
  const message = ok(await gladys.fake.action(ACTIONS.TEST_KEY));
  assert.match(message.en, /^The key works\. Paris: good air quality \(UAQI 72\)/);
  assert.equal(fetchImpl.calls[0].json.location.latitude, 48.8566);
  const refused = await (
    await start({ houses: [], replies: [keyError] })
  ).gladys.fake.action(ACTIONS.TEST_KEY);
  assert.equal(refused.success, false);
});
