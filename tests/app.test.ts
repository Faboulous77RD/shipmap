import { describe, expect, it } from 'vitest'
import { appName } from '../src/app.ts'

describe('app', () => {
  it('nennt den Produktnamen', () => {
    expect(appName()).toBe('Shipmap')
  })
})
