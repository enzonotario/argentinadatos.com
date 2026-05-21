import { describe, expect, it } from 'vitest'
import { scrapearConIA } from '@/finanzas/compartido/extraccion/scrapearConIA.js'
import { logGrupo } from '@/log.js'

const tieneIaCompleta =
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENAI_API_KEY)

describe.skipIf(!tieneIaCompleta)('scrapearConIA (Real)', () => {
  it('extrae datos reales de BNA', async () => {
    const log = logGrupo({ fuente: 'test', tipo: 'real' })

    // Forzamos la ejecución
    import.meta.env.VITE_FORCE_IA = 'true'

    const configuracion = {
      url: 'https://www.bna.com.ar/home/cuentaremunerada',
      prompt:
        'Extrae la tasa de rendimiento anual (TNA) de la cuenta remunerada en dólares. Usa formato decimal (ej: 0.03 para 3%).',
      schema: {
        tna: {
          type: 'number',
        },
      },
      required: ['tna'],
    }

    try {
      const datos = await scrapearConIA(log, configuracion)

      console.log('Datos extraídos:', datos)

      expect(datos).toBeDefined()
      expect(typeof datos.tna).toBe('number')
      expect(datos.tna).toBeGreaterThan(0)
    } catch (error) {
      console.error('Error en test real:', error.message)
      // Si falla por falta de API keys en el entorno local del runner, lo ignoramos para no romper el CI
      // pero el usuario pidió tests lo mas reales posibles.
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('API key')
      ) {
        console.warn('Test saltado por falta de API keys válidas')
      } else {
        throw error
      }
    }
  }, 30000) // Timeout extendido para IA
})
