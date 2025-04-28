export default [
    { path: 'Map', name: 'Map', component: () => import('../views/Map.vue') },
    { path: 'OpenMap', name: 'OpenMap', component: () => import('../views/dataService/OpenMap.vue') },
    { path: 'UserMap', name: 'UserMap', component: () => import('../views/dataService/UserMap.vue') },
    { path: 'StatMap', name: 'StatMap', component: () => import('../views/makeMap/StatMap.vue') },
    { path: 'HeatMap', name: 'HeatMap', component: () => import('../views/makeMap/HeatMap.vue') },
    { path: 'ColorTileMap', name: 'ColorTileMap', component: () => import('../views/makeMap/ColorTileMap.vue') },
    { path: 'ColorMap', name: 'ColorMap', component: () => import('../views/makeMap/ColorMap.vue') },
    { path: 'TextLabel', name: 'TextLabel', component: () => import('../views/label/TextLabel.vue') },
    { path: 'PopupLabel', name: 'PopupLabel', component: () => import('../views/label/PopupLabel.vue') },
    { path: 'ClusterLabel', name: 'ClusterLabel', component: () => import('../views/label/ClusterLabel.vue') },
    { path: 'GraSelect', name: 'GraSelect', component: () => import('../views/graEdit/GraSelect.vue') },
    { path: 'GraRotate', name: 'GraRotate', component: () => import('../views/graEdit/GraRotate.vue') },
    { path: 'GraMove', name: 'GraMove', component: () => import('../views/graEdit/GraMove.vue') },
    { path: 'DrawPolygon', name: 'DrawPolygon', component: () => import('../views/graDraw/DrawPolygon.vue') },
    { path: 'Drawdistance', name: 'Drawdistance', component: () => import('../views/graDraw/Drawdistance.vue') },
    { path: 'UserLogin', name: 'UserLogin', component: () => import('../views/UserLogin.vue') },
    { path: 'Message', name: 'Message', component: () => import('../views/layout/message.vue') }
];