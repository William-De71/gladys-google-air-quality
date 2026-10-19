// The places: coordinates typed by users, the registry stored with
// setConfig, the houses of Gladys.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCoordinates,
  parseRegistry,
  placeOfHouse,
  createRegistry,
  RegistryError,
  MAX_PLACES,
} from '../src/places.js';
import { silent } from './helpers/fixtures.js';

test('coordinates: the usual ways of typing them, and nothing else', () => {
  const at = { latitude: 45.764, longitude: 4.8357 };
  for (const text of [
    '45.764, 4.8357',
    '45.764 4.8357',
    ' 45.764;4.8357 ',
    '45,764 4,8357',
    '45,764; 4,8357',
  ]) {
    assert.deepEqual(parseCoordinates(text), at, text);
  }
  assert.deepEqual(parseCoordinates('-33.8688, 151.2093'), {
    latitude: -33.8688,
    longitude: 151.2093,
  });
  for (const text of ['', 'Lyon', '91, 0', '0, 181', '45.7,4.8,3', '45,764,4,8357', null]) {
    assert.equal(parseCoordinates(text), null, String(text));
  }
});

test('the houses of Gladys: only the located ones, keyed by their id', () => {
  const house = {
    id: 'b9f0c1d2-0000-4000-8000-000000000001',
    name: ' Maison ',
    selector: 'maison',
  };
  assert.equal(placeOfHouse({ ...house, latitude: null, longitude: null }), null);
  assert.deepEqual(placeOfHouse({ ...house, latitude: 45.7, longitude: 4.8 }), {
    key: `house:${house.id}`,
    kind: 'house',
    id: house.id,
    name: 'Maison',
    latitude: 45.7,
    longitude: 4.8,
  });
  assert.equal(placeOfHouse({ id: 'a b', latitude: 1, longitude: 1 }), null);
});

test('the registry: added in Gladys first, found by number or name, removed', async () => {
  const saved = [];
  const gladys = { setConfig: async (values) => saved.push(values) };
  let n = 0;
  const registry = createRegistry(gladys, { newId: () => `0000000${(n += 1)}`, logger: silent });
  const office = await registry.add({ name: ' Office ', coordinates: '45.75, 4.85' });
  assert.equal(office.key, 'place:00000001');
  await registry.add({ name: 'School', coordinates: '45.76 4.84' });
  assert.deepEqual(
    saved.at(-1).places.map((place) => place.name),
    ['Office', 'School'],
  );
  assert.equal(registry.find('#2').name, 'School');
  assert.equal(registry.find('office').id, '00000001');
  await assert.rejects(registry.add({ name: 'X', coordinates: 'Lyon' }), RegistryError);
  await assert.rejects(registry.add({ name: '', coordinates: '1, 1' }), RegistryError);
  await assert.rejects(registry.remove('#9'), (err) => err.key === 'errorNotFound');
  await registry.add({ name: 'School', coordinates: '1, 1' });
  assert.throws(
    () => registry.find('School'),
    (err) => err.key === 'errorAmbiguous',
  );
  const removed = await registry.remove('#1');
  assert.equal(removed.name, 'Office');
  assert.equal(registry.list().length, 2);
});

test('a refused save changes nothing; the stored registry is checked', async () => {
  const registry = createRegistry(
    { setConfig: async () => Promise.reject(new Error('down')) },
    { logger: silent },
  );
  await assert.rejects(registry.add({ name: 'A', coordinates: '1, 1' }), /down/);
  assert.equal(registry.list().length, 0);
  const stored = [
    { id: 'a1b2c3d4', name: 'Ok', latitude: 1, longitude: 2 },
    { id: 'a1b2c3d4', name: 'Duplicate', latitude: 1, longitude: 2 },
    { id: 'nope', name: 'Bad id', latitude: 1, longitude: 2 },
    { id: 'b1b2c3d4', name: 'Bad latitude', latitude: 100, longitude: 2 },
  ];
  assert.deepEqual(
    parseRegistry(JSON.stringify(stored), silent).map((place) => place.name),
    ['Ok'],
  );
  assert.deepEqual(parseRegistry('{', silent), []);
  const many = Array.from({ length: MAX_PLACES + 3 }, (_, i) => ({
    id: i.toString(16).padStart(8, '0'),
    name: `P${i}`,
    latitude: 1,
    longitude: 1,
  }));
  assert.equal(parseRegistry(many, silent).length, MAX_PLACES);
});
