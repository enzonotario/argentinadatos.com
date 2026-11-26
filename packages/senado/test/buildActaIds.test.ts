import { describe, expect, it } from 'vitest'
import {
  buildActaIdsToProcess,
  collectListedActas,
  parseFechaSesionListado,
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
  it('toma detalleActa, título y fecha de sesión de la fila', () => {
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
        <tr>
          <td>19/11/2026</td>
          <td>7</td>
          <td>O.D. 418/2026</td>
          <td>EN GENERAL</td>
          <td>AFIRMATIVO</td>
          <td><a href="/votaciones/verActaVotacion/2885">descargar</a></td>
          <td>SIMPLE</td>
          <td><a href="/votaciones/detalleActa/2885">VER</a></td>
        </tr>
      </tbody></table>
    `
    const $ = cheerio.load(html)
    const rows = collectListedActas($, $('table#actasTable tbody tr'))
    expect(rows).toEqual([
      {
        id: 2801,
        titulo: 'Acuerdo para designaciones',
        fechaSesion: '2026-08-27',
      },
      {
        id: 2802,
        titulo: 'Acuerdo Bertuzzi',
        fechaSesion: '2026-08-27',
      },
      {
        id: 2885,
        titulo: 'O.D. 418/2026',
        fechaSesion: '2026-11-19',
      },
    ])
  })

  it('ignora el link Ver Expedientes y el div oculto en el título', () => {
    const html = `
      <table id="actasTable"><tbody>
        <tr>
          <td>17/09/2026</td>
          <td>1</td>
          <td class="ocultar" style="max-width: 300px !important;">
            Moción para el tratamiento sobre tablas del expediente S-1563/26.
            <a onclick="mostrar(2805)" id="botonMostrar2805">Ver
                                    Expedientes</a>
            <div id="mostrarOcultarDiv2805" class="expedientesOcultos" style="display: none;"></div>
          </td>
          <td>EN GENERAL</td>
          <td>AFIRMATIVO</td>
          <td><a href="/votaciones/verActaVotacion/2805">descargar</a></td>
          <td>SIMPLE</td>
          <td><a href="/votaciones/detalleActa/2805">VER</a></td>
        </tr>
      </tbody></table>
    `
    const $ = cheerio.load(html)
    const rows = collectListedActas($, $('table#actasTable tbody tr'))
    expect(rows).toEqual([
      {
        id: 2805,
        titulo: 'Moción para el tratamiento sobre tablas del expediente S-1563/26.',
        fechaSesion: '2026-09-17',
      },
    ])
  })
})

describe('título del listado con expedientes', () => {
  it('incluye O.D. del div oculto y descarta los toggles y el paréntesis', () => {
    const html = `
      <table id="actasTable"><tbody>
        <tr>
          <td>19/11/2026</td>
          <td>15</td>
          <td class="ocultar">
            Transferencias de inmuebles del Estado Nacional.
            (
            <a onclick="mostrar(2889)" id="botonMostrar2889">Ver
              Expedientes</a>
            <div id="mostrarOcultarDiv2889" class="expedientesOcultos" style="display:none">
              <a onclick="ocultar(2889)">Ocultar Expedientes</a><br>
              <a href="/od/130" target="_blank">O.D. 130/2026  </a>
              , <a href="/od/131" target="_blank">O.D. 131/2026  </a>
            </div>
          </td>
          <td><a href="/votaciones/detalleActa/2889">VER</a></td>
        </tr>
      </tbody></table>
    `
    const $ = cheerio.load(html)
    const rows = collectListedActas($, $('table#actasTable tbody tr'))
    expect(rows[0]!.titulo).toBe(
      'Transferencias de inmuebles del Estado Nacional. O.D. 130/2026 , O.D. 131/2026',
    )
  })
})

describe('parseFechaSesionListado', () => {
  it('normaliza dd/MM/yyyy y el span oculto yyyyMMdd', () => {
    expect(parseFechaSesionListado('19/11/2026')).toBe('2026-11-19')
    expect(parseFechaSesionListado('7/1/2025')).toBe('2025-01-07')
    expect(parseFechaSesionListado('20260211 11/02/2026')).toBe('2026-02-11')
    expect(parseFechaSesionListado('')).toBeUndefined()
  })

  it('lee la celda real del listado con span oculto', () => {
    const html = `
      <table id="actasTable"><tbody>
        <tr>
          <td><span style="display:none">20261119</span> 19/11/2026</td>
          <td>7</td>
          <td>O.D. 418/2026</td>
          <td>EN GENERAL</td>
          <td>AFIRMATIVO</td>
          <td><a href="/votaciones/verActaVotacion/2885">descargar</a></td>
          <td>SIMPLE</td>
          <td><a href="/votaciones/detalleActa/2885">VER</a></td>
        </tr>
      </tbody></table>
    `
    const $ = cheerio.load(html)
    const rows = collectListedActas($, $('table#actasTable tbody tr'))
    expect(rows).toEqual([
      {
        id: 2885,
        titulo: 'O.D. 418/2026',
        fechaSesion: '2026-11-19',
      },
    ])
  })
})
