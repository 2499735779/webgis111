<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, defineExpose } from 'vue'
import axios from 'axios'
import { useSocket } from '@/utils/usesocket'  // 请确保该模块路径正确

const props = defineProps({
  friend: { type: Object, required: true },
  visible: { type: Boolean, required: true }
})
const emit = defineEmits(['close'])

const user = ref(JSON.parse(localStorage.getItem('user') || '{}'))
const messages = ref([])
const inputMsg = ref('')
const chatListRef = ref(null)

// 拉取消息并滚动到底部
const fetchMessages = async () => {
  if (!props.friend?.username) {
    messages.value = []
    return
  }
  const res = await axios.get('/api/messages', {
    params: { user1: user.value.username, user2: props.friend.username }
  })
  messages.value = res.data || []
  await nextTick()
  scrollToBottom()
}

// 暴露 refresh 方法，方便外部调用刷新
defineExpose({
  refresh: fetchMessages
})

const sendMessage = async () => {
  if (!inputMsg.value.trim() || !props.friend?.username) return
  await axios.post('/api/messages', {
    from: user.value.username,
    to: props.friend.username,
    content: inputMsg.value.trim()
  })
  inputMsg.value = ''
  // 此处可以调用 fetchMessages() 作为备用（通常 socket 推送即可更新）
  await fetchMessages()
}

const scrollToBottom = () => {
  if (chatListRef.value) {
    chatListRef.value.scrollTop = chatListRef.value.scrollHeight
  }
}

let socket = null

onMounted(async () => {
  // 对话框打开时先拉取历史消息
  if (props.visible) {
    await fetchMessages()
  }
  // 初始化 socket 连接，并加入用户房间
  const socketData = useSocket()
  socket = socketData.socket
  if (user.value.username) {
    socketData.joinRoom(user.value.username)
  }
  // 监听后端推送的新消息事件
  socket.value.on('chat-message', async (msg) => {
    // 如果当前对话正在与该好友进行，同时消息来自该好友，则刷新消息记录
    if (props.visible && props.friend?.username && msg.from === props.friend.username) {
      await fetchMessages()
    }
  })
  // 监听未读消息更新事件
  socket.value.on('unread-updated', async (data) => {
    // 刷新当前对话的消息（如有需要，也可单独更新未读状态）
    if (props.visible && props.friend?.username) {
      await fetchMessages()
    }
  })
})

// 当对话框或好友发生变化时，重新拉取历史消息
watch(() => props.visible, async (val) => {
  if (val) {
    await fetchMessages()
  }
})
watch(() => props.friend, async (newVal) => {
  if (props.visible) {
    await fetchMessages()
  }
})

// 页面卸载时解绑 socket 事件监听
onBeforeUnmount(() => {
  if (socket && socket.value) {
    socket.value.off('chat-message')
    socket.value.off('unread-updated')
  }
})
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="friend ? `与 ${friend.username} 的聊天` : ''"
    width="420px"
    class="msg-chat-dialog"
    append-to-body
    @open=""
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
