/**
 * Cliente mínimo de PocketBase para lecturas server-side.
 * URL/token vía env (mismo pair que el worker).
 */
export function getPocketBaseConfigFromEnv() {
  const url = (
    process.env.POCKETBASE_URL ||
    'https://db.argentinadatos.com'
  ).replace(/\/+$/, '')
  const token = process.env.POCKETBASE_TOKEN
  if (!token) {
    throw new Error('Missing POCKETBASE_TOKEN')
  }
  return { url, token }
}

export async function listAllRecords(collection, { sort = '' } = {}) {
  const { url, token } = getPocketBaseConfigFromEnv()
  const items = []
  let page = 1
  const perPage = 200

  for (;;) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    })
    if (sort) params.set('sort', sort)

    const response = await fetch(
      `${url}/api/collections/${collection}/records?${params}`,
      {
        headers: {
          Authorization: token,
          Accept: 'application/json',
        },
      },
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `PocketBase list ${collection} failed: ${response.status} ${body}`,
      )
    }

    const data = await response.json()
    items.push(...(data.items ?? []))
    if (page >= (data.totalPages ?? 1)) break
    page += 1
  }

  return items
}
