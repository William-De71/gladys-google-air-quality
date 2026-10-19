# Google Air Quality

## Overview

This integration brings the air quality of Google Maps Platform to Gladys: for your houses and for the places you add (work, school, holiday home), it gives the universal air quality index, the index of your country, the concentrations of the main pollutants and a 48-hour forecast, and it can start your scenes when the air gets worse.

- Each place becomes a **device**: universal AQI (0-100, **higher is better**), local index (its number when it has one), PM2.5, PM10, NO₂, O₃, SO₂ in µg/m³, air quality category, local index category, dominant pollutant.
- The places are read **every hour** by default (Google updates its data once an hour), and their forecast every 6 hours, within a monthly budget kept under the free usage of Google.
- **Scene triggers**: the air quality category changes, the monthly budget is almost used, Google refuses the API key. **Scene actions**: read the air quality of a place, read the worst hour of the forecast.
- Three **dashboard widgets**: the air quality of a place with Google's health advice, its 48-hour forecast, the requests of the month.

![The three widgets of the integration: air quality of a house, its 48-hour forecast and the requests of the month (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-google-air-quality/main/docs/assets/widgets.en.png)

The image above is a generated illustration, not a screenshot. Not affiliated with Google; not tested with a real API key yet. Pollen is out of scope (Google's Pollen API is covered by other integrations).

## Prerequisites

- Gladys Assistant 5.1.0 or later.
- A **Google Maps Platform API key** with the **Air Quality API** enabled:
  1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or pick the one of your Google Weather or Google Maps Travel Time key) with a **billing account**: Google asks for one even when you stay within the free usage.
  2. Enable the **Air Quality API** (APIs & Services → Library → "Air Quality API", or [this link](https://console.cloud.google.com/apis/library/airquality.googleapis.com)).
  3. Create an **API key** (Google Maps Platform → Keys & Credentials), or reuse the key of the project. In its **API restrictions**, allow the Air Quality API (next to Weather API or Routes API if the key serves them too). An IP address restriction only works if the public IP address of your Gladys is fixed.
- The **location of your house** set in Gladys (**Settings → Houses**), or places added with **Add a place**. On installation, Gladys asks you to allow the integration to read the location of the houses.

**Cost.** Google bills each successful request beyond 10,000 free requests a month (SKU "Air Quality Usage"), then 5 USD per 1,000. A current-conditions reading is one request, a 48-hour forecast is one request (one page). With the defaults, a place costs about 870 requests a month: ten places fit in the default budget, 90 % of the free usage. Beyond, the integration reads less often rather than going over. The free usage belongs to the billing account: Google Weather, Travel Time and any other use of the account count too.

## Configuration

| Field                        | Default   | Meaning                                                                                                                                                                                       |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps Platform API key | —         | Required. A secret: never shown in the logs.                                                                                                                                                  |
| Follow the houses of Gladys  | yes       | One place per house whose location is set.                                                                                                                                                    |
| Reading every (minutes)      | 60        | 30 to 360. One request per place each time.                                                                                                                                                   |
| Forecast every (hours)       | 6         | 0 to 24. 0: no forecast (no forecast widget nor action).                                                                                                                                      |
| Local index                  | empty     | Empty: the default index of the country. Otherwise its Google code: `eaqi` (European index), `usa_epa`, `deu_uba`, `gbr_defra`… (list: "Air Quality Index" page of the Google documentation). |
| Monthly budget (%)           | 90        | Share of the 10,000 free requests the integration may spend. Above 100, Google bills the extra requests.                                                                                      |
| Language of the texts        | automatic | Feature names, categories and health advice from Google, scene summaries, button messages.                                                                                                    |

Buttons at the bottom of the page:

- **Add a place**: a name and "latitude, longitude" (right-click the place in Google Maps and click the coordinates to copy them, such as `45.7640, 4.8357`).
- **Remove a place**: by its name or its number (`#2`). Its device stays in Gladys until you delete it.
- **List the places**: the intervals, the requests of the month, the last reading and the last error of each place.
- **Test the API key**: reads the air quality in Paris (one request).

## Usage

### Places

Every house of Gladys with a location is a place, named like the house. The added places come on top (20 at most). The first reading of a new place comes within a minute.

### Devices

Open **Integrations → Google Air Quality → Discover** and add the places you want. Each device has:

| Feature                                               | Category / type                             | Unit                                |
| ----------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| Universal AQI                                         | airquality-sensor / aqi                     | 0-100, higher is better             |
| Local index (when it is a number: US EPA, UBA, DAQI…) | airquality-sensor / aqi                     | the scale of the index              |
| PM2.5, PM10                                           | pm25-sensor, pm10-sensor / decimal          | µg/m³                               |
| NO₂, O₃, SO₂                                          | no2-sensor, o3-sensor, so2-sensor / decimal | µg/m³ (converted from ppb at 25 °C) |
| Air quality, local index category, dominant pollutant | text                                        | —                                   |

ATMO (France) and EAQI (Europe) have categories, not numbers: their category is in the "local index category" text. A pollutant Google does not measure at a place stays without value. CO has no concentration category in Gladys: you find it in the outputs of the "Read the air quality" action.

### Dashboard widgets

- **Air quality**: one place (chosen among the devices): universal AQI gauge, local index, PM2.5, PM10, NO₂, O₃, categories, dominant pollutant and Google's health advice for the general population.
- **Air quality forecast**: the universal AQI of the next 48 hours, the worst hour of the next 24 marked.
- **Air quality requests**: the requests of the month against the budget, the plan, the state of the key.

### Scenes

Triggers:

- **The air quality category changes** (filters: place, universal or local index, new universal level). Variables: `name`, `index`, `category`, `previous_category`, `level`, `previous_level`, `aqi`, `dominant_pollutant`, `summary`. Only at scheduled readings, never at the first one.
- **The monthly budget is almost used** (80 %, then 100 %, once each a month).
- **Google refuses the API key** (once, until a request works again).

Actions:

- **Read the air quality**: the last reading of a place (a new request with "Read it now", none if it was read less than a minute ago). Outputs: `uaqi`, `level`, `category`, `local_index`, `local_aqi`, `local_category`, `dominant_pollutant`, `pm25`, `pm10`, `no2`, `o3`, `so2`, `co`, `health_recommendation`, `summary`.
- **Read the air quality forecast**: the worst hour of the next 1 to 48 hours. Outputs: `worst_uaqi`, `worst_level`, `worst_category`, `worst_time`, `worst_local_category`, `summary`.

Examples:

- When the universal AQI of "Home" changes to "low" → close the shutters and send the summary.
- Every morning at 7:00 → read the forecast of "Home" for 12 hours → if `worst_uaqi` is under 40, send "Not a good day for a run".
- When PM2.5 of "Home" goes above 25 µg/m³ (device trigger) → turn on the air purifier.

### Transport

The integration uses Google's servers (cloud): **the coordinates of your places are sent to Google** at each reading, with your API key. The added places are kept in the Gladys configuration; the last readings, the forecasts and the request counter are kept in the `/data` volume of the integration.

## Troubleshooting

- **"Google refuses the API key"**: the message gives Google's reason. `API_KEY_INVALID`: copy the key again. `SERVICE_DISABLED`: enable the Air Quality API in the project of the key. `BILLING_DISABLED`: link a billing account. `API_KEY_SERVICE_BLOCKED`: add the Air Quality API to the APIs allowed for the key. An IP restriction refuses Gladys if its public address changed. The integration tries again every hour, and at once after **Test the API key** or a new key.
- **No place**: set the location of the house in **Settings → Houses** (then press **List the places**), or add a place.
- **"No air quality data for this place"**: Google does not cover every country (see the coverage page of the Air Quality API).
- **No local index value**: the index of your country is a category (ATMO, EAQI); see the local index category, or choose a numeric index in the configuration.
- **Readings rarer than the interval**: "To stay within the budget" in the status means the places plan more than the budget; follow fewer places, read less often, or raise the budget.
- **"The requests of the month are used"**: the budget is reached; the readings resume next month (UTC). Google's own count (Cloud console → Google Maps Platform → Metrics) is the reference.
- **429**: Google limits the requests of the key; the integration waits 15 minutes.
- To report a problem, give the versions of Gladys and of the integration, the text of **List the places** and the logs of the integration (Settings → Supervision). Never paste your API key.
