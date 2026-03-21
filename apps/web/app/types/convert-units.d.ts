declare module 'convert-units' {
  interface UnitDescription {
    abbr: string
    measure: string
    system: string
    singular: string
    plural: string
  }

  type Unit = string

  interface Converter {
    from(unit: Unit): Converter
    to(unit: Unit): number
    possibilities(measure?: string): Unit[]
    describe(unit: Unit): UnitDescription
    list(measure?: string): UnitDescription[]
    measures(): string[]
  }

  function convert(value: number): Converter

  export default convert
  export type { Unit, Converter, UnitDescription }
}
