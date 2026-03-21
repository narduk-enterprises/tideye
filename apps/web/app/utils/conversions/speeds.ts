/**
 * Speed conversion utilities
 */

export const Speeds = {
  /**
   * Convert meters per second to knots
   */
  msecToKnots: (msec: number): number => {
    if (isNaN(msec)) return 0
    return msec * 1.94384
  },

  /**
   * Convert knots to meters per second
   */
  knotsToMsec: (knots: number): number => {
    if (isNaN(knots)) return 0
    return knots / 1.94384
  },
}
