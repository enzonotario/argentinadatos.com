import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guardarSerieVariables } from '@/finanzas/fci/variables/guardado/guardarSerieVariables.js'
import { FciVariablesDatabaseService } from '@/finanzas/fci/variables/database/service.js'
import { leerRuta } from '@/utils/rutas.js'
import { crearBaseDeDatosTemporal } from '../../../../helpers/temp-database.js'

describe('guardarSerieVariables', () => {
  let testDb

  beforeEach(() => {
    testDb = crearBaseDeDatosTemporal('fci-variables')
  })

  afterEach(() => {
    testDb?.cleanup()
  })

  it('guarda en la base de datos y genera endpoint estático', async () => {
    const item = {
      nombre: 'PROVEEDOR_TEST',
      fondo: 'Fondo Test - Clase A',
      tipo: 'billetera',
      tna: 0.2,
      tea: 0.2214,
      tope: null,
      fecha: '2026-08-31',
      condiciones: 'Condiciones de prueba',
      condicionesCorto: 'Test',
    }

    await guardarSerieVariables([item], testDb.url, testDb.authToken)

    const db = new FciVariablesDatabaseService(testDb.url, testDb.authToken)
    await db.initialize()
    const ultimo = await db.getLatestFciVariablesByNombre(item.nombre)
    db.close()

    expect(ultimo).toBeDefined()
    expect(ultimo.nombre).toBe(item.nombre)
    expect(ultimo.fondo).toBe(item.fondo)
    expect(ultimo.tna).toBe(item.tna)
    expect(ultimo.tea).toBe(item.tea)
    expect(ultimo.fecha).toBe(item.fecha)
    expect(ultimo.tipo).toBe(item.tipo)

    const guardado = leerRuta('/finanzas/fci/variables/ultimo')
    const entry = guardado.find((r) => r.nombre === item.nombre)

    expect(entry).toMatchObject({
      nombre: item.nombre,
      fondo: item.fondo,
      tipo: item.tipo,
      tna: item.tna,
      tea: item.tea,
      tope: item.tope,
      fecha: item.fecha,
    })
  })
})
