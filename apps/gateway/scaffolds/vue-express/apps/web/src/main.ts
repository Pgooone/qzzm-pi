import { createApp } from "vue"; import App from "./App.vue"; import { createRouter, createWebHistory } from "vue-router";
const router = createRouter({ history: createWebHistory(), routes: [
  { path: "/", component: () => import("./pages/Home.vue") },
  { path: "/about", component: () => import("./pages/About.vue") },
]});
createApp(App).use(router).mount("#app");
