import axios from 'axios'
import { expect, it } from 'vitest'
import {
  idDesdeHrefVotacion,
  maxIdDesdeHomeHtml,
  parseActa,
  urlVotacion,
} from '../src/diputados/actas/crawlActas'

it('lee el id más alto de links votacion/ID (con o sin .html)', () => {
  const html = `
    <a href="votacion/6025.html">6025</a>
    <a href="/votacion/6023">6023</a>
    <a href="/votacion/6091" id="button-6091">ver</a>
  `
  expect(maxIdDesdeHomeHtml(html)).toBe(6091)
  expect(idDesdeHrefVotacion('votacion/6026.html')).toBe(6026)
  expect(idDesdeHrefVotacion('/votacion/6091')).toBe(6091)
  expect(idDesdeHrefVotacion(urlVotacion(6026))).toBe(6026)
  expect(urlVotacion(6026)).toBe('https://votaciones.hcdn.gob.ar/votacion/6026')
})

it('parsea el acta 6026 y la 6091 con el HTML rediseñado', async () => {
  const response = await axios.get(urlVotacion(6026), {
    timeout: 30_000,
    validateStatus: status => status < 500,
  })
  expect(response.status).toBe(200)

  const acta = parseActa('6026', response.data)
  expect(acta).toMatchObject({
    id: '6026',
    titulo: expect.stringContaining('GIUDICI'),
    resultado: 'afirmativo',
  })
  expect(acta?.fecha.getUTCFullYear()).toBe(2026)
  expect(acta?.votos.length).toBeGreaterThan(200)
  expect(acta?.votos[0]?.imagen).toMatch(/^https:\/\/votaciones\.hcdn\.gob\.ar\//)

  const r6091 = await axios.get(urlVotacion(6091), {
    timeout: 30_000,
    validateStatus: status => status < 500,
  })
  expect(r6091.status).toBe(200)
  const acta6091 = parseActa('6091', r6091.data)
  expect(acta6091).toMatchObject({
    id: '6091',
    periodo: '144',
    reunion: '11',
    numeroActa: '27',
    titulo: expect.stringContaining('GUILLERMO BROWN'),
    resultado: 'afirmativo',
    presidente: 'Menem, Martin',
    votosAfirmativos: 200,
    votosNegativos: 0,
    abstenciones: 0,
    ausentes: 56,
    sinVotar: 1,
  })
  expect(acta6091?.votos.length).toBe(257)
})
