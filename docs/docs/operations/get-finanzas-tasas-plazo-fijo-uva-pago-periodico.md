---
aside: false
outline: false
title: Plazo fijo UVA con pago periódico de intereses
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-finanzas-tasas-plazo-fijo-uva-pago-periodico">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-finanzas-tasas-plazo-fijo-uva-pago-periodico-footer.md -->

</template>

</OAOperation>
