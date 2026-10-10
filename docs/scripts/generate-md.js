import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useOpenapi } from 'vitepress-openapi/client'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const operationsDir = path.resolve(scriptDir, '../docs/operations')
const specPath = path.resolve(scriptDir, '../public/openapi.json')

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))

const openapi = useOpenapi({ spec })

export function init() {
  for (const apiPath of Object.keys(spec.paths)) {
    const operation = spec.paths[apiPath].get
    if (!operation?.operationId) continue

    const filePath = path.join(operationsDir, `${operation.operationId}.md`)
    if (fs.existsSync(filePath)) continue

    fs.writeFileSync(filePath, generateMarkdown(operation.operationId))
  }
}

function generateMarkdown(operationId) {
  const operation = openapi.getOperation(operationId)

  const dataSource = operation['x-data-source']
    ? `
<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>
`
    : ''

  const footerFile = path.join(
    operationsDir,
    'parts',
    `${operationId}-footer.md`,
  )
  const footer = fs.existsSync(footerFile)
    ? `
<template #footer="footer">

<!--@include: ./parts/${operationId}-footer.md -->

</template>
`
    : ''

  return `---
aside: false
outline: false
title: ${operation.summary}
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="${operationId}">
${dataSource}${footer}
</OAOperation>
`
}

try {
  init()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
