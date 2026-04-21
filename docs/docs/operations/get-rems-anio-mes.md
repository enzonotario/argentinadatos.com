---
aside: false
outline: false
title: Relevamiento de Expectativas de Mercado (REM) por período
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-rems-anio-mes">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-rems-anio-mes-footer.md -->

</template>

</OAOperation>
