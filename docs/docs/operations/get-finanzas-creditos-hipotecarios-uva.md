---
aside: false
outline: false
title: Créditos Hipotecarios UVA
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-finanzas-creditos-hipotecarios-uva">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-finanzas-creditos-hipotecarios-uva-footer.md -->

</template>

</OAOperation>
