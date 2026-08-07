import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { applyBloquesToSenadores, downloadSenadoresVigentes } from '../src/senadores/applyBloques'
import {
  applyComisionesMetaToSenadores,
  crawlComisiones,
  parseComisionHtml,
} from '../src/senadores/crawlComisiones'

const FIXTURE_HTML = `
<html><body>
  <h1>Proyectos: Permanente Mixta Revisora de Cuentas</h1>
  <h1>Integrantes</h1>
  <div id="Nomina">
    <div id="Integrantes">
      <table>
        <tr><td>Nombre</td><td>Cargo</td></tr>
        <tr>
          <td>
            <a href="/senadores/senador/552">EZEQUIEL ATAUCHE</a>
            <span>(Sen.)</span>
          </td>
          <td>PRESIDENTE</td>
        </tr>
        <tr>
          <td>M. GRACIELA DE LA ROSA <span>(Dip.)</span></td>
          <td>VICEPRESIDENTA</td>
        </tr>
        <tr>
          <td>
            <a href="/senadores/senador/520">FLAVIO SERGIO FAMA</a>
            <span>(Sen.)</span>
          </td>
          <td>SECRETARIO</td>
        </tr>
      </table>
    </div>
  </div>
</body></html>
`

describe('parseComisionHtml', () => {
  it('parsea nombre, cargos y senadorId', () => {
    const comision = parseComisionHtml('100', FIXTURE_HTML, [
      {
        nombre: 'BICAMERAL PERMANENTE MIXTA REVISORA DE CUENTAS',
        tipo: 'BICAMERAL PERMANENTE',
      },
    ])

    expect(comision).toMatchObject({
      id: '100',
      nombre: expect.stringMatching(/Revisora de Cuentas/i),
      tipo: expect.stringMatching(/Bicameral Permanente/i),
    })
    expect(comision.integrantes).toHaveLength(3)
    expect(comision.integrantes[0]).toMatchObject({
      senadorId: '552',
      camara: 'senado',
      cargo: 'Presidente',
    })
    expect(comision.integrantes[1]).toMatchObject({
      senadorId: null,
      camara: 'diputados',
    })
  })

  it('aplica meta.comisiones solo a senadores', () => {
    const senadores = [
      { id: '552', meta: null as any },
      { id: '999', meta: null as any },
    ]
    const comision = parseComisionHtml('100', FIXTURE_HTML)
    applyComisionesMetaToSenadores(senadores, [comision])

    expect(senadores[0].meta?.comisiones).toEqual([
      expect.objectContaining({ id: '100', cargo: 'Presidente' }),
    ])
    expect(senadores[1].meta).toBeNull()
  })
})

describe('crawlComisiones + bloques (red)', () => {
  it('scrapea comisiones, aplica bloques/comisiones y persiste endpoints', async () => {
    const senadoresRaw = readEndpoint('/senado/senadores')
    expect(senadoresRaw).toBeTruthy()
    const senadores = JSON.parse(senadoresRaw!) as Array<{
      id: string
      nombre: string
      bloque: string | null
      meta: { comisiones?: unknown[] } | null
    }>

    const vigentes = await downloadSenadoresVigentes()
    const { matchedIds } = applyBloquesToSenadores(senadores, vigentes)
    expect(matchedIds.length).toBe(72)
    expect(senadores.every(s => 'bloque' in s)).toBe(true)

    const comisiones = await crawlComisiones()
    expect(comisiones.length).toBeGreaterThanOrEqual(40)

    const conIntegrantes = comisiones.filter(c => c.integrantes.length > 0)
    expect(conIntegrantes.length).toBeGreaterThanOrEqual(30)

    applyComisionesMetaToSenadores(senadores, comisiones)

    const conComision = senadores.filter(s => (s.meta?.comisiones?.length || 0) > 0)
    expect(conComision.length).toBeGreaterThanOrEqual(50)

    writeEndpoint('/senado/senadores', senadores)

    const persistedComisiones = JSON.parse(readEndpoint('/senado/comisiones') || '[]')
    expect(persistedComisiones.length).toBe(comisiones.length)

    const primera = persistedComisiones[0]
    const porId = JSON.parse(readEndpoint(`/senado/comisiones/${primera.id}`) || 'null')
    expect(porId).toMatchObject({ id: primera.id, nombre: primera.nombre })

    const conSenador = primera.integrantes.find((i: any) => i.senadorId)
    if (conSenador?.senadorId) {
      const senadorComisiones = JSON.parse(
        readEndpoint(`/senado/senadores/${conSenador.senadorId}/comisiones`) || '[]',
      )
      expect(senadorComisiones.some((c: any) => c.id === primera.id)).toBe(true)
    }
  }, 180_000)
})
