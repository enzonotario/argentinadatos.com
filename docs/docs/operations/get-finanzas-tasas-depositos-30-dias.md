---
aside: false
outline: false
title: Depósitos a 30 días
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-finanzas-tasas-depositos-30-dias">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-finanzas-tasas-depositos-30-dias-footer.md -->

</template>

</OAOperation>
