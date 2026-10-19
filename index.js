// -----------------------------------------------------------------------------
// Entry point of the Google Air Quality external integration.
//
// Air quality of the houses of Gladys and of added places, through the
// Google Maps Platform Air Quality API and the user's own API key:
//   - devices: one per place (Universal AQI, local index, PM2.5, PM10, NO2,
//     O3, SO2, categories, dominant pollutant), offered on the Discovery
//     screen (see src/device.js);
//   - scene triggers: a category changes, the budget is almost used, Google
//     refuses the key;
//   - scene actions: read the air quality of a place, its worst hour coming;
//   - dashboard widgets: one place, its 48-hour forecast, the requests of the month.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the hours of the forecast are shown in it)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Google Air Quality integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
