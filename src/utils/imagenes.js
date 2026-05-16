import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

export function normalizarNombre(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function descargarImagen(url, directorio, nombreArchivo) {
  if (!url) return null

  const rutaDirectorio = path.join('datos', 'static', directorio)

  if (!fs.existsSync(rutaDirectorio)) {
    fs.mkdirSync(rutaDirectorio, {
      recursive: true,
    })
  }

  const extension = (path.extname(url.split('?')[0]) || '.png').toLowerCase()

  const nombreFinal = `${nombreArchivo}${extension}`
  const rutaArchivo = path.join(rutaDirectorio, nombreFinal)

  if (fs.existsSync(rutaArchivo)) {
    return `https://api.argentinadatos.com/static/${directorio}/${nombreFinal}`
  }

  const headers = {
    'User-Agent':
      'ArgentinaDatosBot/1.0 (https://argentinadatos.com; hi@argentinadatos.com)',
  }

  try {
    const respuesta = await fetch(url, {
      headers,
    })

    if (!respuesta.ok) throw new Error(`Fallo al descargar ${url}`)

    await pipeline(respuesta.body, fs.createWriteStream(rutaArchivo))

    return `https://api.argentinadatos.com/static/${directorio}/${nombreFinal}`
  } catch (error) {
    console.error(`Error descargando imagen desde ${url}:`, error)
    return null
  }
}
