// -----------------------------------------------------------------------------
// The monthly plan: how many requests the places would spend at the chosen
// intervals, and the intervals actually used so that they stay within the
// budget.
//
// A place spends one request per reading of its current conditions, and one
// per forecast (one page: all its hours in one request). A month is counted
// as 31 days, the longest. When the places would spend more than the budget,
// both intervals are stretched by the same factor rather than going over: the
// readings stay regular, only less frequent.
// -----------------------------------------------------------------------------

const MINUTES_PER_MONTH = 31 * 24 * 60;

/**
 * @description The requests a month of the places at given intervals.
 * @param {number} places - The number of places.
 * @param {number} refreshMinutes - Minutes between two readings.
 * @param {number} forecastMinutes - Minutes between two forecasts (0: none).
 * @returns {number} Requests a month.
 * @example
 * plannedPerMonth(1, 60, 360); // -> 868
 */
function plannedPerMonth(places, refreshMinutes, forecastMinutes) {
  const readings = Math.ceil(MINUTES_PER_MONTH / refreshMinutes);
  const forecasts = forecastMinutes > 0 ? Math.ceil(MINUTES_PER_MONTH / forecastMinutes) : 0;
  return places * (readings + forecasts);
}

/**
 * @description The intervals to use, stretched to fit the budget.
 * @param {object} options - Options.
 * @param {number} options.places - The number of places.
 * @param {number} options.refreshMinutes - The chosen interval of the readings.
 * @param {number} options.forecastHours - The chosen interval of the forecasts (0: none).
 * @param {number} options.budget - The monthly budget.
 * @returns {{ refreshMinutes: number, forecastMinutes: number, planned: number,
 *   wanted: number, stretched: boolean }} The plan.
 * @example
 * planOf({ places: 12, refreshMinutes: 60, forecastHours: 6, budget: 9000 });
 */
function planOf({ places, refreshMinutes, forecastHours, budget }) {
  const forecastMinutes = forecastHours * 60;
  const wanted = plannedPerMonth(places, refreshMinutes, forecastMinutes);
  if (places === 0 || wanted <= budget) {
    return { refreshMinutes, forecastMinutes, planned: wanted, wanted, stretched: false };
  }
  let factor = wanted / budget;
  let plan;
  // Rounding the intervals up can still overshoot by a few requests.
  for (let i = 0; i < 20; i += 1) {
    const refresh = Math.ceil(refreshMinutes * factor);
    const forecast = forecastMinutes > 0 ? Math.ceil(forecastMinutes * factor) : 0;
    plan = {
      refreshMinutes: refresh,
      forecastMinutes: forecast,
      planned: plannedPerMonth(places, refresh, forecast),
      wanted,
      stretched: true,
    };
    if (plan.planned <= budget) break;
    factor *= 1.05;
  }
  return plan;
}

export { MINUTES_PER_MONTH, plannedPerMonth, planOf };
