// -----------------------------------------------------------------------------
// Client of the Google Maps Platform Air Quality API (v1).
//
// Documented endpoints only (https://developers.google.com/maps/documentation/air-quality):
//   POST /v1/currentConditions:lookup   the conditions of the current hour
//   POST /v1/forecast:lookup            hourly forecast, up to 96 hours, in
//                                       pages (24 records by default)
// Body: `location` { latitude, longitude }, `universalAqi`, `extraComputations`
// (LOCAL_AQI, HEALTH_RECOMMENDATIONS, POLLUTANT_CONCENTRATION), `languageCode`,
// and `customLocalAqis` [{ regionCode, aqi }] to choose another local index.
//
// Billing (checked on 2026-10-20): one SKU, "Air Quality Usage" (Essentials),
// 10,000 free billable events a month, then 5 USD per 1,000. A billable event
// is a successful request: a current-conditions request, or one PAGE of a
// forecast. Every successful request is counted (usage.js); the forecast asks
// for all its hours in one page and never follows more than MAX_FORECAST_PAGES.
//
// The key travels in the `X-Goog-Api-Key` header, never in the URL: URLs end
// up in logs and error messages. A wrong key answers 400 INVALID_ARGUMENT with
// the reason API_KEY_INVALID (not a 403); no key, a disabled API or no billing
// answer 403 PERMISSION_DENIED.
// -----------------------------------------------------------------------------

const API_BASE = 'https://airquality.googleapis.com/v1';
const TIMEOUT_MS = 15 * 1000;
const EXTRA_COMPUTATIONS = ['LOCAL_AQI', 'HEALTH_RECOMMENDATIONS', 'POLLUTANT_CONCENTRATION'];
// The forecast hours asked for, in one page.
const FORECAST_HOURS = 48;
// A cap: a misbehaving pagination must not burn the budget.
const MAX_FORECAST_PAGES = 2;
const UNIVERSAL_CODE = 'uaqi';

/** @description Any failure of the Air Quality API. */
class AirQualityError extends Error {
  /**
   * @param {string} message - The message (never contains the key).
   * @param {number|null} status - The HTTP status (null: network).
   * @param {string|null} [reason] - The google.rpc.ErrorInfo reason.
   */
  constructor(message, status, reason = null) {
    super(message);
    this.name = 'AirQualityError';
    this.status = status;
    this.reason = reason;
  }
}

/**
 * @description The key is missing, invalid, restricted, or the project
 * cannot use the API (not enabled, no billing). Retrying will not help until
 * the user acts: `reason` says what to fix.
 */
class ApiKeyError extends AirQualityError {
  constructor(message, status, reason) {
    super(message, status, reason);
    this.name = 'ApiKeyError';
  }
}

/** @description Google refused for quota (429 RESOURCE_EXHAUSTED). */
class QuotaError extends AirQualityError {
  constructor(message, status, reason) {
    super(message, status, reason);
    this.name = 'QuotaError';
  }
}

/** @description The place has no air quality data (outside the coverage). */
class OutOfCoverageError extends AirQualityError {
  constructor(message) {
    super(message, 400, 'OUT_OF_COVERAGE');
    this.name = 'OutOfCoverageError';
  }
}

/** @description The monthly budget of the integration is spent. */
class BudgetExceededError extends AirQualityError {
  constructor(budget) {
    super(`Monthly budget of ${budget} Air Quality API requests reached`, null, 'BUDGET_EXCEEDED');
    this.name = 'BudgetExceededError';
    this.budget = budget;
  }
}

// ErrorInfo reasons that point at the key or the Cloud project.
const KEY_REASONS = new Set([
  'API_KEY_INVALID',
  'API_KEY_EXPIRED',
  'API_KEY_SERVICE_BLOCKED',
  'API_KEY_IP_ADDRESS_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_ANDROID_APP_BLOCKED',
  'API_KEY_IOS_APP_BLOCKED',
  'SERVICE_DISABLED',
  'BILLING_DISABLED',
  'CONSUMER_INVALID',
  'PERMISSION_DENIED',
]);

/**
 * @description Read a Google error body ({ error: { code, message, status, details } }).
 * @param {object|null} body - The parsed body.
 * @returns {{ message: string, status: string|null, reason: string|null }} The error.
 * @example
 * readError({ error: { message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } });
 */
