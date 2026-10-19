// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

import { buildDevice, buildStates, featureSignature } from '../src/device.js';
import { keyFromExternalId } from '../src/places.js';
import { readingOf } from '../src/reading.js';
import { readHour } from '../src/air-quality-api.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, HOME, OFFICE, conditions, epa } from './helpers/fixtures.js';

const ATMO = readingOf(readHour(conditions()));
const EPA = readingOf(readHour(conditions({ local: epa(63) })));
const devices = (language) => [
  buildDevice(fakeGladys, HOME, ATMO, language),
  buildDevice(fakeGladys, OFFICE, EPA, language),
  buildDevice(fakeGladys, { ...OFFICE, id: 'b2c3d4e5' }, null, language),
];

// DEVICE_FEATURE_UNITS_BY_CATEGORY of the Gladys core (server/utils/constants.js,
// master 2026-10-16), and the pairs with an icon in the front
// (front/src/utils/consts.js): airquality-sensor/aqi, pm25-sensor/decimal,
// pm10-sensor/decimal, no2-sensor/decimal, o3-sensor/decimal,
// so2-sensor/decimal, text/text. co-sensor only has `binary` there: CO is
// not a feature.
const UNITS_OF = {
  [CATEGORIES.AIRQUALITY_SENSOR]: [UNITS.AQI],
  [CATEGORIES.PM25_SENSOR]: [UNITS.MICROGRAM_PER_CUBIC_METER],
  [CATEGORIES.PM10_SENSOR]: [UNITS.MICROGRAM_PER_CUBIC_METER],
  [CATEGORIES.NO2_SENSOR]: [UNITS.MICROGRAM_PER_CUBIC_METER],
  [CATEGORIES.O3_SENSOR]: [UNITS.MICROGRAM_PER_CUBIC_METER],
  [CATEGORIES.SO2_SENSOR]: [UNITS.MICROGRAM_PER_CUBIC_METER],
};
const PAIRS = [
  [CATEGORIES.AIRQUALITY_SENSOR, TYPES.AIRQUALITY_SENSOR.AQI],
  [CATEGORIES.PM25_SENSOR, TYPES.SENSOR.DECIMAL],
  [CATEGORIES.PM10_SENSOR, TYPES.SENSOR.DECIMAL],
  [CATEGORIES.NO2_SENSOR, TYPES.SENSOR.DECIMAL],
  [CATEGORIES.O3_SENSOR, TYPES.SENSOR.DECIMAL],
  [CATEGORIES.SO2_SENSOR, TYPES.SENSOR.DECIMAL],
  [CATEGORIES.TEXT, TYPES.TEXT.TEXT],
];

test('devices are never polled by Gladys: the integration has its own clock', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name, feature.external_id);
      }
    }
  }
});

test('every category / type pair has an icon in Gladys, every unit belongs to its category', () => {
  for (const device of devices('en')) {
    for (const feature of device.features) {
      assert.ok(
        PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
        `${feature.external_id}: ${feature.category} / ${feature.type}`,
      );
      if (UNITS_OF[feature.category]) {
        assert.ok(UNITS_OF[feature.category].includes(feature.unit), feature.external_id);
      }
    }
  }
});

test('the local index is a feature only when it is a number (US EPA, not ATMO)', () => {
  const keys = (device) => device.features.map((f) => f.external_id.split(':').pop());
  const [home, office, unread] = devices('fr');
  assert.deepEqual(keys(home), [
    'uaqi',
    'pm25',
    'pm10',
    'no2',
    'o3',
    'so2',
    'category',
    'local_category',
    'dominant_pollutant',
  ]);
  assert.deepEqual(keys(office), [...keys(home).slice(0, 1), 'local_aqi', ...keys(home).slice(1)]);
  assert.deepEqual(keys(unread), keys(home));
  assert.equal(office.features[1].name, 'AQI (US)');
  assert.notEqual(featureSignature(ATMO), featureSignature(EPA));
  assert.equal(featureSignature(null), featureSignature(ATMO));
});

test('external ids come from the id of the house or of the place, never a name', () => {
  const [home, office] = devices('fr');
  assert.equal(home.external_id, `ext:test-integration:house:${HOME.id}`);
  assert.equal(office.external_id, 'ext:test-integration:place:a1b2c3d4');
  assert.equal(keyFromExternalId(home.external_id), HOME.key);
  assert.equal(keyFromExternalId(office.external_id), OFFICE.key);
  assert.equal(keyFromExternalId('ext:x:trip:a1b2c3d4'), null);
  const renamed = buildDevice(fakeGladys, { ...HOME, name: 'Maison', latitude: 1 }, ATMO, 'fr');
  assert.deepEqual(
    renamed.features.map((f) => f.external_id),
    home.features.map((f) => f.external_id),
  );
  assert.equal(home.name, 'Home');
  assert.equal(home.features[0].name, 'Indice universel (UAQI)');
  assert.doesNotMatch(JSON.stringify(home), /45\.76/, 'never the coordinates');
});

test('states: UAQI, µg/m³ with one decimal (gases converted from ppb), texts', () => {
  const byKey = (states) =>
    Object.fromEntries(
      states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    );
  assert.deepEqual(byKey(buildStates(fakeGladys, HOME, ATMO, 'fr')), {
    uaqi: 72,
    pm25: 9.1,
    pm10: 18.4,
    no2: 18.8,
    o3: 58.9,
    so2: 2.6,
    category: 'Bonne qualité de l’air',
    local_category: 'Medium air quality',
    dominant_pollutant: 'NO₂',
  });
  assert.equal(byKey(buildStates(fakeGladys, OFFICE, EPA, 'en')).local_aqi, 63);
  // A pollutant Google does not give stays without a state; a text is never empty.
  const bare = { ...ATMO, pollutants: {}, local: null, dominant: '' };
  const states = byKey(buildStates(fakeGladys, HOME, bare, 'en'));
  assert.equal(states.pm25, undefined);
  assert.equal(states.local_category, '—');
});

test('the whole Discovery batch is accepted by the fake Gladys', async () => {
  const gladys = createFakeGladys();
  await gladys.connect();
  await gladys.publishDiscoveredDevices(devices('es'));
  assert.equal(gladys.fake.discoveredDevices.length, 3);
  await gladys.disconnect?.();
});
