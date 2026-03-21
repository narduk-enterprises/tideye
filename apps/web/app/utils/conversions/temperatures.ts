/**
 * Temperature conversion utilities
 */

export const Temperatures = {
  /**
   * Convert Kelvin to Fahrenheit
   */
  kelvinToFahrenheit: (kelvin: number): number => {
    if (isNaN(kelvin)) return 0
    return ((kelvin - 273.15) * 9) / 5 + 32
  },

  /**
   * Convert Kelvin to Celsius
   */
  kelvinToCelsius: (kelvin: number): number => {
    if (isNaN(kelvin)) return 0
    return kelvin - 273.15
  },
}
