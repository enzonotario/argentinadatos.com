function readEnv(name: string): string | undefined {
  const fromImport = (import.meta as any).env?.[name]
  if (typeof fromImport === 'string' && fromImport.trim()) {
    return fromImport.trim()
  }
  const fromProcess = process.env[name]
  if (typeof fromProcess === 'string' && fromProcess.trim()) {
    return fromProcess.trim().replace(/^["']|["']$/g, '')
  }
  return undefined
}

export function getFirecrawlApiUrl(): string {
  const base = readEnv('VITE_FIRECRAWL_BASE_URL')
  if (!base) {
    throw new Error('Falta VITE_FIRECRAWL_BASE_URL')
  }
  return `${base.replace(/\/$/, '')}/v2/scrape`
}

export function hasFirecrawlCredentials(): boolean {
  return Boolean(readEnv('VITE_FIRECRAWL_BASE_URL') && readEnv('VITE_FIRECRAWL_API_KEY'))
}

export async function requestFirecrawl(requestBody: unknown): Promise<Response> {
  const apiKey = readEnv('VITE_FIRECRAWL_API_KEY')
  if (!apiKey) {
    throw new Error('Falta VITE_FIRECRAWL_API_KEY')
  }

  return fetch(getFirecrawlApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })
}
