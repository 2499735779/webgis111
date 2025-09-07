import { createApp } from 'vue'
import { createPinia } from 'pinia'

// 引入element资源
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn'

// 引入ol样式，类文件按需引入
import 'ol/ol.css'

import App from './App.vue'
import router from './router'

import './assets/main.css'
import axios from 'axios';
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL;
const app = createApp(App)

// 定义全局变量 cxApp，用于存储天地图密钥
window.cxApp = {
  tianKey: 'a3e0d3a737dcf8bdddda60da5bc27556' // 替换为你的实际密钥
}

window.app1 = app
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 引入全局样式覆盖文件
import './views/graDraw/overrideStyles.css'

// 引入全局弹窗样式修复
import '@/assets/dialog-fix.css'  // 显式导入全局样式文件

app.mount('#app')