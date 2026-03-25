---
aside: false
outline: false
title: Dólar por casa y fecha
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-cotizaciones-dolares-casa-fecha">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-cotizaciones-dolares-casa-fecha-footer.md -->

</template>

</OAOperation>
