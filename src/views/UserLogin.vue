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
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  // 使用 formRef.validate 进行表单验证
  formRef.value.validate(async valid => {
    if (!valid) {
      console.log("表单验证失败", form.value)
      return
    }
    msg.value = ''
    try {
      // 输出请求前调试信息
      console.log("发送登录请求，参数：", JSON.stringify(form.value))
      
      // 发送登录请求
      const res = await axios.post('/api/user-login', {
        username: form.value.username,
        password: form.value.password,
      })
      
      // 输出响应数据
      console.log("登录响应：", res)
      
      if (res.data.success) {
        msg.value = '登录成功'
        localStorage.setItem('user', JSON.stringify(res.data.user))
        // 输出调试信息：用户登录成功后刷新页面
       console.log("登录成功，用户数据：", res.data.user);
       router.push({ name: 'Map' }).then(() => {
        window.location.reload();
      });

      } else {
        msg.value = res.data.message || '登录失败'
        console.log("登录失败，接口返回的消息：", res.data)
      }
    } catch (e) {
      // 输出详细错误信息帮助调试
      console.error("登录请求发生错误：", e)
      if (e.response) {
        console.error("响应错误数据：", e.response.data)
      }
      msg.value = '网络错误'
    }
  })
}

const onLogin = handleLogin

const onRegister = () => {
  formRef.value.validate(async valid => {
    if (!valid) {
      console.log("注册：表单验证失败", form.value)
      return
    }
    msg.value = ''
    try {
      console.log("发送注册请求，参数：", JSON.stringify(form.value))
      const res = await axios.post('/api/user-register', form.value)
      console.log("注册响应：", res)
      if (res.data.success) {
        msg.value = '注册成功，请登录'
      } else {
        msg.value = res.data.message || '注册失败'
        console.log("注册失败，接口返回的消息：", res.data)
      }
    } catch (e) {
      console.error("注册请求发生错误：", e)
      if (e.response) {
        console.error("响应错误数据：", e.response.data)
      }
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
