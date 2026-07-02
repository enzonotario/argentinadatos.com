import fs from 'node:fs'
import ruta from 'node:path'

export async function actualizarOpenApiAño() {
  const rutaOpenApi = ruta.resolve('docs/public/openapi.json')
  const especificacion = JSON.parse(fs.readFileSync(rutaOpenApi, 'utf8'))

  const añoActual = new Date().getFullYear()

  const rutasAActualizar = [
    '/v1/feriados/{año}',
    '/v1/feriados-bancarios/{año}',
    '/v1/senado/actas/{año}',
    '/v1/diputados/actas/{año}',
    '/v1/diputados/diputados/{legislatura}',
  ]

  rutasAActualizar.forEach(ruta => {
    if (especificacion.paths[ruta]) {
      const parametros = especificacion.paths[ruta].get.parameters
      const parametro = parametros.find(p => p.name === 'año' || p.name === 'legislatura')

      if (parametro) {
        parametro.schema.maximum = añoActual
        parametro.example = añoActual
      }
    }
  })

  fs.writeFileSync(rutaOpenApi, JSON.stringify(especificacion, null, 2), 'utf8')
  console.log(`OpenAPI actualizado con el año ${añoActual}`)
}
