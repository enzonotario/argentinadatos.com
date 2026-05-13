---
aside: false
outline: false
title: Variables
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-finanzas-fci-variables-fecha">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-finanzas-fci-variables-fecha-footer.md -->

</template>

</OAOperation>
