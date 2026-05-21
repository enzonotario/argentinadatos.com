export function buildFirecrawlRequest({ url, prompt, schema, required }) {
  return {
    url,
    onlyMainContent: true,
    maxAge: 0,
    formats: [
      'markdown',
      {
        type: 'json',
        prompt,
        schema: {
          type: 'object',
          required: required || [],
          properties: schema || {},
        },
      },
    ],
  }
}
