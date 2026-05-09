<template><div><h1 style="font-size:2rem;font-weight:700">__PROJECT_NAME__</h1><p style="margin-top:1rem;color:#666">API 状态: {{ data ? JSON.stringify(data) : '加载中...' }}</p></div></template>
<script setup lang="ts">import { ref, onMounted } from "vue"; const data = ref<any>(null); onMounted(async () => { const r = await fetch("/api/health"); data.value = await r.json(); });</script>
