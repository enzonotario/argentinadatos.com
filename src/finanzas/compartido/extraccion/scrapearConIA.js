import { logMensaje, logError } from '@/log.js'
import { obtenerMarkdownDefuddleDesdeUrl } from '@/finanzas/compartido/extraccion/defuddle.js'

const TABSTACK_API_URL = 'https://api.tabstack.ai/v1/extract/markdown'
const TABSTACK_API_KEY = import.meta.env.VITE_TABSTACK_API_KEY
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

function construirPropiedadesParaOpenAI(schema, required) {
  const propiedades = {}
  const listaRequeridos = Object.keys(schema)

  listaRequeridos.forEach(llave => {
    const esRequeridoPorExtractor = required ? required.includes(llave) : true

    if (esRequeridoPorExtractor) {
      propiedades[llave] = schema[llave]
    } else {
      // Si no es requerido por el extractor, permitimos null para strict: true
      propiedades[llave] = {
        anyOf: [
          schema[llave],
          {
            type: 'null',
          },
        ],
      }
    }
  })

  return {
    propiedades,
    listaRequeridos,
  }
}

async function extraerConOpenAI(
  log,
  { markdown, prompt, schema, required, url },
) {
  const { propiedades, listaRequeridos } = construirPropiedadesParaOpenAI(
    schema,
    required,
  )

  logMensaje(log, 'Markdown listo, iniciando extracción con OpenAI', {
    url,
  })

  const bodyOpenAI = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Eres un extractor de datos experto. Extrae la información solicitada en formato JSON siguiendo el esquema proporcionado. Si no encuentras un dato opcional, devuelve null. No inventes datos.',
      },
      {
        role: 'user',
        content: `Markdown:\n${markdown}\n\nInstrucción: ${prompt}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'extractor_datos',
        strict: true,
        schema: {
          type: 'object',
          properties: propiedades,
          required: listaRequeridos,
          additionalProperties: false,
        },
      },
    },
  }

  const respuestaOpenAI = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(bodyOpenAI),
  })

  if (!respuestaOpenAI.ok) {
    const respuestaTexto = await respuestaOpenAI.text()

    logMensaje(log, 'Respuesta no OK de OpenAI', {
      status: respuestaOpenAI.status,
      statusText: respuestaOpenAI.statusText,
      url,
      respuestaBody: respuestaTexto,
    })
    throw new Error(
      `Error en OpenAI: ${respuestaOpenAI.status} ${respuestaOpenAI.statusText}. URL: ${url}`,
    )
  }

  const datosOpenAI = await respuestaOpenAI.json()

  if (
    !datosOpenAI.choices ||
    !datosOpenAI.choices[0] ||
    !datosOpenAI.choices[0].message
  ) {
    throw new Error('Datos inválidos de OpenAI')
  }

  const resultado = JSON.parse(datosOpenAI.choices[0].message.content)

  logMensaje(log, 'Extracción con IA exitosa', {
    url,
    datos: resultado,
  })

  return resultado
}

async function obtenerMarkdownConTabstack(log, url) {
  logMensaje(log, 'Iniciando extracción de markdown con Tabstack', {
    url,
  })

  const respuestaTabstack = await fetch(TABSTACK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${TABSTACK_API_KEY}`,
    },
    body: JSON.stringify({
      geo_target: {
        country: 'AR',
      },
      metadata: false,
      nocache: true,
      url,
    }),
  })

  if (!respuestaTabstack.ok) {
    const respuestaTexto = await respuestaTabstack.text()

    logMensaje(log, 'Respuesta no OK de Tabstack', {
      status: respuestaTabstack.status,
      statusText: respuestaTabstack.statusText,
      url,
      respuestaBody: respuestaTexto,
    })
    throw new Error(
      `Error en Tabstack: ${respuestaTabstack.status} ${respuestaTabstack.statusText}. URL: ${url}`,
    )
  }

  const datosTabstack = await respuestaTabstack.json()
  const markdown = datosTabstack.content

  if (!markdown) {
    throw new Error(`No se obtuvo markdown de Tabstack para URL: ${url}`)
  }

  return markdown
}

async function obtenerMarkdownDirecto(log, url) {
  logMensaje(log, 'Iniciando extracción de markdown directo', {
    url,
  })

  const respuesta = await fetch(url, {
    method: 'GET',
  })

  if (!respuesta.ok) {
    const respuestaTexto = await respuesta.text()

    logMensaje(log, 'Respuesta no OK en markdown directo', {
      status: respuesta.status,
      statusText: respuesta.statusText,
      url,
      respuestaBody: respuestaTexto,
    })
    throw new Error(
      `Error obteniendo markdown directo: ${respuesta.status} ${respuesta.statusText}. URL: ${url}`,
    )
  }

  const markdown = await respuesta.text()

  if (!markdown || markdown.trim() === '') {
    throw new Error(`No se obtuvo markdown directo para URL: ${url}`)
  }

  return markdown
}

async function obtenerMarkdownDefuddle(log, url) {
  logMensaje(log, 'Iniciando extracción de markdown con Defuddle (npm)', {
    url,
  })
  return await obtenerMarkdownDefuddleDesdeUrl(url)
}

export async function scrapearConIA(log, configuracion) {
  const {
    url,
    prompt,
    schema,
    required,
    markdown,
    fuenteMarkdown = 'tabstack',
  } = configuracion

  try {
    var markdownFinal = markdown

    if (!markdownFinal) {
      markdownFinal =
        fuenteMarkdown === 'directo'
          ? await obtenerMarkdownDirecto(log, url)
          : fuenteMarkdown === 'defuddle'
            ? await obtenerMarkdownDefuddle(log, url)
            : await obtenerMarkdownConTabstack(log, url)
    }

    return await extraerConOpenAI(log, {
      markdown: markdownFinal,
      prompt,
      schema,
      required,
      url,
    })
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al scrapear con IA', {
      url: configuracion.url,
      errorMessage: error.message,
    })
    throw error
  }
}
