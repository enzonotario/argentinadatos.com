const FIRECRAWL_API_URL = `${import.meta.env.VITE_FIRECRAWL_BASE_URL}/v2/scrape`
const FIRECRAWL_API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY

export function getFirecrawlApiUrl() {
  return FIRECRAWL_API_URL
}

export async function requestFirecrawl(requestBody) {
  return fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  })
}
