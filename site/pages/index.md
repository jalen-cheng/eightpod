---
layout: false
title: SevenSleep documentation
search: false
---

<script setup>
import { onMounted } from 'vue';
import { withBase } from 'vitepress';

// The site has no landing page: its address opens Getting started. The config adds the same
// redirect to the page's head, for a browser that gets there before this script runs.
onMounted(() => window.location.replace(withBase('/getting-started')));
</script>

<a :href="withBase('/getting-started')">Getting started</a>
