import axios from 'axios'
import { getIolCredentials } from '../config.js'

const TOKEN_URL = 'https://api.invertironline.com/token'

/** Headers que IOL exige (bloquea requests sin Origin/Referer). */
const IOL_BROWSER_HEADERS = {
  Accept: '*/*',
  Origin: 'https://iol.apidocs.ar',
  Referer: 'https://iol.apidocs.ar/',
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
}

/**
 * Obtiene access_token de IOL.
 * La password puede contener *, +, =, @ — URLSearchParams los escapa bien.
 */
export async function fetchIolAccessToken() {
  const { username, password } = getIolCredentials()
  const body = new URLSearchParams({
    username,
    password,
    grant_type: 'password',
  })

  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: {
      ...IOL_BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 30_000,
  })

  if (!data?.access_token) {
    throw new Error('IOL token response missing access_token')
  }

  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 1200,
    refreshToken: data.refresh_token,
  }
}

export { IOL_BROWSER_HEADERS }
