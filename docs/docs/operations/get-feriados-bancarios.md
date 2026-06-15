---
aside: false
outline: false
title: Feriados bancarios
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-feriados-bancarios">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer>

<!--@include: ./parts/get-feriados-bancarios-footer.md -->

</template>

</OAOperation>
