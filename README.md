Feature was requested to calculate budget split by person and vehicle. Completed.

Updated the app to allow manual overriding of travelers and vehicles count in the active expedition to recalculate the budget dynamically.

Updated the app to:
1. Allow custom accommodation cost inputs.
2. Incorporate custom accommodation costs into the dynamic trip budget calculation.
3. Automatically hide AI accommodation tips when custom accommodation is provided.

Updated the app to auto-propagate custom accommodation to subsequent days if the end destination remains the same (handling multiple nights / loop rides automatically).

Updated the app to:
1. Include a dynamic Difficulty Index (Index náročnosti) for each day, calculated using riding time and average speed.
2. Calculate and display the Real Estimated Time (Celkový odhadovaný čas), assuming 35% extra time for breaks/refueling.

Updated the app to:
3. Calculate and display GPX elevation gain and loss ("Nastoupané výškové metry") for each day.
4. Added an AI-generated Dynamic Checklist for equipment based on trip preferences (camping, regions, etc.), visible in the "Pohled cestovatele" (SharedTrip view).

Updated the app to:
3. Changed GPX elevation metric to show Max and Min elevation (highest and lowest points) instead of elevation gain/loss, providing more practical value for riding conditions and weather planning.

Updated the app to:
1. Added full GPX elevation profile extraction, including start and end elevations.
2. Rendered a dynamic Recharts area chart for elevation profiling in both TripPlanner and SharedTrip.

Updated the app to:
3. Added XAxis with `dist` dataKey to `AreaChart` components to ensure the chart maps correctly to the real distance rather than the array indices.
Updated the app to:
1. Fixed the AI Refinement failing for existing expeditions by stripping large `gpxRoute` and `elevationProfile` arrays from the payload sent to the Gemini API, preventing context token limits from being exceeded.
2. Ensured GPX route and elevation profile data is preserved and re-merged after the AI returns the modified itinerary.
Updated the app to:
1. Fixed Leaflet map failing to render when switching between saved expeditions.
2. Fixed AI refinement wiping out map view due to async rendering race conditions.
Fixed the runtime crash breaking the app when opening the Planner, and robustly fixed Leaflet rendering bugs for empty maps during navigation.
- Implemented robust loading of AI data to prevent string exceptions (like `.replace` on undefined) causing blue-screen crashes.
- Ensured Map initialization safely handles fallback coordinate inputs.
