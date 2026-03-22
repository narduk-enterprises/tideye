/**
 * Fixed-size circular (ring) buffer.
 * Used by the SignalK store for windspeed history tracking.
 */
export class CircularBuffer<T> {
  private buffer: (T | undefined)[]
  private pointer: number = 0

  constructor(private capacity: number) {
    this.buffer = new Array<T | undefined>(capacity)
  }

  push(item: T): void {
    this.buffer[this.pointer] = item
    this.pointer = (this.pointer + 1) % this.capacity
  }

  getAll(): T[] {
    const validItems = this.buffer.filter((item): item is T => item !== undefined)
    const splitIndex = validItems.length >= this.capacity ? this.pointer : 0
    return [...validItems.slice(splitIndex), ...validItems.slice(0, splitIndex)]
  }

  clear(): void {
    this.buffer = new Array<T | undefined>(this.capacity)
    this.pointer = 0
  }
}
