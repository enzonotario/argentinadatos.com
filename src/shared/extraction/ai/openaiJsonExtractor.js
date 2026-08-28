import { logMensaje } from '@/log.js'
import { buildOpenAISchemaProperties } from './buildOpenAISchemaProperties.js'
import { requestOpenAI } from './openaiClient.js'

function buildOpenAIRequestBody({ markdown, prompt, schema, required }) {
  const { properties, requiredFields } = buildOpenAISchemaProperties(
    schema,
    required,
  )

  return {
    model: 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert data extractor. Return the requested information as JSON and follow the provided schema. If an optional value is missing, return null. Do not invent data.',
      },
      {
        role: 'user',
        content: `Markdown:\n${markdown}\n\nInstruction: ${prompt}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'data_extractor',
        strict: true,
        schema: {
          type: 'object',
          properties,
          required: requiredFields,
          additionalProperties: false,
        },
      },
    },
  }
}

function assertValidOpenAIResponse(payload) {
  if (!payload.choices?.[0]?.message?.content) {
    throw new Error('Invalid OpenAI response payload')
  }

  return JSON.parse(payload.choices[0].message.content)
}

export async function extractStructuredDataWithOpenAI(
  log,
  { markdown, prompt, schema, required, url },
) {
  const requestBody = buildOpenAIRequestBody({
    markdown,
    prompt,
    schema,
    required,
  })

  logMensaje(log, 'Markdown ready, starting OpenAI extraction', {
    url,
  })

  const response = await requestOpenAI(requestBody)

  if (!response.ok) {
    const responseText = await response.text()

    logMensaje(log, 'OpenAI returned a non-OK response', {
      status: response.status,
      statusText: response.statusText,
      url,
      responseBody: responseText,
    })

    throw new Error(
      `OpenAI request failed: ${response.status} ${response.statusText}. URL: ${url}`,
    )
  }

  const payload = await response.json()
  const result = assertValidOpenAIResponse(payload)

  logMensaje(log, 'OpenAI extraction succeeded', {
    url,
    data: result,
  })

  return result
}