function readError(body) {
  const error = body?.error ?? {};
  const details = Array.isArray(error.details) ? error.details : [];
  const info = details.find((detail) => typeof detail?.reason === 'string');
  return {
    message: typeof error.message === 'string' ? error.message.slice(0, 300) : '',
    status: typeof error.status === 'string' ? error.status : null,
    reason: info?.reason ?? null,
  };
}

/**
 * @description Turn an HTTP failure into the right error class.
 * @param {number} httpStatus - The HTTP status.
 * @param {object|null} body - The parsed body.
 * @returns {AirQualityError} The error.
 * @example
 * classifyError(400, body);
 */
function classifyError(httpStatus, body) {
  const { message, status, reason } = readError(body);
  const text = `Air Quality API ${httpStatus}${status ? ` ${status}` : ''}${message ? `: ${message}` : ''}`;
  if (reason !== null && KEY_REASONS.has(reason)) {
    return new ApiKeyError(text, httpStatus, reason);
  }
  if (httpStatus === 401 || httpStatus === 403 || /api key/i.test(message)) {
    return new ApiKeyError(text, httpStatus, reason ?? status ?? 'PERMISSION_DENIED');
  }
  if (httpStatus === 429) {
    return new QuotaError(text, httpStatus, reason ?? status);
  }
  // A place outside the coverage: the documentation does not spell out the
  // answer, a NOT_FOUND or an INVALID_ARGUMENT about the location.
  if (
    httpStatus === 404 ||
    (httpStatus === 400 &&
      /location|region|unavailable|not supported|unsupported|coverage/i.test(message))
  ) {
    return new OutOfCoverageError(text);
  }
  return new AirQualityError(text, httpStatus, reason ?? status);
}

/**
 * @description The BCP-47 code sent as `languageCode`.
 * @param {string} language - en, fr, de, es.
 * @returns {string} The code ('en' for anything unexpected).
 */
function languageCode(language) {
  return ['en', 'fr', 'de', 'es'].includes(language) ? language : 'en';
}

/**
 * @description Round a coordinate (4 decimals, about 11 m: the API grid is 500 m).
 * @param {number} value - Latitude or longitude.
 * @returns {number} The rounded value.
 */
