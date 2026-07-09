import { describe, expect, it } from 'vitest'
import { subDays } from 'date-fns'
import { leerRuta } from '@/utils/rutas.js'
import { extraerRiesgoPais } from '@/finanzas/indices/riesgo-pais/extraccion/extraerRiesgoPais.js'
import riesgoPais from '@/finanzas/indices/riesgo-pais/riesgoPais.comando.js'

describe('extraerRiesgoPais', () => {
  it(
    'extrae valores desde ambito.com',
    async () => {
      const desde = subDays(new Date(), 30)
      const hasta = new Date()
      const items = await extraerRiesgoPais(desde, hasta)

      expect(items.length).toBeGreaterThan(0)

      for (const item of items) {
        expect(item.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof item.valor).toBe('number')
        expect(item.valor).toBeGreaterThan(0)
      }
    },
    30000,
  )
})

describe('riesgoPais', () => {
  it(
    'ejecuta el comando y guarda último e histórico',
    async () => {
      const rutasGuardadas = await riesgoPais()

      expect(rutasGuardadas).toEqual([
        '/finanzas/indices/riesgo-pais/ultimo',
        '/finanzas/indices/riesgo-pais',
      ])

      const ultimo = leerRuta('/finanzas/indices/riesgo-pais/ultimo')
      const historico = leerRuta('/finanzas/indices/riesgo-pais')

      expect(ultimo).toMatchObject({
        fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        valor: expect.any(Number),
      })
      expect(ultimo.valor).toBeGreaterThan(0)

      expect(Array.isArray(historico)).toBe(true)
      expect(historico.length).toBeGreaterThan(0)
      expect(historico).toContainEqual(ultimo)

      for (const item of historico) {
        expect(item.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof item.valor).toBe('number')
      }
    },
    30000,
  )
})
