<template>
  <div class="login-mask">
    <el-card class="login-card">
      <h2 class="login-title">用户登录</h2>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="60px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" autocomplete="off" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onLogin">登录</el-button>
          <el-button type="success" @click="onRegister">注册</el-button>
        </el-form-item>
        <el-form-item v-if="msg">
          <span class="msg">{{ msg }}</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const form = ref({ username: '', password: '' })
const msg = ref('')
const formRef = ref()

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  formRef.value.validate(async valid => {
    if (!valid) return
    msg.value = ''
    try {
      const res = await axios.post('http://117.72.108.239:3001/api/user-login', {
        username: form.value.username,
        password: form.value.password
      })
      if (res.data.success) {
        msg.value = '登录成功'
        localStorage.setItem('user', JSON.stringify(res.data.user))
        window.location.reload()
        return
      } else {
        msg.value = res.data.message || '登录失败'
      }
    } catch (e) {
      msg.value = '网络错误'
    }
  })
}

const onLogin = handleLogin

const onRegister = () => {
  formRef.value.validate(async valid => {
    if (!valid) return
    msg.value = ''
    try {
      const res = await axios.post('http://117.72.108.239:3001/api/user-register', form.value)
      if (res.data.success) {
        msg.value = '注册成功，请登录'
      } else {
        msg.value = res.data.message || '注册失败'
      }
    } catch (e) {
      msg.value = '网络错误'
    }
  })
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
  background: transparent; /* 保持底图可见 */
  pointer-events: none; /* 只让弹窗可点 */
}
.login-card {
  width: 350px;
  padding: 30px 24px 10px 24px;
  pointer-events: auto; /* 允许弹窗可点击 */
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  background: #fff;
}
.login-title {
  text-align: center;
  margin-bottom: 20px;
}
.msg {
  color: #f56c6c;
  font-size: 15px;
}
</style>
