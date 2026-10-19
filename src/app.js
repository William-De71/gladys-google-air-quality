// -----------------------------------------------------------------------------
// The Google Air Quality integration: every handler, registered on a Gladys
// client.
//
//   - the places: the located houses of Gladys (`location: true`) and the
//     places added with the configuration buttons (places.js);
//   - one device per place (device.js): Universal AQI, local index, PM2.5,
//     PM10, NO₂, O₃, SO₂, categories, dominant pollutant;
//   - the integration's own clock reads the current conditions of each place
//     at its interval, and its 48-hour forecast at another, both stretched
//     when the places would spend more than the monthly budget (plan.js,
//     usage.js);
//   - scene triggers (events.js): a category changes, the budget is almost
//     or fully used, Google refuses the key;
//   - scene actions: read the air quality of a place, the worst hour coming;
//   - dashboard widgets (widgets.js): one place, its forecast, the budget.
//
// Transport: cloud (Google Maps Platform Air Quality API, the user's own key).
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake fetch (test/app.test.js).
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  guessLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import {
  createRegistry,
  RegistryError,
  placeOfHouse,
  keyFromExternalId,
  MAX_PLACES,
} from './places.js';
import { createState, DEFAULT_PATH } from './state.js';
import { createUsage } from './usage.js';
import { planOf } from './plan.js';
import {
  createAirQualityApi,
  ApiKeyError,
  QuotaError,
  OutOfCoverageError,
  BudgetExceededError,
} from './air-quality-api.js';
import { readingOf, forecastHourOf, worstHour } from './reading.js';
import { resolveTimezone } from './time.js';
import { buildDevice, buildStates, featureSignature } from './device.js';
import {
  TRIGGERS,
  SCENE_ACTIONS,
  readingOutputs,
  forecastOutputs,
  categoryChanges,
  budgetLevel,
  budgetData,
  keyRefusedData,
  summaryOf,
} from './events.js';
import {
  WIDGETS,
  buildAirQualityWidget,
  buildForecastWidget,
  buildBudgetWidget,
} from './widgets.js';
import { t, all, ago, isLanguage, formatNumber } from './i18n.js';

const ACTIONS = {
  ADD: 'add_place',
  REMOVE: 'remove_place',
  LIST: 'list_places',
  TEST_KEY: 'test_api_key',
};
const USAGE_PATH = '/data/usage.json';
// The clock is read this often: a place is read within this delay of its
// due time.
const TICK_MS = 30 * 1000;
// The houses of Gladys are read again this often (no update event).
const HOUSES_REFRESH_MS = 10 * 60 * 1000;
// Requests of one round are spaced: far under the 6,000 a minute of Google.
const REQUEST_SPACING_MS = 1000;
// A place read less than this ago is not read again by an action.
const MIN_MANUAL_GAP_MS = 60 * 1000;
// After a 429, no request for this long.
const QUOTA_PAUSE_MS = 15 * 60 * 1000;
// A refused key is tried again this often (the user may fix the Cloud
// project without touching the key).
const KEY_RETRY_MS = 60 * 60 * 1000;
// requestWidgetRefresh: at most once every 10 s per widget.
const WIDGET_REFRESH_GAP_MS = 10 * 1000;
// The forecast action without a scheduled forecast: one is kept this long.
const FORECAST_ACTION_MAX_AGE_MS = 3 * 60 * 60 * 1000;
// Where "Test the API key" reads: the centre of Paris, one request.
const TEST_PLACE = { latitude: 48.8566, longitude: 2.3522 };

const RESTRICTED_REASONS = [
  'API_KEY_IP_ADDRESS_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_ANDROID_APP_BLOCKED',
  'API_KEY_IOS_APP_BLOCKED',
];

/**
 * @description The TEXTS key of what to do about a refused key.
 * @param {string|null} reason - The Google reason.
 * @returns {string} The key.
 */
