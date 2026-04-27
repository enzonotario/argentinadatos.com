---
aside: false
outline: false
title: Cuentas remuneradas en USD
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-finanzas-cuentas-remuneradas-usd">

<template #description="description">

<OAMarkdown :content="description.operation.description"></OAMarkdown>

<DataSources :sources="description.operation['x-data-source']" />

</template>

<template #footer="footer">

<!--@include: ./parts/get-finanzas-cuentas-remuneradas-usd-footer.md -->

</template>

</OAOperation>
