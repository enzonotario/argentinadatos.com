export function buildOpenAISchemaProperties(schema, required) {
  const properties = {}
  const requiredFields = Object.keys(schema)

  requiredFields.forEach(key => {
    const isRequired = required ? required.includes(key) : true

    if (isRequired) {
      properties[key] = schema[key]
      return
    }

    properties[key] = {
      anyOf: [
        schema[key],
        {
          type: 'null',
        },
      ],
    }
  })

  return {
    properties,
    requiredFields,
  }
}
