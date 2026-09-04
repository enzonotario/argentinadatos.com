import axios from 'axios'
import { getStaticPath } from '@argentinadatos/core/src/utils/getStaticPath.ts'
import { readStaticBuffer } from '@argentinadatos/core/src/utils/readStaticBuffer.ts'
import { writeStaticBuffer } from '@argentinadatos/core/src/utils/writeStaticBuffer.ts'

export const BASE_URL = 'https://www.senado.gob.ar/votaciones/verActaVotacion/'

function isPdfBuffer(data: Buffer): boolean {
  return data.length > 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46
}

/**
 * Devuelve la ruta absoluta en disco (PdfDataParser necesita file path).
 * No guarda HTML de error como .pdf.
 */
export async function downloadPdf(actaId: number): Promise<string | null> {
  const relative = `/senado/actas/pdf/${actaId}.pdf`
  const absolute = getStaticPath(relative)

  const currentPdf = readStaticBuffer(relative)
  if (currentPdf && isPdfBuffer(currentPdf)) {
    return absolute
  }

  const url = `${BASE_URL}${actaId}`

  try {
    const response = await axios.get(url, {
      headers: { Accept: 'application/pdf' },
      responseType: 'arraybuffer',
      timeout: 30_000,
      validateStatus: status => status >= 200 && status < 300,
    })

    const data = Buffer.from(response.data)
    if (!isPdfBuffer(data)) {
      console.warn(`Acta ${actaId}: respuesta no es PDF (${data.length} bytes)`)
      return null
    }

    writeStaticBuffer(relative, data)
    return absolute
  }
  catch (error: any) {
    console.warn(`Acta ${actaId}: no se pudo descargar PDF`, error?.message || error)
    return null
  }
}