function hintKey(reason) {
  if (RESTRICTED_REASONS.includes(reason)) return 'hint_restricted';
  if (reason === 'API_KEY_EXPIRED') return 'hint_API_KEY_INVALID';
  const known = [
    'API_KEY_MISSING',
    'API_KEY_INVALID',
    'SERVICE_DISABLED',
    'BILLING_DISABLED',
    'API_KEY_SERVICE_BLOCKED',
  ];
  return known.includes(reason) ? `hint_${reason}` : 'hint_default';
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.now] - `() => Date` (tests).
 * @param {string} [options.timezone] - IANA timezone (default: TZ).
 * @param {Function} [options.fetchImpl] - `fetch` (tests).
 * @param {string|null} [options.statePath] - File of the state.
 * @param {string|null} [options.usagePath] - File of the usage counter.
 * @param {Function} [options.sleep] - `(ms) => Promise` (tests).
 * @param {Function} [options.newId] - Identifier of a new place (tests).
 * @param {number} [options.tickMs] - Clock period, 0 for none (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ tick: Function, registry: object, usage: object, stop: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    now = () => new Date(),
    timezone = resolveTimezone(),
    fetchImpl = fetch,
    statePath = DEFAULT_PATH,
    usagePath = USAGE_PATH,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    newId,
    tickMs = TICK_MS,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the language of the texts Gladys
  // does not ask for in a language, when the `language` setting is `auto`.
  let language = guessLanguage(timezone);
  let timer = null;
  let running = Promise.resolve();
  let lastStatus = null;
  // missing, unknown (no request yet), ok, refused.
  let keyState = 'missing';
  let keyReason = null;
  let keyRefusedAt = 0;
  let houses = [];
  let housesReadAt = -Infinity;
  let housesError = null;
  let plan = planOf({ places: 0, refreshMinutes: 60, forecastHours: 0, budget: 1 });
  const widgetRefreshedAt = new Map();

  const registry = createRegistry(gladys, { logger, ...(newId ? { newId } : {}) });
  const state = createState({ path: statePath, logger });
  const ms = () => now().getTime();
  const usage = createUsage({
    path: usagePath,
    getPercent: () => config.budgetPercent,
    now: ms,
    logger,
  });
  const api = createAirQualityApi({
    getApiKey: () => config.apiKey,
    usage,
    fetchImpl,
    now: ms,
    logger,
  });

  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);
  const places = () => [...(config.useHouses ? houses : []), ...registry.list()];
  const byKey = (key) => places().find((place) => place.key === key) ?? null;
  const createdKeys = () =>
    new Set((gladys.devices ?? []).map((device) => keyFromExternalId(device.external_id)));
  const requestOptions = () => ({ language: textLanguage(), localIndex: config.localIndex });
  // The place with the country of its last reading (for another local index).
  const located = (place) => ({
    ...place,
    regionCode: state.get(place.key)?.reading?.regionCode ?? null,
  });

  /** @description Compute the plan of the places again. */
  function replan() {
    plan = planOf({
      places: places().length,
      refreshMinutes: config.refreshMinutes,
      forecastHours: config.forecastHours,
      budget: usage.budget(),
    });
  }

  /**
   * @description Read the houses of Gladys (located ones only). A failure
   * keeps the previous list: a transient error must not drop the devices.
   * @param {boolean} [force] - Read now, whatever the last reading.
   */
  async function refreshHouses(force = false) {
    if (!config.useHouses || !gladys.connected) return;
    if (!force && ms() - housesReadAt < HOUSES_REFRESH_MS) return;
    housesReadAt = ms();
    try {
      const list = await gladys.getHouses();
      const next = (Array.isArray(list) ? list : []).map(placeOfHouse).filter(Boolean);
      housesError = null;
      const changed = JSON.stringify(next) !== JSON.stringify(houses);
      houses = next;
      if (changed) await placesChanged();
    } catch (err) {
      housesError = err.message;
      logger.warn(`Unable to read the houses of Gladys: ${err.message}`);
    }
  }

  /**
   * @description Remember the language of a widget request, and store it
   * when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!isLanguage(next) || next === language) return;
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
    if (config.language === AUTO_LANGUAGE) publishDiscovery();
  }

  /** @description Offer every place on the Discovery screen. */
  async function publishDiscovery() {
    if (!gladys.connected) return;
    try {
      await gladys.publishDiscoveredDevices(
        places().map((place) =>
          buildDevice(gladys, place, state.get(place.key)?.reading ?? null, textLanguage()),
        ),
      );
    } catch (err) {
      logger.error('Unable to publish the discovered places', err);
    }
  }

  /**
   * @description Publish the states of places whose device exists (only the
   * changed values).
   * @param {object[]} list - The places.
   */
  async function publishStates(list) {
    if (!gladys.connected) return;
    const created = createdKeys();
    const states = list.flatMap((place) => {
      const reading = state.get(place.key)?.reading;
      return reading && created.has(place.key)
        ? buildStates(gladys, place, reading, textLanguage())
        : [];
    });
    if (states.length === 0) return;
    try {
      await gladys.publishChangedStates(states);
    } catch (err) {
      logger.error('Unable to publish the states', err);
    }
  }

  /** @description Ask Gladys to fetch the widgets again (10 s apart at least). */
  function refreshWidgets() {
    if (!gladys.connected) return;
    Object.values(WIDGETS).forEach((key) => {
      const last = widgetRefreshedAt.get(key) ?? -Infinity;
      if (ms() - last < WIDGET_REFRESH_GAP_MS) return;
      widgetRefreshedAt.set(key, ms());
      try {
        gladys.requestWidgetRefresh(key);
      } catch (err) {
        logger.warn(`Unable to refresh the widget ${key}: ${err.message}`);
      }
    });
  }

  /**
   * @description The requests of the month, as text.
   * @param {string} lang - The language.
   * @returns {string} The text.
   */
  function usageText(lang) {
    return t('statusUsage', lang, {
      used: formatNumber(usage.used(), lang),
      budget: formatNumber(usage.budget(), lang),
      planned: formatNumber(plan.planned, lang),
    });
  }

  /** @description Show the places and the requests of the month in the Configuration screen. */
  async function reportStatus() {
    let connected = true;
    let message;
    if (!config.apiKey) {
      connected = false;
      message = all('statusNoKey');
    } else if (keyState === 'refused') {
      connected = false;
      message = all((lang) =>
        t('statusKeyError', lang, { reason: keyReason, hint: t(hintKey(keyReason), lang) }),
      );
    } else if (places().length === 0) {
      message = all('statusEmpty');
    } else {
      message = all(
        (lang) =>
          t('statusOk', lang, { count: places().length, usage: usageText(lang) }) +
          (plan.stretched
            ? t('statusStretched', lang, {
                refresh: plan.refreshMinutes,
                forecast: Math.round(plan.forecastMinutes / 6) / 10,
              })
            : ''),
      );
    }
    const signature = JSON.stringify([connected, message]);
    if (!gladys.connected || signature === lastStatus) return;
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the status', err);
    }
  }

  /**
   * @description Fire a scene event; a refusal is logged, never thrown.
   * @param {string} key - The trigger.
   * @param {object} data - Its data.
   * @returns {Promise<boolean>} Whether Gladys accepted it.
   */
  async function fire(key, data) {
    try {
      await gladys.publishSceneEvent(key, data);
      return true;
    } catch (err) {
      logger.warn(`Scene event ${key} refused: ${err.message}`);
      return false;
    }
  }

  /**
   * @description The message of a failed request, in a language.
   * @param {Error} err - The error.
   * @param {string} lang - The language.
   * @returns {string} The message.
   */
  function errorMessage(err, lang) {
    if (err instanceof BudgetExceededError) {
      return t('errorBudget', lang, { budget: formatNumber(usage.budget(), lang) });
    }
    if (err instanceof ApiKeyError) {
      return t('statusKeyError', lang, { reason: err.reason, hint: t(hintKey(err.reason), lang) });
    }
    if (err instanceof QuotaError) return t('errorQuota', lang);
    if (err instanceof OutOfCoverageError) return t('errorCoverage', lang);
    return t('errorUnreachable', lang, { message: err.message });
  }

  /**
   * @description What a failed request changes for the whole integration.
   * @param {Error} err - The error.
   */
  async function failed(err) {
    if (err instanceof ApiKeyError) {
      keyState = config.apiKey ? 'refused' : 'missing';
      keyReason = err.reason;
      keyRefusedAt = ms();
    } else if (err instanceof QuotaError) {
      state.pause(ms() + QUOTA_PAUSE_MS);
    }
    await reportStatus();
  }

  /** @description A request succeeded: the key works. */
  function keyWorks() {
    if (keyState === 'ok') return;
    keyState = 'ok';
    keyReason = null;
    state.setFlag('key_refused', false);
  }

  /**
   * @description Read the current conditions of a place now, store the
   * reading and publish its states.
   * @param {object} place - The place.
   * @param {object} [options] - Options.
   * @param {boolean} [options.manual] - An action (no scene event).
   * @returns {Promise<object>} The reading.
   * @throws {Error} The error of the request.
   */
  async function read(place, { manual = false } = {}) {
    const previous = state.get(place.key)?.reading ?? null;
    let reading;
    try {
      reading = readingOf(await api.current(located(place), requestOptions()));
    } catch (err) {
      state.failure(
        place.key,
        { reason: err.reason ?? null, message: errorMessage(err, 'en').slice(0, 200) },
        ms(),
      );
      logger.warn(`Place ${place.key}: ${err.message}`);
      await failed(err);
      throw err;
    }
    state.reading(place.key, reading, ms());
    keyWorks();
    if (featureSignature(previous) !== featureSignature(reading)) await publishDiscovery();
    await publishStates([place]);
    if (!manual) {
      for (const data of categoryChanges(gladys, place, previous, reading, textLanguage())) {
        await fire(TRIGGERS.CATEGORY_CHANGED, data);
      }
    }
    await reportStatus();
    return reading;
  }

  /**
   * @description Read the forecast of a place now and store it.
   * @param {object} place - The place.
   * @returns {Promise<object[]>} The hours.
   * @throws {Error} The error of the request.
   */
  async function readForecast(place) {
    let hours;
    try {
      hours = (await api.forecast(located(place), requestOptions())).map(forecastHourOf);
    } catch (err) {
      state.forecastFailure(place.key, ms());
      logger.warn(`Forecast of ${place.key}: ${err.message}`);
      await failed(err);
      throw err;
    }
    state.forecast(place.key, hours, ms());
    keyWorks();
    return hours;
  }

  /** @description Fire the budget alerts not fired yet this month. */
  async function checkBudget() {
    const used = usage.used();
    const budget = usage.budget();
    const level = budgetLevel(used, budget);
    if (!level) return;
    const flag = `budget:${usage.month()}:${level}`;
    if (state.flag(flag)) return;
    if (await fire(TRIGGERS.BUDGET_ALERT, budgetData(level, used, budget, textLanguage()))) {
      state.setFlag(flag, true);
      // An exhausted budget implies its warning: never fire it after.
      if (level === 'exhausted') state.setFlag(`budget:${usage.month()}:warning`, true);
    }
  }

  /** @description Fire the refused-key event once per refusal. */
  async function checkKey() {
    if (keyState !== 'refused' || state.flag('key_refused')) return;
    const data = keyRefusedData(keyReason, t(hintKey(keyReason), textLanguage()), textLanguage());
    if (await fire(TRIGGERS.API_KEY_REFUSED, data)) state.setFlag('key_refused', true);
  }

  /**
   * @description One look at the clock: read the places that are due, one
   * after the other. Never two rounds at once.
   * @returns {Promise<void>}
   */
  function tick() {
    running = running.then(async () => {
      if (!gladys.connected) return;
      await refreshHouses();
      await checkKey();
      await checkBudget();
      if (!config.apiKey || ms() < state.pausedUntil()) return;
      if (keyState === 'refused' && ms() - keyRefusedAt < KEY_RETRY_MS) return;
      const jobs = [];
      places().forEach((place) => {
        const current = state.get(place.key);
        if (ms() - (current?.attempt ?? 0) >= plan.refreshMinutes * 60000) {
          jobs.push(() => read(place));
        }
        if (
          plan.forecastMinutes > 0 &&
          ms() - (current?.forecastAttempt ?? 0) >= plan.forecastMinutes * 60000
        ) {
          jobs.push(() => readForecast(place));
        }
      });
      let done = 0;
      for (const [index, job] of jobs.entries()) {
        if (index > 0) await sleep(REQUEST_SPACING_MS);
        try {
          await job();
          done += 1;
        } catch (err) {
          // The whole round stops on what concerns every place.
          if (
            err instanceof ApiKeyError ||
            err instanceof QuotaError ||
            err instanceof BudgetExceededError
          ) {
            break;
          }
        }
      }
      if (jobs.length > 0) {
        if (done > 0) refreshWidgets();
        await reportStatus();
        await checkKey();
        await checkBudget();
      }
    });
    running = running.catch((err) => logger.error('Clock round failed', err));
    return running;
  }

  /**
   * @description Forget the stored readings of the places no longer
   * followed — not while the houses cannot be read (their readings stay).
   */
  function forgetGone() {
    if (config.useHouses && housesError !== null) return;
    state.keep(places().map((place) => place.key));
  }

  /** @description Everything that follows a change of the places. */
  async function placesChanged() {
    replan();
    forgetGone();
    await publishDiscovery();
    await publishStates(places());
    refreshWidgets();
    await reportStatus();
  }

  /**
   * @description A one-line description of a place.
   * @param {object} place - The place.
   * @param {string} lang - The language.
   * @returns {string} The line.
   */
  function describe(place, lang) {
    const current = state.get(place.key);
    const number = place.kind === 'place' ? `#${registry.numberOf(place)} ` : '';
    const last = current?.reading
      ? `${summaryOf(place.name, current.reading, lang)} (${ago(current.at, ms(), lang)})`
      : t('never', lang);
    return (
      t('listLine', lang, {
        number,
        name: place.name,
        kind: t(`kind_${place.kind}`, lang),
        last,
      }) + (current?.error ? t('listError', lang, { message: current.error.message }) : '')
    );
  }

  /**
   * @description Run a change of the registry, turning its errors into a
   * message in the language of the integration.
   * @param {Function} change - `() => Promise`.
   * @returns {Promise<*>} The result of the change.
   */
  async function guarded(change) {
    try {
      return await change();
    } catch (err) {
      if (err instanceof RegistryError) {
        throw new Error(t(err.key, textLanguage(), err.params), { cause: err });
      }
      throw new Error(t('errorSave', textLanguage(), { message: err.message }), { cause: err });
    }
  }

  /**
   * @description The place a scene action names (a device of the integration).
   * @param {string} externalId - The device external id.
   * @returns {object} The place.
   * @throws {Error} When it is not a followed place.
   */
  function placeOfAction(externalId) {
    const place = byKey(keyFromExternalId(externalId));
    if (!place) throw new Error(t('errorUnknownDevice', textLanguage()));
    return place;
  }

  // --- Configuration buttons ------------------------------------------------
  gladys.onAction(ACTIONS.ADD, async (fields = {}) => {
    const place = await guarded(() => registry.add(fields));
    logger.info(`Place ${place.key} added`);
    await placesChanged();
    await tick();
    return all((lang) => t('added', lang, { line: describe(place, lang) }));
  });

  gladys.onAction(ACTIONS.REMOVE, async (fields = {}) => {
    const place = await guarded(() => registry.remove(fields.place));
    logger.info(`Place ${place.key} removed`);
    await placesChanged();
    return all('removed', { name: place.name });
  });

  gladys.onAction(ACTIONS.LIST, async () => {
    await refreshHouses(true);
    const list = places();
    const houseNote = (lang) => {
      if (!config.useHouses) return t('listHousesOff', lang);
      if (housesError) return t('listHousesError', lang, { message: housesError });
      return houses.length === 0 ? t('listNoHouse', lang) : '';
    };
    return all((lang) =>
      [
        t('listHeader', lang, {
          count: list.length,
          usage: usageText(lang),
          refresh: plan.refreshMinutes,
          forecast:
            plan.forecastMinutes > 0
              ? t('listForecastEvery', lang, { hours: Math.round(plan.forecastMinutes / 6) / 10 })
              : t('listForecastOff', lang),
        }),
        houseNote(lang),
        ...(list.length === 0
          ? [t('listEmpty', lang)]
          : list.map((place) => describe(place, lang))),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  });

  gladys.onAction(ACTIONS.TEST_KEY, async () => {
    let reading;
    try {
      reading = readingOf(await api.current(TEST_PLACE, requestOptions()));
    } catch (err) {
      if (err instanceof ApiKeyError) await failed(err);
      throw new Error(errorMessage(err, textLanguage()), { cause: err });
    }
    keyWorks();
    await reportStatus();
    refreshWidgets();
    await tick();
    return all((lang) =>
      t('testOk', lang, { summary: summaryOf('Paris', reading, lang), used: usage.used() }),
    );
  });

  // --- Scene actions --------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, async (fields = {}) => {
    const place = placeOfAction(fields.place);
    const current = state.get(place.key);
    const age = current?.reading ? ms() - current.at : Infinity;
    const wanted = fields.refresh === true ? MIN_MANUAL_GAP_MS : plan.refreshMinutes * 60000;
    let reading = current?.reading ?? null;
    if (age >= wanted) {
      if (ms() < state.pausedUntil()) throw new Error(t('errorQuota', textLanguage()));
      try {
        reading = await read(place, { manual: true });
      } catch (err) {
        throw new Error(errorMessage(err, textLanguage()), { cause: err });
      }
      refreshWidgets();
    }
    return readingOutputs(place.name, reading, textLanguage());
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_FORECAST, async (fields = {}) => {
    const place = placeOfAction(fields.place);
    const horizon = Math.min(48, Math.max(1, Math.round(Number(fields.hours) || 12)));
    const current = state.get(place.key);
    const maxAge =
      plan.forecastMinutes > 0 ? plan.forecastMinutes * 60000 : FORECAST_ACTION_MAX_AGE_MS;
    let hours = current?.forecast ?? null;
    if (!hours || ms() - current.forecastAt >= maxAge) {
      if (ms() < state.pausedUntil()) throw new Error(t('errorQuota', textLanguage()));
      try {
        hours = await readForecast(place);
      } catch (err) {
        throw new Error(errorMessage(err, textLanguage()), { cause: err });
      }
      refreshWidgets();
    }
    const worst = worstHour(hours, ms(), horizon);
    if (!worst) throw new Error(t('errorNoForecast', textLanguage()));
    return forecastOutputs(place.name, worst, horizon, timezone, textLanguage());
  });

  // --- Widgets --------------------------------------------------------------
  const placeOfSettings = (settings) => byKey(keyFromExternalId(settings?.place));

  gladys.onWidgetGet(WIDGETS.AIR_QUALITY, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const place = placeOfSettings(settings);
    return buildAirQualityWidget({
      place,
      state: place ? state.get(place.key) : null,
      chosen: Boolean(settings.place),
      hasKey: Boolean(config.apiKey),
      language: isLanguage(lang) ? lang : textLanguage(),
      now: ms(),
    });
  });

  gladys.onWidgetGet(WIDGETS.FORECAST, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const place = placeOfSettings(settings);
    return buildForecastWidget({
      place,
      state: place ? state.get(place.key) : null,
      chosen: Boolean(settings.place),
      hasKey: Boolean(config.apiKey),
      enabled: config.forecastHours > 0,
      language: isLanguage(lang) ? lang : textLanguage(),
      timezone,
      now: ms(),
    });
  });

  gladys.onWidgetGet(WIDGETS.BUDGET, async ({ language: lang } = {}) => {
    rememberLanguage(lang);
    const paused = ms() < state.pausedUntil();
    return buildBudgetWidget({
      usage,
      planned: plan.planned,
      places: places().length,
      percent: config.budgetPercent,
      keyState: paused && keyState !== 'refused' ? 'paused' : keyState,
      language: isLanguage(lang) ? lang : textLanguage(),
    });
  });

  // --- Devices and configuration --------------------------------------------
  gladys.onScanRequest(async () => {
    await refreshHouses(true);
    await publishDiscovery();
  });

  gladys.onDeviceCreated(async (device) => {
    const place = byKey(keyFromExternalId(device.external_id));
    if (place) await publishStates([place]);
    refreshWidgets();
  });

  gladys.onDeviceUpdated(async (device) => {
    const place = byKey(keyFromExternalId(device.external_id));
    if (place) await publishStates([place]);
  });

  gladys.onConfigUpdated(async (raw) => {
    const previous = {
      language: textLanguage(),
      apiKey: config.apiKey,
      useHouses: config.useHouses,
    };
    config = normalizeConfig(raw);
    if (config.apiKey !== previous.apiKey) {
      keyState = config.apiKey ? 'unknown' : 'missing';
      keyReason = null;
      keyRefusedAt = 0;
      state.setFlag('key_refused', false);
    }
    if (config.useHouses && !previous.useHouses) await refreshHouses(true);
    await placesChanged();
    if (textLanguage() !== previous.language) await publishDiscovery();
    await tick();
  });

  gladys.on('connected', async () => {
    const raw = gladys.config ?? {};
    config = normalizeConfig(raw);
    language = readLanguage(raw, language);
    registry.load(raw);
    if (!config.apiKey) keyState = 'missing';
    else if (keyState === 'missing') keyState = 'unknown';
    lastStatus = null;
    await refreshHouses(true);
    replan();
    forgetGone();
    logger.info(`${places().length} place(s), timezone ${timezone}`);
    await publishDiscovery();
    await publishStates(places());
    await reportStatus();
    await tick();
    if (tickMs > 0 && timer === null) {
      timer = setInterval(() => tick(), tickMs);
      timer.unref?.();
    }
  });

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stop();
    await running;
  });

  return { tick, registry, usage, stop, places };
}

export { ACTIONS, TICK_MS, TEST_PLACE, MAX_PLACES, hintKey, createApp };
