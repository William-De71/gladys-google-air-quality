// -----------------------------------------------------------------------------
// The places whose air quality is followed.
//
//   - the houses of Gladys that have a location (`location: true` in the
//     manifest, GET /house), when `use_houses` is on: nothing to type;
//   - the places the user adds with the configuration buttons ("Add a
//     place": a name and "latitude, longitude"), for a workplace, a school, a
//     holiday home.
//
// The added places are stored through setConfig() under
// INTERNAL_KEYS.registry, a key outside the config_schema: they live in the
// Gladys database and follow its backups (/data does not). A change is
// applied in memory only once Gladys saved it, and changes run one after the
// other: two quick buttons never lose a place.
//
// Every place has a key that builds the external ids of its device, kept for
// ever: `house:<id of the house in Gladys>` or `place:<8 hex digits given at
// creation>` — never a name nor coordinates. The coordinates are never logged.
// -----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { INTERNAL_KEYS } from './config.js';

// Far beyond a household: 20 places read every hour would spend the budget.
const MAX_PLACES = 20;
const NAME_MAX = 60;
const ID_PATTERN = /^[0-9a-f]{8}$/;
const HOUSE_ID_PATTERN = /^[0-9A-Za-z-]{1,64}$/;

class RegistryError extends Error {
  /**
   * @param {string} key - The TEXTS key of the message.
   * @param {object} [params] - Its substitutions.
   */
  constructor(key, params = {}) {
    super(key);
    this.key = key;
    this.params = params;
  }
}

const clean = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const validLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90;
const validLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180;

/**
 * @description Read "latitude, longitude" as typed by a user: "48.8584, 2.2945",
 * "48.8584 2.2945", "48.8584;2.2945" or, with decimal commas, "48,8584 2,2945".
 * @param {unknown} raw - The typed text.
 * @returns {{ latitude: number, longitude: number }|null} The coordinates, null when unreadable.
 * @example
 * parseCoordinates('45.7640, 4.8357'); // -> { latitude: 45.764, longitude: 4.8357 }
 */
