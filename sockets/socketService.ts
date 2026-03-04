import type { Socket } from "socket.io-client";

const { io } = require("socket.io-client");

class SocketService {
  private socket: Socket | null = null;

  connect(url: string, token?: string): void {
    if (this.socket) {
      if (token) {
        this.socket.auth = { token };
      }

      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    const socket: Socket = io(url, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    this.socket = socket;

    socket.on("connect", () => {
      console.log("Connected to socket server");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server");
    });

    socket.on("connect_error", (error: unknown) => {
      console.warn("Socket connect error", error);
    });
  }

  emit(event: string, data: unknown): void {
    if (!this.socket?.connected) {
      throw new Error("Socket is not connected");
    }
    this.socket.emit(event, data);
  }

  async waitUntilConnected(timeoutMs = 5000): Promise<boolean> {
    if (this.socket?.connected) {
      return true;
    }

    if (!this.socket) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const socket = this.socket;

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("connect", onConnect);
        socket.off("connect_error", onError);
      };

      const onConnect = () => {
        cleanup();
        resolve(true);
      };

      const onError = () => {
        cleanup();
        resolve(false);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(Boolean(socket.connected));
      }, timeoutMs);

      socket.on("connect", onConnect);
      socket.on("connect_error", onError);
      socket.connect();
    });
  }

  on(event: string, callback: (data: unknown) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string): void {
    this.socket?.off(event);
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

const socketService = new SocketService();
export default socketService;
