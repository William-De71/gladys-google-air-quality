// -----------------------------------------------------------------------------
// What survives a restart, in /data/state.json: the last reading and the
// last forecast of each place (so the widgets and the scene variables are
// right at once, and a restart does not spend a request per place), the
// time of their last request (so a restart never reads a place faster than
// its interval), the last error, the pause after a 429, and the scene events
// already fired (a budget alert once a month, a refused key once until it
// works again).
//
// Never the coordinates nor the key: only readings, times and error reasons.
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/state.json';

/**
 * @description Create the state store.
 * @param {object} options - Options.
 * @param {string|null} options.path - The JSON file (null: memory only).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The store.
 */
function createState({ path, logger = console }) {
  let state = { places: {}, pausedUntil: 0, flags: {} };
  if (path) {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8'));
      if (stored && typeof stored.places === 'object' && stored.places !== null) {
        state = {
          places: stored.places,
          pausedUntil: Number.isFinite(stored.pausedUntil) ? stored.pausedUntil : 0,
          flags: stored.flags && typeof stored.flags === 'object' ? stored.flags : {},
        };
      }
    } catch {
      // No file yet (first start) or unreadable: start empty.
    }
  }

  const save = () => {
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state));
    } catch (err) {
      logger.warn(`Unable to store the state: ${err.message}`);
    }
  };

  const of = (id) => {
    if (!state.places[id]) {
      state.places[id] = {
        at: 0,
        attempt: 0,
        reading: null,
        error: null,
        forecastAt: 0,
        forecastAttempt: 0,
        forecast: null,
      };
    }
    return state.places[id];
  };

  return {
    /**
     * @param {string} id - Place key.
     * @returns {object|null} `{ at, attempt, reading, error, forecastAt, forecastAttempt, forecast }`.
     */
    get: (id) => state.places[id] ?? null,

    /**
     * @description A successful reading.
     * @param {string} id - Place key.
     * @param {object} reading - The reading.
     * @param {number} at - Its time, in ms.
     */
    reading(id, reading, at) {
      Object.assign(of(id), { at, attempt: at, reading, error: null });
      save();
    },

    /**
     * @description A failed request of a place (the reading is kept).
     * @param {string} id - Place key.
     * @param {{ reason: string|null, message: string }} error - The error.
     * @param {number} at - Its time, in ms.
     */
    failure(id, error, at) {
      Object.assign(of(id), { attempt: at, error: { ...error, at } });
      save();
    },

    /**
     * @description A successful forecast.
     * @param {string} id - Place key.
     * @param {object[]} hours - The hours.
     * @param {number} at - Its time, in ms.
     */
    forecast(id, hours, at) {
      Object.assign(of(id), { forecastAt: at, forecastAttempt: at, forecast: hours });
      save();
    },

    /**
     * @description A failed forecast request (the last forecast is kept).
     * @param {string} id - Place key.
     * @param {number} at - Its time, in ms.
     */
    forecastFailure(id, at) {
      of(id).forecastAttempt = at;
      save();
    },

    /** @param {string[]} ids - The places still followed: forget the others. */
    keep(ids) {
      const wanted = new Set(ids);
      let changed = false;
      Object.keys(state.places).forEach((id) => {
        if (!wanted.has(id)) {
          delete state.places[id];
          changed = true;
        }
      });
      if (changed) save();
    },

    /** @returns {number} End of the pause after a 429, in ms (0: none). */
    pausedUntil: () => state.pausedUntil,

    /** @param {number} until - End of the pause, in ms. */
    pause(until) {
      state.pausedUntil = until;
      save();
    },

    /** @param {string} key - A flag. @returns {boolean} Whether it is set. */
    flag: (key) => state.flags[key] === true,

    /**
     * @description Set or clear a flag (only the set ones are kept).
     * @param {string} key - The flag.
     * @param {boolean} value - Its value.
     */
    setFlag(key, value) {
      if ((state.flags[key] === true) === value) return;
      if (value) state.flags[key] = true;
      else delete state.flags[key];
      save();
    },
  };
}

export { DEFAULT_PATH, createState };
