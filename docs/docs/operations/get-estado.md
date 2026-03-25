---
aside: false
outline: false
title: Estado de la API
---

<script setup>
import { useRoute } from 'vitepress'
import { OAMarkdown } from 'vitepress-openapi/client'

const route = useRoute()
</script>

<OAOperation operation-id="get-estado">

<template #footer="footer">

<!--@include: ./parts/get-estado-footer.md -->

</template>

</OAOperation>
