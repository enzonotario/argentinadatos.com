import axios from 'axios'

export async function obtenerFilasDeSheets(spreadsheetId, rango) {
  const apiKey = import.meta.env.VITE_GSHEETS_API_KEY

  if (!apiKey) {
    throw new Error('VITE_GSHEETS_API_KEY debe estar definido')
  }

  if (!spreadsheetId) {
    throw new Error('spreadsheetId debe estar definido')
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rango}?key=${apiKey}`

  const respuesta = await axios.get(url)

  if (
    !respuesta.data ||
    !respuesta.data.values ||
    respuesta.data.values.length === 0
  ) {
    return []
  }

  return respuesta.data.values
}
