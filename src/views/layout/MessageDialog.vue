<script setup>
import { ref, watch, nextTick, onBeforeUnmount, defineExpose } from 'vue'
import axios from 'axios'

const props = defineProps({
  friend: { type: Object, required: true },
  visible: { type: Boolean, required: true }
})
const emit = defineEmits(['close'])

const user = ref(JSON.parse(localStorage.getItem('user') || '{}'))
const messages = ref([])
const inputMsg = ref('')
const chatListRef = ref(null)

let timer = null

// 拉取消息并滚动到底部
const fetchMessages = async () => {
  if (!props.friend?.username) {
    messages.value = []
    return
  }
  const res = await axios.get('http://localhost:3001/api/messages', {
    params: { user1: user.value.username, user2: props.friend.username }
  })
  messages.value = res.data || []
  await nextTick()
  scrollToBottom()
}

// 暴露 refresh 方法
defineExpose({
  refresh: fetchMessages
})

// 打开对话框时拉取最新消息并显示，并启动定时刷新
const handleDialogOpen = async () => {
  await fetchMessages()
  if (timer) clearInterval(timer)
  timer = setInterval(fetchMessages, 1000)
}

const sendMessage = async () => {
  if (!inputMsg.value.trim() || !props.friend?.username) return
  await axios.post('http://localhost:3001/api/messages', {
    from: user.value.username,
    to: props.friend.username,
    content: inputMsg.value.trim()
  })
  inputMsg.value = ''
  await fetchMessages()
}

const scrollToBottom = () => {
  if (chatListRef.value) {
    chatListRef.value.scrollTop = chatListRef.value.scrollHeight
  }
}

// 只要对话框打开就刷新历史记录并启动定时刷新
watch(() => props.visible, v => {
  if (v) {
    handleDialogOpen()
  } else {
    if (timer) clearInterval(timer)
  }
})
// 切换好友时也刷新
watch(() => props.friend, (newVal) => {
  if (props.visible) handleDialogOpen()
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="friend ? `与 ${friend.username} 的聊天` : ''"
    width="420px"
    class="msg-chat-dialog"
    append-to-body
    @open="console.debug('[DEBUG] el-dialog @open')"
    @close="emit('close')"
  >
    <div class="msg-chat-list" ref="chatListRef">
      <div
        v-for="msg in messages"
        :key="msg._id"
        :class="['msg-item', { self: msg.from === user.username }]"
      >
        <span class="msg-user">{{ msg.from }}</span>
        <span class="msg-content" v-if="msg.type !== 'friend-request'">{{ msg.content }}</span>
        <template v-else>
          <span class="msg-content">[好友请求] {{ msg.from }} 请求加你为好友</span>
        </template>
      </div>
    </div>
    <div class="msg-chat-input">
      <el-input
        v-model="inputMsg"
        placeholder="输入消息，回车发送"
        @keyup.enter="sendMessage"
      />
      <el-button type="primary" @click="sendMessage">发送</el-button>
    </div>
  </el-dialog>
</template>

<style scoped>
.msg-chat-dialog :deep(.el-dialog__body) {
  padding: 0 0 12px 0;
}
.msg-chat-list {
  height: 340px;
  overflow-y: auto;
  padding: 18px 8px 8px 8px;
  background: #f8f8f8;
}
.msg-item {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}
.msg-item.self {
  justify-content: flex-end;
}
.msg-user {
  font-weight: bold;
  margin-right: 8px;
  color: #409eff;
}
.msg-content {
  background: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  margin-right: 8px;
  max-width: 260px;
  word-break: break-all;
}
.msg-chat-input {
  display: flex;
  gap: 8px;
  padding: 12px 0 0 0;
  border-top: 1px solid #eee;
  background: #fff;
}
</style>
