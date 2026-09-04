import { describe, expect, it } from 'vitest'
import {
  buildActaIdsToProcess,
  collectListedActas,
} from '../src/actas/crawlActas.ts'
import * as cheerio from 'cheerio'

describe('buildActaIdsToProcess', () => {
  it('usa el listado y solo padding hacia adelante (sin rellenar huecos)', () => {
    expect(buildActaIdsToProcess([2801, 2804, 2802], 3)).toEqual([
      2801,
      2802,
      2804,
      2805,
      2806,
      2807,
    ])
  })

  it('no inventa ids si el listado está vacío', () => {
    expect(buildActaIdsToProcess([], 5)).toEqual([])
  })
})

describe('collectListedActas', () => {
  it('toma detalleActa y el título de la fila', () => {
    const html = `
      <table id="actasTable"><tbody>
        <tr>
          <td>27/08/2026</td>
          <td>1</td>
          <td>Acuerdo para designaciones</td>
          <td>EN GENERAL</td>
          <td>AFIRMATIVO</td>
          <td><a href="/votaciones/verActaVotacion/2801">descargar</a></td>
          <td>SIMPLE</td>
          <td><a href="/votaciones/detalleActa/2801">VER</a></td>
        </tr>
        <tr>
          <td>27/08/2026</td>
          <td>2</td>
          <td>Acuerdo Bertuzzi</td>
          <td>EN GENERAL</td>
          <td>AFIRMATIVO</td>
          <td><a href="/votaciones/verActaVotacion/2802">descargar</a></td>
          <td>SIMPLE</td>
          <td><a href="/votaciones/detalleActa/2802">VER</a></td>
        </tr>
      </tbody></table>
    `
    const $ = cheerio.load(html)
    const rows = collectListedActas($, $('table#actasTable tbody tr'))
    expect(rows).toEqual([
      { id: 2801, titulo: 'Acuerdo para designaciones' },
      { id: 2802, titulo: 'Acuerdo Bertuzzi' },
    ])
  })
})
