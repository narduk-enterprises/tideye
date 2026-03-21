/**
 * Volume conversion utilities
 */

export const Volumes = {
  /**
   * Convert decimal to percentage
   */
  decimalToPercent: (decimal: number): number => {
    if (isNaN(decimal)) return 0
    return decimal * 100
  },
}
