import { describe, expect, it } from 'vitest'
import { formatCash, formatDuration } from './format.ts'

describe('format', () => {
  it('formats cash compactly', () => {
    expect(formatCash(0)).toBe('$0')
    expect(formatCash(1234.9)).toBe('$1,234')
    expect(formatCash(12_345)).toBe('$12.3K')
    expect(formatCash(4_560_000)).toBe('$4.56M')
  })
  it('formats durations', () => {
    expect(formatDuration(42)).toBe('42s')
    expect(formatDuration(125)).toBe('2m 05s')
    expect(formatDuration(3 * 3600 + 120)).toBe('3h 02m')
  })
})
