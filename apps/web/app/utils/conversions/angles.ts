/**
 * Angle conversion utilities
 */

export const Angles = {
  /**
   * Convert radians to degrees
   */
  radiansToDegrees: (radians: number): number => {
    if (isNaN(radians)) return 0
    return radians * (180 / Math.PI)
  },

  /**
   * Convert degrees to radians
   */
  degreesToRadians: (degrees: number): number => {
    if (isNaN(degrees)) return 0
    return degrees * (Math.PI / 180)
  },

  /**
   * Normalize angle to 0-360 range
   */
  normalize: (degrees: number): number => {
    if (isNaN(degrees)) return 0
    return ((degrees % 360) + 360) % 360
  },
}
