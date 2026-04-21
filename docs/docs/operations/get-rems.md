---
aside: false
outline: false
title: Relevamientos de Expectativas de Mercado (REM)
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-rems">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-rems-footer.md -->

</template>

</OAOperation>
