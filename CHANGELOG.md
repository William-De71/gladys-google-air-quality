# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- One device per place through the Google Maps Platform Air Quality API: Universal AQI, local index (its number when it has one, its category always), PM2.5, PM10, NO₂, O₃ and SO₂ in µg/m³, air quality category and dominant pollutant.
- Places: every house of Gladys with a location, plus places added with plain forms ("Add a place", "Remove a place", "List the places") from a name and "latitude, longitude".
- Readings on the integration's own clock (every hour by default) and a 48-hour forecast (every 6 hours by default); a monthly budget, 90 % of Google's 10,000 free requests by default, with intervals stretched rather than going over; optional choice of another local index; "Test the API key" button.
- Scene triggers: the category of the universal AQI or of the local index of a place changes, the monthly budget is almost or fully used, Google refuses the API key.
- Scene actions: read the air quality of a place (values, categories, health advice, summary sentence), read the worst hour of the coming hours.
- Dashboard widgets: air quality of a place with health advice, 48-hour forecast chart, requests of the month.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-google-air-quality/releases/tag/v0.1.0
