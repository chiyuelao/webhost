export default {
  // 当用户访问 Worker 网页时
  async fetch(request, env, ctx) {
    // 异步执行任务，不阻塞网页显示
    ctx.waitUntil(handleScheduled(env));

    // 返回一个简短网页提示
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cloudflare Worker 运行中</title>
          <style>
            body { font-family: sans-serif; background: #111; color: #eee; padding: 20px; }
            h1 { color: #00ffff; }
            code { background: #222; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>⚙️ 任务已触发执行中...</h1>
          <p>正在访问以下网址：</p>
          <pre>${(env.URLS || "未配置 URLS").split(/[\s,，]+/).filter(Boolean).join("\n")}</pre>
          <p>结果将发送到 Telegram。</p>
          <hr>
          <small>Powered by Cloudflare Worker</small>
        </body>
      </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },

  // 定时任务触发时
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};

// ====== 主要逻辑部分 ======

const TIMEOUT = 5000;

// Telegram 消息发送
async function sendTelegram(env, text) {
  const api = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown",
  };
  try {
    await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("❌ Telegram 发送失败:", e.message);
  }
}

// URL 请求
async function fetchWithTimeout(url, env) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      console.log(`✅ 成功: ${url}`);
      await sendTelegram(env, `✅ 成功访问: ${url}`);
    } else {
      console.warn(`⚠️ 状态码 ${res.status}: ${url}`);
      await sendTelegram(env, `⚠️ 状态码 ${res.status}: ${url}`);
    }
  } catch (err) {
    console.warn(`❌ 访问失败: ${url}, 错误: ${err.message}`);
    await sendTelegram(env, `❌ 访问失败: ${url}\n错误: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

// 核心调度逻辑
async function handleScheduled(env) {
  console.log("⏳ 任务开始");

  const urlString = env.URLS || "";
  const urls = urlString.split(/[\s,，]+/).filter(Boolean);

  if (urls.length === 0) {
    await sendTelegram(env, "⚠️ 未配置 URLS 环境变量或为空");
    return;
  }

  await sendTelegram(env, `⏳ 任务开始执行，共 ${urls.length} 个网址`);
  await Promise.all(urls.map((url) => fetchWithTimeout(url, env)));

  console.log("📊 任务结束");
  await sendTelegram(env, "📊 任务执行结束");
}
