const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_KEY
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export async function requestOpenAI(body) {
  return fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://argentinadatos.com',
      'X-OpenRouter-Title': 'ArgentinaDatos',
    },
    body: JSON.stringify(body),
  })
}
