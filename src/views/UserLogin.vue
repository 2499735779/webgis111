<template>
  <div class="login-mask">
    <div class="login-card">
      <div class="gamepad-bg"></div>
      <div class="card-content">
        <h2 class="login-title">欢迎登录</h2>
        <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
          <div class="login-fields-group">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="form.username" autocomplete="off" placeholder="请输入用户名" class="narrow-input" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="form.password" type="password" autocomplete="off" placeholder="请输入密码" show-password @keyup.enter="onLogin" class="narrow-input" />
            </el-form-item>
          </div>
          <el-form-item>
            <el-button type="primary" @click="onLogin" :loading="loading" class="narrow-btn">
              {{ loading ? '登录中...' : '登录' }}
            </el-button>
          </el-form-item>
          <!-- 删除原有的表单内提示 -->
          <!-- <el-form-item v-if="msg">
            <span :class="['msg', { 'success': isSuccess }]">{{ msg }}</span>
          </el-form-item> -->
          <div class="register-link">
            未注册账号？<el-button type="text" @click="goToRegister">点击注册</el-button>
          </div>
        </el-form>
        <!-- 顶部浮动提示 -->
        <transition name="fade">
          <div v-if="showTopMsg" :class="['login-top-msg', { success: isSuccess }]">
            {{ msg }}
          </div>
        </transition>
      </div>
      <!-- 游戏手柄装饰元素 -->
      <div class="gamepad-decorations">
        <!-- 左手柄区域：只保留放大的方向键，居中 -->
        <div class="left-handle">
          <div class="d-pad d-pad-large">
            <div class="d-pad-vertical"></div>
            <div class="d-pad-horizontal"></div>
          </div>
        </div>
        <!-- 右手柄区域：只保留放大的YXAB，居中 -->
        <div class="right-handle">
          <div class="action-buttons action-buttons-large">
            <div class="action-btn btn-y">Y</div>
            <div class="action-btn btn-x">X</div>
            <div class="action-btn btn-b">B</div>
            <div class="action-btn btn-a">A</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const form = ref({ username: '', password: '' })
const msg = ref('')
const isSuccess = ref(false)
const loading = ref(false)
const formRef = ref()

// 顶部浮动提示控制
const showTopMsg = ref(false)
let topMsgTimer = null

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

onMounted(() => {
  // 检查是否已登录
  const user = localStorage.getItem('user')
  if (user) {
    try {
      const userData = JSON.parse(user)
      if (userData.username) {
        router.push({ name: 'Map' })
        return
      }
    } catch (e) {
      localStorage.removeItem('user')
    }
  }
})

const handleLogin = async () => {
  formRef.value.validate(async valid => {
    if (!valid) {
      return
    }
    loading.value = true
    msg.value = ''
    isSuccess.value = false
    try {
      const res = await axios.post('/api/user-login', {
        username: form.value.username,
        password: form.value.password,
      })
      if (res.data.success) {
        msg.value = '登录成功'
        isSuccess.value = true
        showTopMsg.value = true
        clearTimeout(topMsgTimer)
        topMsgTimer = setTimeout(() => {
          showTopMsg.value = false
        }, 2000)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        setTimeout(() => {
          router.push({ name: 'Map' }).then(() => {
            window.location.reload()
          })
        }, 1000)
      } else {
        msg.value = res.data.message || '用户名或密码错误'
        isSuccess.value = false
        showTopMsg.value = true
        clearTimeout(topMsgTimer)
        topMsgTimer = setTimeout(() => {
          showTopMsg.value = false
        }, 2000)
      }
    } catch (e) {
      console.error("登录请求发生错误：", e)
      msg.value = e.response?.data?.message || '网络错误，请稍后重试'
      isSuccess.value = false
      showTopMsg.value = true
      clearTimeout(topMsgTimer)
      topMsgTimer = setTimeout(() => {
        showTopMsg.value = false
      }, 2000)
    } finally {
      loading.value = false
    }
  })
}

