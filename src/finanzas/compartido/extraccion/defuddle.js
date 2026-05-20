import { Defuddle } from 'defuddle/node'

/**
 * Convierte HTML en markdown usando el paquete Defuddle (entorno Node).
 * @see https://defuddle.md/docs
 */
export async function htmlAMarkdownConDefuddle(html, pageUrl) {
  if (!html || html.trim() === '') {
    throw new Error('html vacío para Defuddle')
  }

  const resultado = await Defuddle(html, pageUrl, {
    markdown: true,
  })

  const md = resultado.content

  if (!md || md.trim() === '') {
    throw new Error(`Defuddle no devolvió contenido markdown para ${pageUrl}`)
  }

  return md
}

export async function obtenerMarkdownDefuddleDesdeUrl(pageUrl) {
  const respuesta = await fetch(pageUrl, {
    method: 'GET',
  })

  if (!respuesta.ok) {
    throw new Error(
      `Error obteniendo HTML para Defuddle: ${respuesta.status} ${respuesta.statusText}. URL: ${pageUrl}`,
    )
  }

  const html = await respuesta.text()

  return await htmlAMarkdownConDefuddle(html, pageUrl)
}
