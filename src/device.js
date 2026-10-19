// -----------------------------------------------------------------------------
// One device per place, offered on the Discovery screen, named after the
// place (the house name, or the name typed in "Add a place").
//
// Features (category / type pairs of the SDK constants, with an icon and a
// label in the Gladys front, units from DEVICE_FEATURE_UNITS_BY_CATEGORY of
// the core):
//   - uaqi               airquality-sensor / aqi, 0-100: Universal AQI (higher
//                        is better)
//   - local_aqi          airquality-sensor / aqi, 0-500: the local index —
//                        only when it is a number (not ATMO nor EAQI, which
//                        are categories only: see local_category)
//   - pm25, pm10         pm25-sensor / pm10-sensor, decimal, µg/m³
//   - no2, o3, so2       no2-sensor / o3-sensor / so2-sensor, decimal, µg/m³
//                        (converted from ppb, see reading.js)
//   - category           text / text: the UAQI category, in the language of
//                        the integration
//   - local_category     text / text: the category of the local index (Google's text)
//   - dominant_pollutant text / text: PM2.5, NO₂…
// CO has no concentration category in Gladys (co-sensor is a binary
// detector there): it stays in the widgets and the scene action outputs.
//
// External ids: `house:<id of the house>` or `place:<8 hex digits>`, never a
// name nor coordinates. The readings come from the integration's own clock
// (an hour apart by default): `should_poll` is false.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';
import { pollutantName } from './reading.js';

const sensor = (category, type, unit, max) => ({
  category,
  type,
  unit,
  min: 0,
  max,
  read_only: true,
  has_feedback: false,
  keep_history: true,
});
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  min: 0,
  max: 0,
  read_only: true,
  has_feedback: false,
  keep_history: false,
};
const concentration = (category, max) =>
  sensor(category, TYPES.SENSOR.DECIMAL, UNITS.MICROGRAM_PER_CUBIC_METER, max);
const pollutant = (code) => (reading) => reading.pollutants?.[code] ?? null;
// A text state cannot be empty.
const textOf = (value) => ({ text: value ? String(value).slice(0, 200) : '—' });

const FEATURES = [
  {
    key: 'uaqi',
    name: 'featureUaqi',
    shape: sensor(CATEGORIES.AIRQUALITY_SENSOR, TYPES.AIRQUALITY_SENSOR.AQI, UNITS.AQI, 100),
    when: () => true,
    state: (reading) => reading.uaqi,
  },
  {
    key: 'local_aqi',
    name: 'featureLocalAqi',
    shape: sensor(CATEGORIES.AIRQUALITY_SENSOR, TYPES.AIRQUALITY_SENSOR.AQI, UNITS.AQI, 500),
    when: (reading) => typeof reading?.local?.aqi === 'number',
    state: (reading) => reading.local?.aqi ?? null,
  },
  {
    key: 'pm25',
    name: 'featurePm25',
    shape: concentration(CATEGORIES.PM25_SENSOR, 1000),
    when: () => true,
    state: pollutant('pm25'),
  },
  {
    key: 'pm10',
    name: 'featurePm10',
    shape: concentration(CATEGORIES.PM10_SENSOR, 2000),
    when: () => true,
    state: pollutant('pm10'),
  },
  {
    key: 'no2',
    name: 'featureNo2',
    shape: concentration(CATEGORIES.NO2_SENSOR, 2000),
    when: () => true,
    state: pollutant('no2'),
  },
  {
    key: 'o3',
    name: 'featureO3',
    shape: concentration(CATEGORIES.O3_SENSOR, 2000),
    when: () => true,
    state: pollutant('o3'),
  },
  {
    key: 'so2',
    name: 'featureSo2',
    shape: concentration(CATEGORIES.SO2_SENSOR, 2000),
    when: () => true,
    state: pollutant('so2'),
  },
  {
    key: 'category',
    name: 'featureCategory',
    shape: text,
    when: () => true,
    state: (reading, language) =>
      textOf(reading.level ? t(`level_${reading.level}`, language) : ''),
  },
  {
    key: 'local_category',
    name: 'featureLocalCategory',
    shape: text,
    when: () => true,
    state: (reading) => textOf(reading.local?.category),
  },
  {
    key: 'dominant_pollutant',
    name: 'featureDominant',
    shape: text,
    when: () => true,
    state: (reading) => textOf(pollutantName(reading.dominant)),
  },
];

/**
 * @description The external ids of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - The place (`kind`, `id`).
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, place) => gladys.externalIds(place.kind, place.id);

/**
 * @description The feature specs of a place (the local index is a feature
 * only when the last reading gave it a number).
 * @param {object|null} reading - The last reading.
 * @returns {object[]} The specs.
 */
const specsOf = (reading) => FEATURES.filter((spec) => spec.when(reading));

/**
 * @description The device of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - The place.
 * @param {object|null} reading - Its last reading.
 * @param {string} [language] - Language of the feature names.
 * @returns {object} The discovered device.
 * @example
 * buildDevice(gladys, place, reading, 'fr');
 */
function buildDevice(gladys, place, reading, language = 'en') {
  const ids = idsOf(gladys, place);
  const params = [{ name: 'PLACE', value: t(`kind_${place.kind}`, language) }];
  if (reading?.local?.name) params.push({ name: 'LOCAL_INDEX', value: reading.local.name });
  return {
    name: place.name,
    external_id: ids.device,
    model: 'Google Air Quality',
    should_poll: false,
    params,
    features: specsOf(reading).map((spec) => ({
      name: t(spec.name, language, { index: reading?.local?.name ?? '' }).trim(),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a place from a reading (the values the reading
 * has: a pollutant Google does not give at this place stays without state).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - The place.
 * @param {object} reading - The reading.
 * @param {string} language - Language of the texts.
 * @returns {object[]} The states.
 */
function buildStates(gladys, place, reading, language = 'en') {
  const ids = idsOf(gladys, place);
  return specsOf(reading).flatMap((spec) => {
    const value = spec.state(reading, language);
    const id = ids.feature(spec.key);
    if (value === null || value === undefined) return [];
    return typeof value === 'object'
      ? [{ device_feature_external_id: id, text: value.text }]
      : [{ device_feature_external_id: id, state: value }];
  });
}

/**
 * @description The feature keys of a place, to tell whether a reading
 * changed them (the device must then be offered again).
 * @param {object|null} reading - The reading.
 * @returns {string} The keys.
 */
const featureSignature = (reading) =>
  specsOf(reading)
    .map((spec) => spec.key)
    .join(',');

export { FEATURES, idsOf, specsOf, buildDevice, buildStates, featureSignature };
