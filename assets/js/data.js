/* ==========================================================================
   PLACEHOLDER DATA — replace every number below with your real measurements.
   --------------------------------------------------------------------------
   Every chart on the site is drawn from this one file, so you only need to
   update your numbers here. Each array has one value per week of the project
   (week 1 → week 13) unless a "weeks" list says otherwise.

   Dates on every chart axis are calculated from projectStart, so change it
   to the Monday your project began and all chart dates update.
   ========================================================================== */

window.PP = {
  projectStart: "2026-06-01", // PLACEHOLDER: YYYY-MM-DD of week 1

  // Which project weeks belong to each month (used by the sleep month filter)
  months: { 1: [1, 4], 2: [5, 8], 3: [9, 13] },

  charts: {
    /* ---- My Progress page ---- */
    weight: {
      type: "line",
      yTitle: "Body weight (kg)",
      unit: "kg",
      decimals: 1,
      // Week 1 (51.8) and week 13 (58.4) are real. Weeks 2–12 are placeholders.
      series: [{ name: "Body weight", values: [51.8, 52.3, 52.7, 53.4, 53.8, 54.5, 55.0, 55.6, 56.1, 56.7, 57.3, 57.8, 58.4] }]
    },
    runDistance: {
      type: "bar",
      yTitle: "Distance per week (km)",
      unit: "km",
      decimals: 0,
      series: [{ name: "Running distance", values: [4, 5, 5, 6, 7, 6, 8, 9, 9, 10, 11, 10, 12] }]
    },
    runPace: {
      type: "line",
      yTitle: "Average pace (min:sec per km) — lower is faster",
      unit: "/km",
      format: "pace",
      series: [{ name: "Average pace", values: [7.2, 7.1, 7.0, 6.9, 6.85, 6.8, 6.7, 6.6, 6.55, 6.45, 6.4, 6.35, 6.25] }]
    },
    strength: {
      type: "line",
      yTitle: "Working weight (kg)",
      unit: "kg",
      decimals: 1,
      weeks: [1, 3, 5, 7, 9, 11, 13],
      endLabels: "name",
      series: [
        // Bench press: week 1 (20 kg) and week 13 (50 kg) are real; the rest are placeholders.
        { name: "Bench press", values: [20, 25, 30, 35, 40, 45, 50] },
        { name: "Squat", values: [40, 45, 47.5, 50, 55, 57.5, 60] },
        { name: "Lat pulldown", values: [30, 32.5, 32.5, 35, 37.5, 40, 42.5] }
      ]
    },
    consistency: {
      type: "bar",
      yTitle: "Workouts completed per week",
      unit: "",
      decimals: 0,
      target: { value: 5, label: "Target 5" },
      series: [{ name: "Workouts", values: [4, 5, 5, 3, 6, 5, 6, 4, 6, 6, 5, 6, 6] }]
    },
    sleepAvg: {
      type: "line",
      yTitle: "Average sleep per night (hours)",
      unit: "h",
      decimals: 1,
      target: { value: 8, label: "Target 8 h" },
      series: [{ name: "Average sleep", values: [6.9, 7.0, 7.2, 7.1, 7.4, 7.6, 7.5, 7.8, 7.9, 8.0, 8.1, 8.0, 8.2] }]
    },

    /* ---- Optional graphs (My Progress page) ---- */
    measurements: {
      type: "line",
      yTitle: "Measurement (cm)",
      unit: "cm",
      decimals: 1,
      weeks: [1, 5, 9, 13],
      endLabels: "name",
      series: [
        { name: "Chest", values: [84, 85, 86.5, 88] },
        { name: "Waist", values: [72, 71.5, 71.5, 71] }
      ]
    },
    duration: {
      type: "line",
      yTitle: "Average workout length (minutes)",
      unit: "min",
      decimals: 0,
      series: [{ name: "Workout length", values: [40, 42, 45, 45, 50, 50, 52, 55, 55, 55, 58, 60, 60] }]
    },
    restDays: {
      type: "bar",
      yTitle: "Rest days per week",
      unit: "",
      decimals: 0,
      series: [{ name: "Rest days", values: [3, 2, 2, 4, 1, 2, 1, 3, 1, 1, 2, 1, 1] }]
    },

    /* ---- Diet & Sleep page (uses the same sleep numbers as sleepAvg) ---- */
    sleepProgress: { sameAs: "sleepAvg", height: 280 },

    /* ---- Interviews & Research page ---- */
    survey: {
      type: "bar",
      yTitle: "Number of students",
      xTitle: "Hours of sleep on a school night",
      unit: "",
      decimals: 0,
      labelAll: true,
      categories: ["Under 6 h", "6–7 h", "7–8 h", "8–9 h", "9 h +"],
      series: [{ name: "Students", values: [3, 9, 11, 5, 2] }]
    }
  }
};
