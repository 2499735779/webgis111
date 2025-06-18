<template>
  <div class="register-mask">
    <div class="register-card">
      <div class="gamepad-bg"></div>
      <div class="card-content">
        <h2 class="register-title">用户注册</h2>
        <el-form :model="form" :rules="rules" ref="formRef" label-width="80px" class="register-form-shift">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" autocomplete="off" placeholder="请输入用户名" />
            <div class="form-tip">可使用汉字、字母、数字组合，3-20个字符</div>
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" autocomplete="off" placeholder="请输入密码" show-password />
            <div class="form-tip">密码长度6-20位</div>
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input v-model="form.confirmPassword" type="password" autocomplete="off" placeholder="请再次输入密码" show-password />
          </el-form-item>
          <el-form-item class="register-btn-row">
            <el-button type="primary" @click="onRegister" :loading="loading" style="width: 100%;">
              {{ loading ? '注册中...' : '注册' }}
            </el-button>
          </el-form-item>
          <div class="login-link">
            已有账号？<el-button type="text" @click="goToLogin">点击登录</el-button>
          </div>
        </el-form>
        <!-- 顶部浮动提示 -->
        <transition name="fade">
          <div v-if="showTopMsg" :class="['register-top-msg', { success: isSuccess }]">
            {{ msg }}
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const form = ref({ username: '', password: '', confirmPassword: '' })
const msg = ref('')
const isSuccess = ref(false)
const loading = ref(false)
const formRef = ref()

// 新增：顶部浮动提示控制
const showTopMsg = ref(false)
let topMsgTimer = null

const validateUsername = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请输入用户名'))
  } else if (value.length < 3 || value.length > 20) {
    callback(new Error('用户名长度为3-20个字符'))
  } else if (!/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(value)) {
    callback(new Error('用户名只能包含汉字、字母、数字'))
  } else {
    callback()
  }
}

const validatePassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请输入密码'))
  } else if (value.length < 6 || value.length > 20) {
    callback(new Error('密码长度为6-20位'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请确认密码'))
  } else if (value !== form.value.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [{ validator: validateUsername, trigger: 'blur' }],
  password: [{ validator: validatePassword, trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }]
}

const onRegister = () => {
  formRef.value.validate(async valid => {
    if (!valid) {
      return
    }
    loading.value = true
    msg.value = ''
    isSuccess.value = false
    try {
      const res = await axios.post('/api/user-register', {
        username: form.value.username,
        password: form.value.password
      })
      if (res.data.success) {
        msg.value = '注册成功！3秒后跳转到登录页面'
        isSuccess.value = true
        showTopMsg.value = true
        clearTimeout(topMsgTimer)
        topMsgTimer = setTimeout(() => {
          showTopMsg.value = false
        }, 2000)
        setTimeout(() => {
          router.push({ name: 'UserLogin' })
        }, 3000)
      } else {
        msg.value = res.data.message || '注册失败'
        isSuccess.value = false
        showTopMsg.value = true
        clearTimeout(topMsgTimer)
        topMsgTimer = setTimeout(() => {
          showTopMsg.value = false
        }, 2000)
      }
    } catch (e) {
      console.error("注册请求发生错误：", e)
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

const goToLogin = () => {
  router.push({ name: 'UserLogin' })
}
</script>

<style scoped>
.register-mask {
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

.register-card {
  width: 720px;
  height: 380px;
  position: relative;
  pointer-events: auto;
  animation: slideUp 0.3s ease-out;
  border-radius: 60px/100px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 20px rgba(255,255,255,0.04) inset;
}

/* 背景改为图片 */
.gamepad-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  /* 重点：这里的图片路径 */
  background: url('/background.png') center center/cover no-repeat;
  /* 若图片在 public 目录下用 /background.png */
  /* background: url('/background.png') center center/cover no-repeat; */
  box-shadow: 
    0 8px 32px rgba(0,0,0,0.3),
    inset 0 2px 8px rgba(255,255,255,0.1),
    inset 0 -2px 8px rgba(0,0,0,0.1);
}

.card-content {
  position: relative;
  z-index: 2;
  padding: 30px 140px; /* 增加左右内边距，为装饰元素留空间 */
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* 删除摇杆装饰相关样式 */

/* 新增：注册表单整体右移 */
.register-form-shift {
  transform: translateX(-36px); /* 右移80px，可根据需要调整 */
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

.register-title {
  text-align: center;
  margin-bottom: 25px;
  color: #fff;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.form-tip {
  font-size: 11px;
  color: rgba(255,255,255,0.8);
  margin-top: 4px;
  line-height: 1.4;
  background: rgba(0,0,0,0.1);
  padding: 2px 6px;
  border-radius: 4px;
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

.login-link {
  text-align: center;
  margin-top: 15px;
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
  background: linear-gradient(45deg, #FF6B6B, #FF8E53);
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(45deg, #FF8E53, #FF6B6B);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.3);
}

/* 新增：注册按钮右侧提示样式 */
.register-btn-row {
  display: flex;
  align-items: center;
  gap: 16px;
  /* 保证按钮和提示同行 */
  margin-bottom: 0;
}

.register-inline-msg {
  margin-left: 16px;
  font-size: 14px;
  color: #f56c6c;
  background: rgba(255,255,255,0.95);
  border-radius: 6px;
  padding: 0 10px;
  line-height: 36px;
  min-width: 80px;
  display: inline-block;
  vertical-align: middle;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.register-inline-msg.success {
  color: #67c23a;
  background: rgba(255,255,255,0.95);
}

/* 顶部浮动提示样式 */
.register-top-msg {
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
.register-top-msg.success {
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
  .register-card {
    width: 95vw;
    max-width: 650px;
    height: 360px;
  }
  
  .card-content {
    padding: 25px 100px;
  }
}

@media (max-width: 480px) {
  .register-card {
    width: 95vw;
    height: 340px;
  }
  
  .card-content {
    padding: 20px 80px;
  }
}
</style>

