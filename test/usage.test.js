// The monthly counter of billable requests, kept across restarts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createUsage, budgetOf } from '../src/usage.js';
import { dataPaths, silent } from './helpers/fixtures.js';

test('budget: a share of the 10,000 free requests a month', () => {
  assert.equal(budgetOf(90), 9000);
  assert.equal(budgetOf(200), 20000);
  assert.equal(budgetOf(0.001), 1);
});

test('counts, survives a restart, starts again each month', () => {
  const { usage: path } = dataPaths();
  let time = Date.parse('2026-10-31T23:00:00Z');
  const make = () => createUsage({ path, getPercent: () => 90, now: () => time, logger: silent });
  const first = make();
  first.record();
  first.record();
  const again = make();
  assert.equal(again.used(), 2);
  assert.equal(again.remaining(), 8998);
  assert.equal(again.exhausted(), false);
  time = Date.parse('2026-11-01T00:00:01Z');
  assert.equal(again.used(), 0);
  assert.equal(again.month(), '2026-11');
});

test('an unreadable file starts from zero; a spent budget is exhausted', () => {
  const { usage: path } = dataPaths();
  writeFileSync(path, '{ nope');
  const usage = createUsage({ path, getPercent: () => 0.01, logger: silent });
  assert.equal(usage.used(), 0);
  usage.record();
  assert.equal(usage.exhausted(), true);
});