function parseCoordinates(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const dotted = /^(-?\d{1,3}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(text);
  const comma = /^(-?\d{1,3},\d+)\s*[; ]\s*(-?\d{1,3},\d+)$/.exec(text);
  const match = dotted ?? comma;
  if (!match) return null;
  const latitude = Number(match[1].replace(',', '.'));
  const longitude = Number(match[2].replace(',', '.'));
  if (!validLatitude(latitude) || !validLongitude(longitude)) return null;
  return { latitude, longitude };
}

/**
 * @description Check an added place and return its normalized form.
 * @param {object} place - The candidate.
 * @returns {object} `{ id, name, latitude, longitude }`.
 * @throws {RegistryError} When a field is invalid.
 */
function validatePlace(place) {
  const name = clean(place.name);
  if (name.length === 0 || name.length > NAME_MAX) {
    throw new RegistryError('errorName', { max: NAME_MAX });
  }
  if (!validLatitude(place.latitude) || !validLongitude(place.longitude)) {
    throw new RegistryError('errorCoordinates');
  }
  return { id: place.id, name, latitude: place.latitude, longitude: place.longitude };
}

/**
 * @description Read the stored registry, dropping what is not a valid place.
 * @param {*} stored - The stored value (an array, or its JSON).
 * @param {object} [logger] - Logger.
 * @returns {object[]} The places.
 */
function parseRegistry(stored, logger) {
  let list = stored;
  if (typeof stored === 'string') {
    try {
      list = JSON.parse(stored);
    } catch {
      logger?.warn('Air quality: the stored places are not valid JSON, ignored');
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const places = [];
  for (const raw of list) {
    try {
      if (!raw || !ID_PATTERN.test(raw.id) || seen.has(raw.id)) {
        throw new RegistryError('invalid');
      }
      places.push(validatePlace(raw));
      seen.add(raw.id);
    } catch {
      logger?.warn(`Air quality: stored place ignored (${String(raw?.name ?? '?').slice(0, 60)})`);
    }
  }
  return places.slice(0, MAX_PLACES);
}

/**
 * @description The followed place of a house of Gladys.
 * @param {object} house - `{ id, name, latitude, longitude }` from GET /house.
 * @returns {object|null} The place, null when the house has no location.
 */
function placeOfHouse(house) {
  if (!house || !HOUSE_ID_PATTERN.test(String(house.id ?? ''))) return null;
  if (!validLatitude(house.latitude) || !validLongitude(house.longitude)) return null;
  return {
    key: `house:${house.id}`,
    kind: 'house',
    id: String(house.id),
    name: clean(house.name) || 'Gladys',
    latitude: house.latitude,
    longitude: house.longitude,
  };
}

/**
 * @description The followed place of an added place.
 * @param {object} place - `{ id, name, latitude, longitude }`.
 * @returns {object} The place.
 */
const placeOfEntry = (place) => ({ key: `place:${place.id}`, kind: 'place', ...place });

/**
 * @description The key of a place from a device external id.
 * @param {string} externalId - `ext:<selector>:house:<id>` or `ext:<selector>:place:<id>`.
 * @returns {string|null} `house:<id>` or `place:<id>`.
 * @example
 * keyFromExternalId('ext:google-air-quality:place:a1b2c3d4'); // -> 'place:a1b2c3d4'
 */
function keyFromExternalId(externalId) {
  const match = /:(house|place):([0-9A-Za-z-]{1,64})$/.exec(String(externalId ?? ''));
  return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * @description The registry of the added places.
 * @param {object} gladys - SDK client (setConfig).
 * @param {object} [options] - Options.
 * @param {object} [options.logger] - Logger.
 * @param {Function} [options.newId] - `() => string`, 8 hex digits (tests).
 * @returns {object} The registry.
 */
function createRegistry(gladys, { logger, newId = () => randomBytes(4).toString('hex') } = {}) {
  let places = [];
  let writing = Promise.resolve();

  // One change at a time, computed from the previous one once it is saved.
  const serial = (change) => {
    const run = writing.then(async () => {
      const { next, result } = change(places);
      await gladys.setConfig({ [INTERNAL_KEYS.registry]: next });
      places = next;
      return result;
    });
    writing = run.catch(() => {});
    return run;
  };

  const registry = {
    /** @param {object} config - `gladys.config`. @returns {object[]} The places. */
    load(config) {
      places = parseRegistry(config?.[INTERNAL_KEYS.registry], logger);
      return places;
    },

    /** @returns {object[]} The added places, as followed places. */
    list: () => places.map(placeOfEntry),

    /**
     * @description Find an added place by its number in the list (#2 or 2),
     * its name (any case) or its identifier.
     * @param {string} query - What the user typed.
     * @returns {object} The place.
     * @throws {RegistryError} When none or several match.
     */
    find(query) {
      const value = String(query ?? '').trim();
      if (!value) throw new RegistryError('errorTarget');
      const number = /^#?(\d{1,3})$/.exec(value);
      if (number) {
        const place = places[Number(number[1]) - 1];
        if (place) return place;
      }
      const lower = value.toLocaleLowerCase();
      const byName = places.filter((place) => place.name.toLocaleLowerCase() === lower);
      if (byName.length === 1) return byName[0];
      if (byName.length > 1) {
        throw new RegistryError('errorAmbiguous', {
          query: value,
          numbers: byName.map((place) => `#${places.indexOf(place) + 1}`).join(', '),
        });
      }
      const byId = places.find((place) => place.id === lower);
      if (byId) return byId;
      throw new RegistryError('errorNotFound', { query: value });
    },

    /** @param {object} place - An added place. @returns {number} Its number (1…). */
    numberOf: (place) => places.findIndex((other) => other.id === place.id) + 1,

    /**
     * @description Add a place from the "Add a place" form.
     * @param {object} fields - `{ name, coordinates }`.
     * @returns {Promise<object>} The new place (followed form).
     */
    add(fields) {
      return serial((current) => {
        if (current.length >= MAX_PLACES) {
          throw new RegistryError('errorFull', { max: MAX_PLACES });
        }
        const coordinates = parseCoordinates(fields.coordinates);
        if (coordinates === null) throw new RegistryError('errorCoordinates');
        let id = newId();
        while (current.some((place) => place.id === id)) id = newId();
        const place = validatePlace({ id, name: fields.name, ...coordinates });
        return { next: [...current, place], result: placeOfEntry(place) };
      });
    },

    /**
     * @description Remove an added place.
     * @param {string} query - Its number, name or identifier.
     * @returns {Promise<object>} The removed place (followed form).
     */
    remove(query) {
      return serial((current) => {
        const place = registry.find(query);
        return {
          next: current.filter((other) => other.id !== place.id),
          result: placeOfEntry(place),
        };
      });
    },
  };
  return registry;
}

export {
  MAX_PLACES,
  NAME_MAX,
  RegistryError,
  parseCoordinates,
  validatePlace,
  parseRegistry,
  placeOfHouse,
  placeOfEntry,
  keyFromExternalId,
  createRegistry,
};
