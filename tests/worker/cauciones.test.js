import { describe, expect, it } from 'vitest'
import { CAUCIONES_COLLECTION } from '../../apps/worker/src/pocketbase/migrations/001_cauciones.js'

describe('worker cauciones migration schema', () => {
  it('defines normalized cauciones fields', () => {
    expect(CAUCIONES_COLLECTION.name).toBe('cauciones')
    expect(CAUCIONES_COLLECTION.type).toBe('base')
    expect(CAUCIONES_COLLECTION.listRule).toBeNull()
    expect(CAUCIONES_COLLECTION.fields.map(f => f.name)).toEqual([
      'plazo',
      'montoContado',
      'tasaPromedio',
      'fechaVencimiento',
      'syncedAt',
    ])
  })
})

describe('URLSearchParams password encoding', () => {
  it('encodes IOL special characters needed for form bodies', () => {
    const body = new URLSearchParams({
      username: 'user@example.com',
      password: 'a*b@c=d+e',
      grant_type: 'password',
    })
    const encoded = body.toString()
    // @ = + se escapan; * suele quedar literal (válido en x-www-form-urlencoded)
    expect(encoded).toContain('password=a*b%40c%3Dd%2Be')
    expect(encoded).toContain('username=user%40example.com')
  })
})
