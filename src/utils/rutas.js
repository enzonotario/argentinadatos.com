import fs from 'node:fs'

export function escribirRuta(ruta, contenido, minificar = false) {
  const directorio = `datos/v1/${ruta}`

  try {
    fs.mkdirSync(directorio, {
      recursive: true,
    })

    contenido = JSON.stringify(contenido, null, minificar ? 0 : 2)

    fs.writeFileSync(`${directorio}/index.json`, contenido)

    return contenido
  } catch (error) {
    console.error(error)

    return false
  }
}

export function expandirRuta(ruta, contenido, minificar = false) {
  const directorio = `datos/v1/${ruta}`

  try {
    fs.mkdirSync(directorio, {
      recursive: true,
    })

    const archivo = `${directorio}/index.json`

    if (!fs.existsSync(archivo)) {
      fs.writeFileSync(archivo, '[]')
    }

    const items = JSON.parse(fs.readFileSync(archivo, 'utf8'))

    contenido = JSON.stringify(
      [...items, ...contenido],
      null,
      minificar ? 0 : 2,
    )

    fs.writeFileSync(archivo, contenido)

    return contenido
  } catch (error) {
    console.error(error)

    return false
  }
}

export function leerRuta(ruta) {
  if (ruta.startsWith('/')) {
    ruta = ruta.slice(1)
  }

  const directorio = `datos/v1/${ruta}`

  try {
    const contenido = fs.readFileSync(`${directorio}/index.json`, 'utf8')

    return JSON.parse(contenido)
  } catch (error) {
    console.error(error)

    return null
  }
}

export function existeRuta(ruta) {
  if (ruta.startsWith('/')) {
    ruta = ruta.slice(1)
  }

  const directorio = `datos/v1/${ruta}`

  try {
    return fs.existsSync(`${directorio}/index.json`)
  } catch (error) {
    console.error(error)

    return false
  }
}
