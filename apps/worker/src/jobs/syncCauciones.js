import { fetchIolAccessToken } from '../iol/auth.js'
import { fetchCauciones } from '../iol/fetchCauciones.js'
import { replaceCauciones } from '../pocketbase/caucionesRepository.js'

export async function syncCauciones() {
  const { accessToken } = await fetchIolAccessToken()
  const payload = await fetchCauciones(accessToken)
  const result = await replaceCauciones(payload)

  return {
    titulos: payload.titulos.length,
    created: result.created,
    byMoneda: result.byMoneda,
    fechaOperacion: result.fechaOperacion,
    fechaActualizacion: result.fechaActualizacion,
  }
}
