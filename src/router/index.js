import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/layout/Home.vue';
import menuData from './menu';
import switchData from './switch';

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home,
        redirect: '/Map',
        children: [
            ...menuData,
            ...switchData.map(item => ({
                path: item.name,
                name: item.name,
                component: item.component
            }))
        ]
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: routes,
});

// 路由守卫：未登录跳转到登录页，已登录访问登录页自动跳转首页
router.beforeEach((to, from, next) => {
    const user = localStorage.getItem('user');
    if (to.name === 'UserLogin') {
        // 已登录访问登录页，自动跳转首页
        if (user) {
            next({ name: 'Map' });
        } else {
            next();
        }
        return;
    }
    // 其它页面未登录跳转到登录页
    if (!user) {
        next({ name: 'UserLogin' });
    } else {
        next();
    }
});

export default router;