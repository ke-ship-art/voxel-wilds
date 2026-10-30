import http from 'node:http';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const CDP_URL = 'http://127.0.0.1:9222';
export const USER_DATA_DIR = path.join(process.env.LOCALAPPDATA ?? process.env.TEMP ?? '.', 'VoxelWildsChromeTests');

// 使用原生 HTTP，localhost 探活不会经过代理。拒绝非 CDP 服务。
export function probeVersion(baseUrl = CDP_URL, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${baseUrl}/json/version`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('error', () => resolve(null));
      response.on('end', () => {
        try {
          const version = JSON.parse(body);
          if (response.statusCode !== 200 || !/^wss?:\/\//.test(version.webSocketDebuggerUrl ?? '')) {
            throw new Error('missing CDP WebSocket endpoint');
          }
          resolve(version);
        } catch {
          reject(new Error(`${baseUrl} 已响应，但不是有效的 Chrome CDP 服务。`));
        }
      });
    });
    // 限制整个请求时长，包括服务连接后始终不结束响应的情况。
    const timer = setTimeout(() => request.destroy(new Error('CDP probe timeout')), timeoutMs);
    request.on('close', () => clearTimeout(timer));
    request.on('error', () => resolve(null));
  });
}

export async function findChrome() {
  if (process.env.CHROME_PATH) {
    await access(process.env.CHROME_PATH);
    return process.env.CHROME_PATH;
  }
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, 'chrome.exe')),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try next */ }
  }
  throw new Error('未找到 chrome.exe，请使用当前终端的 CHROME_PATH 环境变量指定完整路径。');
}

export async function startChrome({ url = 'http://localhost:4178/', guest = true } = {}) {
  const executable = await findChrome();
  // 参数数组正确处理空格，无 shell 拼接；Chrome 独立于脚本存活。
  const child = spawn(executable, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    ...(guest ? ['--guest'] : []),
    '--new-window',
    url,
  ], { detached: true, stdio: 'ignore', windowsHide: false });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', resolve);
  });
  child.unref();
}

export async function ensureChrome({
  probe = probeVersion, start = startChrome, signal,
  startupTimeoutMs = 30_000, pollIntervalMs = 300,
  log = console.log,
} = {}) {
  signal?.throwIfAborted();
  if (await probe()) {
    log('9222 已就绪，复用现有 Chrome。');
    return;
  }
  signal?.throwIfAborted();
  log('9222 未就绪，启动 Chrome。');
  await start();
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (await probe()) return;
    await delay(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())), undefined, { signal });
  }
  throw new Error(`Chrome 启动后 ${startupTimeoutMs / 1000} 秒内 9222 未响应。请检查 ChromeDebug 是否被未启用调试的 Chrome 占用。`);
}
