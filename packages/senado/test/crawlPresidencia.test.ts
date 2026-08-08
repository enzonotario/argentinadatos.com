import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import {
  crawlPresidencia,
  parsePresidenciaHtml,
  PRESIDENCIA_ENDPOINT,
} from '../src/senadores/crawlPresidencia'

const FIXTURE_HTML = `
<html><body>
  <div class="col-xs-12">
    <div class="col-sm-12 col-md-2" align="center">
      <img border=0 src="/bundles/senadoportal/webNueva/images/autoridades/presidente.gif" alt="Foto Presidente de la Cámara" style="width: 110px; border-radius: 50%;" />
    </div>
    <div class="col-sm-12 col-md-5" align="left" style="padding-top:20px;">
      <div style="font-size:1.6em;">Victoria Eugenia Villarruel</div>
      <div style="color: #005CA9;">Presidente del Senado de la Nación</div>
      Período 10/12/2023 - 09/12/2027<br>
    </div>
    <div class="col-sm-12 col-md-3" align="left" style="padding-top:20px;">
      Av. Hipólito Yrigoyen 1849<br>
      Ciudad de Buenos Aires, Argentina<br>
      Te. +(54 11) 2822-3000 Int. 1179<br>
      <a href="mailto:presidencia@senado.gov.ar">presidencia@senado.gob.ar</a>
    </div>
  </div>
  <div class="tab-pane" id="1">
    <h1>Currículum Vitae</h1>
    <p>Curriculum No disponible</p>
  </div>
</body></html>
`

describe('parsePresidenciaHtml', () => {
  it('extrae nombre, cargo, período, contacto y foto', () => {
    const parsed = parsePresidenciaHtml(FIXTURE_HTML)
    expect(parsed).toMatchObject({
      nombre: 'Victoria Eugenia Villarruel',
      cargo: 'Presidente del Senado de la Nación',
      periodoInicio: '2023-12-10',
      periodoFin: '2027-12-09',
      email: 'presidencia@senado.gob.ar',
      telefono: '+(54 11) 2822-3000 Int. 1179',
      curriculum: null,
    })
    expect(parsed.fotoSrc).toContain('/autoridades/presidente.gif')
    expect(parsed.direccion).toMatch(/Hipólito Yrigoyen 1849/i)
  })
})

describe('crawlPresidencia', () => {
  it(
    'scrapea senado.gob.ar/presidencia y persiste endpoint',
    { timeout: 60_000 },
    async () => {
      const result = await crawlPresidencia()
      expect(result.nombre).toMatch(/Villarruel/i)
      expect(result.cargo).toMatch(/Presidente/i)
      expect(result.periodoInicio).toBeTruthy()
      expect(result.periodoFin).toBeTruthy()
      expect(result.fuente).toContain('/presidencia')
      expect(result.foto).toMatch(/\/static\/senado\/presidencia\/presidente\./)

      const persisted = JSON.parse(readEndpoint(PRESIDENCIA_ENDPOINT) || 'null')
      expect(persisted).toMatchObject({
        nombre: result.nombre,
        foto: result.foto,
      })
    },
  )
})
