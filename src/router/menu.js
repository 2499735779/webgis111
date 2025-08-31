export default [
    { path: 'Map', name: 'Map', component: () => import('../views/Map.vue') },
    { path: 'UserMap', name: 'UserMap', component: () => import('../views/dataService/UserMap.vue') },
    { path: 'Drawdistance', name: 'Drawdistance', component: () => import('../views/graDraw/Drawdistance.vue') },
    { path: 'UserLogin', name: 'UserLogin', component: () => import('../views/UserLogin.vue') },
    { path: 'UserRegister', name: 'UserRegister', component: () => import('../views/UserRegister.vue') },
    { path: 'Message', name: 'Message', component: () => import('../views/layout/message.vue') }
];