function roundCoordinate(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

/**
 * @description The request body common to both methods.
 * @param {object} place - `{ latitude, longitude, regionCode? }`.
 * @param {object} options - `{ language, localIndex }`.
 * @returns {object} The body.
 */
function bodyOf(place, { language, localIndex }) {
  const body = {
    location: {
      latitude: roundCoordinate(place.latitude),
      longitude: roundCoordinate(place.longitude),
    },
    universalAqi: true,
    extraComputations: EXTRA_COMPUTATIONS,
    languageCode: languageCode(language),
  };
  // Another local index needs the country it applies to: known once the
  // place has been read a first time.
  if (localIndex && place.regionCode) {
    body.customLocalAqis = [{ regionCode: place.regionCode, aqi: localIndex }];
  }
  return body;
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * @description An index of the answer, reduced to what the integration uses.
 * @param {object} raw - An AirQualityIndex.
 * @returns {object} `{ code, name, aqi, display, category, dominant }`.
 */
function readIndex(raw) {
  return {
    code: String(raw?.code ?? ''),
    name: String(raw?.displayName ?? raw?.code ?? ''),
    // Absent for the non-numeric indexes (ATMO, EAQI…): category only.
    aqi: finite(raw?.aqi),
    display: typeof raw?.aqiDisplay === 'string' ? raw.aqiDisplay : '',
    category: typeof raw?.category === 'string' ? raw.category : '',
    dominant: typeof raw?.dominantPollutant === 'string' ? raw.dominantPollutant : '',
  };
}

/**
 * @description One hour of data (current conditions or one forecast hour),
 * reduced to plain values.
 * @param {object} raw - The answer, or an HourlyForecast.
 * @returns {object} `{ dateTime, universal, local, pollutants, health }`.
 */
function readHour(raw) {
  const indexes = (Array.isArray(raw?.indexes) ? raw.indexes : []).map(readIndex);
  const universal = indexes.find((index) => index.code === UNIVERSAL_CODE) ?? null;
  const local = indexes.find((index) => index.code !== UNIVERSAL_CODE) ?? null;
  const pollutants = {};
  (Array.isArray(raw?.pollutants) ? raw.pollutants : []).forEach((pollutant) => {
    const value = finite(pollutant?.concentration?.value);
    if (typeof pollutant?.code !== 'string' || value === null) return;
    pollutants[pollutant.code] = {
      value,
      units: String(pollutant.concentration.units ?? ''),
      name: String(pollutant.displayName ?? pollutant.code),
    };
  });
  const health = {};
  Object.entries(raw?.healthRecommendations ?? {}).forEach(([group, text]) => {
    if (typeof text === 'string' && text) health[group] = text.slice(0, 1000);
  });
  return {
    dateTime: typeof raw?.dateTime === 'string' ? raw.dateTime : null,
    universal,
    local,
    pollutants,
    health,
  };
}

/**
 * @description Create the Air Quality API client.
 * @param {object} options - Options.
 * @param {Function} options.getApiKey - `() => string`.
 * @param {object} options.usage - The usage counter (usage.js).
 * @param {Function} [options.fetchImpl] - `fetch` (injected by the tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {object} [options.logger] - Logger.
 * @returns {object} `{ current, forecast }`.
 * @example
 * const api = createAirQualityApi({ getApiKey: () => key, usage });
 */
function createAirQualityApi({
  getApiKey,
  usage,
  fetchImpl = fetch,
  now = () => Date.now(),
  logger = console,
}) {
  /**
   * @description One billable POST request.
   * @param {string} method - "currentConditions:lookup" or "forecast:lookup".
   * @param {object} body - The body.
   * @returns {Promise<object>} The parsed answer.
   */
  async function post(method, body) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new ApiKeyError('No API key configured', null, 'API_KEY_MISSING');
    }
    if (usage.exhausted()) {
      throw new BudgetExceededError(usage.budget());
    }
    let response;
    try {
      response = await fetchImpl(`${API_BASE}/${method}`, {
        method: 'POST',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new AirQualityError(`Air Quality API unreachable: ${err.message}`, null);
    }
    let answer;
    try {
      answer = await response.json();
    } catch {
      answer = null;
    }
    if (!response.ok) {
      throw classifyError(response.status, answer);
    }
    usage.record();
    logger.debug?.(`Air Quality API ${method} OK (${usage.used()} request(s) this month)`);
    return answer ?? {};
  }

  return {
    /**
     * @description The conditions of the current hour at a place.
     * @param {object} place - `{ latitude, longitude, regionCode? }`.
     * @param {object} options - `{ language, localIndex }`.
     * @returns {Promise<object>} The hour (readHour) plus `regionCode`.
     */
    async current(place, options) {
      const answer = await post('currentConditions:lookup', bodyOf(place, options));
      const hour = readHour(answer);
      if (hour.universal === null && hour.local === null) {
        throw new OutOfCoverageError('Air Quality API: no index for this place');
      }
      return {
        ...hour,
        regionCode: typeof answer.regionCode === 'string' ? answer.regionCode : null,
      };
    },

    /**
     * @description The next FORECAST_HOURS hours at a place.
     * @param {object} place - `{ latitude, longitude, regionCode? }`.
     * @param {object} options - `{ language, localIndex }`.
     * @returns {Promise<object[]>} The hours (readHour), in time order.
     */
    async forecast(place, options) {
      // From the next whole hour, FORECAST_HOURS hours (the end is inclusive).
      const start = Math.ceil(now() / 3600000) * 3600000;
      const end = start + (FORECAST_HOURS - 1) * 3600000;
      const hours = [];
      let pageToken;
      for (let page = 0; page < MAX_FORECAST_PAGES; page += 1) {
        const body = {
          ...bodyOf(place, options),
          period: {
            startTime: new Date(start).toISOString(),
            endTime: new Date(end).toISOString(),
          },
          pageSize: FORECAST_HOURS,
          ...(pageToken ? { pageToken } : {}),
        };
        const answer = await post('forecast:lookup', body);
        (Array.isArray(answer.hourlyForecasts) ? answer.hourlyForecasts : []).forEach((raw) =>
          hours.push(readHour(raw)),
        );
        pageToken = answer.nextPageToken;
        if (!pageToken) break;
      }
      return hours
        .filter((hour) => hour.dateTime)
        .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
    },
  };
}

export {
  API_BASE,
  EXTRA_COMPUTATIONS,
  FORECAST_HOURS,
  MAX_FORECAST_PAGES,
  UNIVERSAL_CODE,
  AirQualityError,
  ApiKeyError,
  QuotaError,
  OutOfCoverageError,
  BudgetExceededError,
  readError,
  classifyError,
  languageCode,
  roundCoordinate,
  bodyOf,
  readIndex,
  readHour,
  createAirQualityApi,
};