const onLogin = handleLogin

const goToRegister = () => {
  router.push({ name: 'UserRegister' })
}
</script>

<style scoped>
.login-mask {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  width: 100vw;
  height: 100vh;
  z-index: 30000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(3px);
  pointer-events: auto;
}

.login-card {
  width: 680px;
  height: 320px;
  position: relative;
  pointer-events: auto;
  animation: slideUp 0.3s ease-out;
  border-radius: 56px/90px; /* 更圆润的椭圆角 */
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 18px rgba(255,255,255,0.04) inset;
  margin-left: -32px; /* 整体左移一点 */
}

/* 游戏手柄背景 */
.gamepad-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* 移除 border-radius 和 clip-path，让背景铺满整个卡片 */
  box-shadow: 
    0 8px 32px rgba(0,0,0,0.3),
    inset 0 2px 8px rgba(255,255,255,0.1),
    inset 0 -2px 8px rgba(0,0,0,0.1);
}

/* 左右两侧增加柔和渐变阴影，模拟曲线过渡 */
.login-card::before,
.login-card::after {
  content: "";
  position: absolute;
  top: 0;
  width: 55px;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.login-card::before {
  left: 0;
  background: linear-gradient(to right, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.01) 100%);
  border-top-left-radius: 56px 90px;
  border-bottom-left-radius: 56px 90px;
}
.login-card::after {
  right: 0;
  background: linear-gradient(to left, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.01) 100%);
  border-top-right-radius: 56px 90px;
  border-bottom-right-radius: 56px 90px;
}

