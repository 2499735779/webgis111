import { io } from 'socket.io-client';
import { ref } from 'vue';

// 包装 socket 实例为 ref 保证响应性并确保只初始化一次
const socket = ref(null);

export function useSocket() {
  // 单例模式，确保仅建立一次连接
  if (!socket.value) {
    // 修改 URL 为 HTTPS 模式，让连接使用 wss:// 协议
    socket.value = io("https://kexiaohua.online", {
  transports: ["websocket"],
});

    console.log("WebSocket 已初始化");
  }

  // 封装加入房间的方法
  const joinRoom = (username) => {
    socket.value.emit('join', username);
  };

  // 封装断开连接的方法
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  };

  return {
    socket,
    joinRoom,
    disconnect,
  };
}
