// -----------------------------------------------------------------------------
// Monthly counter of the billable Air Quality API requests.
//
// Google bills every SUCCESSFUL request (a current-conditions request, or one
// page of a forecast) under one SKU, "Air Quality Usage", with 10,000 free
// billable events per month. This counter is the integration's own safety
// net: once the budget is reached in a calendar month, no more request goes
// out until the next month (the last readings stay shown).
//
// The budget is `budget_percent` % of the free usage (90 % by default, under
// the free tier). The count lives in /data/usage.json so that a restart does
// not reset it. It is an estimate: the month is the UTC calendar month, and
// Google's own count (Cloud console → Google Maps Platform → Metrics) is the
// reference — hence a default kept below 100 %. The free usage is per billing
// account: other uses of the account (another Gladys, another app) count too.
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const FREE_USAGE = 10000;

/**
 * @description The UTC calendar month of an instant.
 * @param {number} instant - The instant in ms.
 * @returns {string} "YYYY-MM".
 * @example
 * monthOf(Date.parse('2026-10-17T08:00:00Z')); // -> '2026-10'
 */
function monthOf(instant) {
  return new Date(instant).toISOString().slice(0, 7);
}

/**
 * @description The monthly budget for a share of the free usage.
 * @param {number} percent - The share, in %.
 * @returns {number} Requests a month, at least 1.
 * @example
 * budgetOf(90); // -> 9000
 */
function budgetOf(percent) {
  return Math.max(1, Math.floor((FREE_USAGE * percent) / 100));
}

/**
 * @description Create the usage counter.
 * @param {object} options - Options.
 * @param {string|null} options.path - The JSON file (null: memory only).
 * @param {Function} options.getPercent - `() => number`, read on every check.
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The counter.
 * @example
 * const usage = createUsage({ path: '/data/usage.json', getPercent: () => 90 });
 */
function createUsage({ path, getPercent, now = () => Date.now(), logger = console }) {
  let state = { month: monthOf(now()), calls: 0 };
  if (path) {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8'));
      if (typeof stored?.month === 'string' && Number.isInteger(stored?.calls)) {
        state = { month: stored.month, calls: Math.max(0, stored.calls) };
      }
    } catch {
      // No file yet (first start) or unreadable: start from zero.
    }
  }

  const rollOver = () => {
    const month = monthOf(now());
    if (month !== state.month) {
      state = { month, calls: 0 };
    }
  };

  const save = () => {
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state));
    } catch (err) {
      logger.warn(`Unable to store the API usage counter: ${err.message}`);
    }
  };

  const usage = {
    /** @returns {number} The requests of the current month. */
    used() {
      rollOver();
      return state.calls;
    },
    /** @returns {number} The monthly budget. */
    budget: () => budgetOf(getPercent()),
    /** @returns {number} The requests left this month. */
    remaining: () => Math.max(0, usage.budget() - usage.used()),
    /** @returns {boolean} Whether the budget is spent. */
    exhausted: () => usage.used() >= usage.budget(),
    /** @returns {string} The current month, "YYYY-MM". */
    month() {
      rollOver();
      return state.month;
    },
    /** Count one successful (billable) request. */
    record() {
      rollOver();
      state.calls += 1;
      save();
    },
  };
  return usage;
}

export { FREE_USAGE, monthOf, budgetOf, createUsage };
