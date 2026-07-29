---
aside: false
outline: false
title: Índice de Confianza en el Gobierno
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-politica-indices-confianza-gobierno">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-politica-indices-confianza-gobierno-footer.md -->

</template>

</OAOperation>
