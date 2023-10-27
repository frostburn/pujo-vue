import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue')
    },
    {
      path: '/play-online',
      name: 'play-online',
      component: () => import('../views/OnlineView.vue')
    },
    {
      path: '/play-realtime',
      name: 'play-realtime',
      component: () => import('../views/RealtimeView.vue')
    },
    {
      path: '/play-cpu',
      name: 'play-cpu',
      component: () => import('../views/LocalView.vue')
    },
    {
      path: '/replay',
      name: 'replay',
      component: () => import('../views/ReplayView.vue')
    }
  ]
})

export default router
