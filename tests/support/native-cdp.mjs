import { setTimeout as delay } from 'node:timers/promises';
import { startChrome } from './chrome-cdp.mjs';

// 只关闭调试信道，永不发送浏览器或标签页关闭命令。
export class NativeCdpConnection {
  constructor(socket, timeoutMs = 15_000) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      const command = this.pending.get(message.id);
      if (!command) return;
      this.pending.delete(message.id);
      clearTimeout(command.timer);
      if (message.error) command.reject(new Error(`${command.method}: ${message.error.message}`));
      else command.resolve(message.result);
    });
    socket.addEventListener('close', () => this.rejectPending(new Error('CDP 连接已断开。')));
    socket.addEventListener('error', () => this.rejectPending(new Error('CDP WebSocket 出错。')));
  }

  rejectPending(error) {
    for (const command of this.pending.values()) {
      clearTimeout(command.timer);
      command.reject(error);
    }
    this.pending.clear();
  }

  send(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP 未连接。'));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 命令超时。`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(fn, ...args) {
    const expression = `(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(',')})`;
    const result = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }

  async disconnect() {
    this.rejectPending(new Error('任务结束，断开 CDP。'));
    if (this.socket.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      const done = () => { clearTimeout(timer); this.socket.removeEventListener('close', done); resolve(); };
      const timer = setTimeout(done, 2000);
      this.socket.addEventListener('close', done, { once: true });
      this.socket.close();
    });
  }
}

async function findTarget(browserURL, targetUrl, targetId) {
  const response = await fetch(`${browserURL}/json/list`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`读取 Chrome 标签页失败：HTTP ${response.status}`);
  const targets = await response.json();
  return targets.find((target) => {
    try {
      if (target.type !== 'page') return false;
      if (targetId) return target.id === targetId;
      const actual = new URL(target.url);
      const expected = new URL(targetUrl);
      return actual.origin === expected.origin && actual.pathname === expected.pathname
        && actual.search === expected.search;
    }
    catch { return false; }
  });
}

export async function connectNative({
  browserURL, protocolTimeout = 15_000, signal,
  targetUrl = 'http://localhost:4178/', targetId, guest = true,
}) {
  signal?.throwIfAborted();
  let target = await findTarget(browserURL, targetUrl, targetId);
  if (!target) {
    if (targetId) throw new Error(`指定的 Chrome 标签页不存在：${targetId}`);
    await startChrome({ url: targetUrl, guest });
    const deadline = Date.now() + 15_000;
    while (!target && Date.now() < deadline) {
      await delay(300, undefined, { signal });
      target = await findTarget(browserURL, targetUrl, targetId);
    }
  }
  if (!target?.webSocketDebuggerUrl) throw new Error(`未找到目标标签页的 CDP 调试地址：${targetUrl}`);
  signal?.throwIfAborted();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const connection = new NativeCdpConnection(socket, protocolTimeout);
  try {
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('error', onError);
        socket.removeEventListener('close', onClose);
        signal?.removeEventListener('abort', onAbort);
        error ? reject(error) : resolve();
      };
      const onOpen = () => finish();
      const onError = () => finish(new Error('连接 CDP WebSocket 失败。'));
      const onClose = () => finish(new Error('CDP 在连接建立前关闭。'));
      const onAbort = () => finish(signal.reason);
      const timer = setTimeout(() => finish(new Error('建立 CDP 连接超时。')), protocolTimeout);
      socket.addEventListener('open', onOpen, { once: true });
      socket.addEventListener('error', onError, { once: true });
      socket.addEventListener('close', onClose, { once: true });
      signal?.addEventListener('abort', onAbort, { once: true });
    });
    return connection;
  } catch (error) {
    await connection.disconnect();
    throw error;
  }
}
