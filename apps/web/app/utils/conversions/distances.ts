/**
 * Distance conversion utilities
 */

export const Distances = {
  /**
   * Convert meters to nautical miles
   */
  metersToNauticalMiles: (meters: number): number => {
    if (isNaN(meters)) return 0
    return meters / 1852
  },

  /**
   * Convert meters to feet
   */
  metersToFeet: (meters: number): number => {
    if (isNaN(meters)) return 0
    return meters * 3.28084
  },
}