.card-content {
  position: relative;
  z-index: 2;
  padding: 40px 120px 30px 110px; /* 左侧padding由120px增至130px，右侧由120px减至110px */
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-title {
  text-align: center; /* 居中 */
  margin-left: 0;     /* 去除左移 */
  margin-bottom: 30px;
  color: #fff;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

/* 控制输入框和按钮宽度并居中 */
.narrow-input {
  width: 600px !important;   /* 修改这里，调整为你想要的宽度 */
  margin: 0 auto;
  display: block;
}
.narrow-btn {
  width: 200px !important;
  margin: 0 auto;
  display: block;
  transform: translateX(-20px); /* 向左平移80px，可根据需要调整 */
}

.gamepad-decorations {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

/* 左手柄区域 */
.left-handle {
  position: absolute;
  left: 30px;    /* 向右平移 */
  top: 60%;      /* 向下平移 */
  transform: translateY(-50%);
  width: 200px;  /* 放大区域 */
  height: 240px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

/* 方向键 */
.d-pad {
  position: absolute;
  left: 20px;
  top: 20px;
  width: 40px;
  height: 40px;
}

.d-pad-vertical, .d-pad-horizontal {
  position: absolute;
  background: rgba(255,255,255,0.4);
  border-radius: 2px;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
}

.d-pad-vertical {
  width: 12px;
  height: 36px;
  left: 14px;
  top: 2px;
}

.d-pad-horizontal {
  width: 36px;
  height: 12px;
  left: 2px;
  top: 14px;
}

/* 放大的方向键样式 */
.d-pad.d-pad-large {
  position: relative;
  width: 150px;   /* 再放大 */
  height: 150px;
}

.d-pad-large .d-pad-vertical,
.d-pad-large .d-pad-horizontal {
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.18);
}

.d-pad-large .d-pad-vertical {
  width: 44px;
  height: 140px;
  left: 53px;
  top: 5px;
  position: absolute;
  background: rgba(255,255,255,0.5);
}
.d-pad-large .d-pad-horizontal {
  width: 140px;
  height: 44px;
  left: 5px;
  top: 53px;
  position: absolute;
  background: rgba(255,255,255,0.5);
}

/* 右手柄区域 */
.right-handle {
  position: absolute;
  right: 20px;   /* 向左平移 */
  top:60%;      /* 向上平移 */
  transform: translateY(-50%);
  width: 230px;  /* 放大区域 */
  height: 230px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

/* 动作按钮 */
.action-buttons {
  position: absolute;
  right: 10px;
  top: 15px;
  width: 60px;
  height: 60px;
}

.action-btn {
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.btn-y { 
  top: 0; left: 18px; 
  background: rgba(255, 193, 7, 0.8); 
}
.btn-x { 
  left: 0; top: 18px; 
  background: rgba(33, 150, 243, 0.8); 
}
.btn-b { 
  right: 0; top: 18px; 
  background: rgba(244, 67, 54, 0.8); 
}
.btn-a { 
  bottom: 0; left: 18px; 
  background: rgba(76, 175, 80, 0.8); 
}

/* 放大的动作按钮样式 */
.action-buttons.action-buttons-large {
  position: relative;
  width: 144px;   /* 180px * 0.8 */
  height: 144px;  /* 180px * 0.8 */
}

.action-buttons-large .action-btn {
  width: 51px;    /* 64px * 0.8 */
  height: 51px;   /* 64px * 0.8 */
  font-size: 25.6px; /* 32px * 0.8 */
  border-width: 4px; /* 5px * 0.8 */
}

/* 保持按钮之间有空隙，位置也缩小20% */
.action-buttons-large .btn-y {
  top: 0; left: 46px;   /* 58px * 0.8 */
}
.action-buttons-large .btn-x {
  left: 0; top: 46px;
}
.action-buttons-large .btn-b {
  right: 0; top: 46px;
}
.action-buttons-large .btn-a {
  bottom: 0; left: 46px;
}

/* 中央按钮 */
.center-buttons {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 30px;
}

.center-btn {
  width: 20px;
  height: 20px;
  background: rgba(255,255,255,0.3);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255,255,255,0.8);
  font-weight: bold;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.msg {
  font-size: 14px;
  line-height: 1.5;
  background: rgba(255,255,255,0.9);
  padding: 8px 12px;
  border-radius: 6px;
  text-align: center;
}

.msg:not(.success) {
  color: #f56c6c;
}

.msg.success {
  color: #67c23a;
}

.register-link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: rgba(255,255,255,0.9);
}

:deep(.el-button--text) {
  color: #fff !important;
  padding: 0;
  margin-left: 4px;
  text-decoration: underline;
}

:deep(.el-button--text:hover) {
  color: #e3f2fd !important;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

:deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

:deep(.el-button--primary) {
  background: linear-gradient(45deg, #4CAF50, #45a049);
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(45deg, #45a049, #4CAF50);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.3);
}

/* 顶部浮动提示样式（与注册界面一致，位置向下） */
.login-top-msg {
  position: fixed;
  left: 50%;
  top: 760px; /* 向下移动，原来是60px */
  transform: translateX(-50%);
  z-index: 40000;
  background: rgba(255,255,255,0.98);
  color: #f56c6c;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
  padding: 12px 32px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  min-width: 180px;
  text-align: center;
  pointer-events: none;
  transition: all 0.3s;
}
.login-top-msg.success {
  color: #67c23a;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.fade-enter-to, .fade-leave-from {
  opacity: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .login-card {
    width: 95vw;
    max-width: 600px;
    height: 280px;
  }
  
  .card-content {
    padding: 30px 80px;
  }
  
  .left-handle, .right-handle {
    transform: translateY(-50%) scale(0.8);
  }
  .left-handle {
    left: 20px;
  }
  .right-handle {
    right: 20px;
  }
  .center-buttons {
    gap: 20px;
  }
}

@media (max-width: 480px) {
  .login-card {
    width: 95vw;
    height: 260px;
  }
  
  .card-content {
    padding: 25px 60px;
  }
  
  .left-handle, .right-handle {
    transform: translateY(-50%) scale(0.7);
  }
}
.login-fields-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
  transform: translateX(200px); /* 向右平移60px，可根据需要调整 */
}
</style>
