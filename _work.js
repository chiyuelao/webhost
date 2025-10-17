export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};

const TIMEOUT = 5000;

// Telegram 发送函数
async function sendTelegram(env, text) {
  const telegram_api = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown",
  };
  try {
    await fetch(telegram_api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("❌ Telegram 发送失败：", err.message);
  }
}

// 带超时的访问函数
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
  } catch (error) {
    console.warn(`❌ 访问失败: ${url}, 错误: ${error.message}`);
    await sendTelegram(env, `❌ 访问失败: ${url}\n错误: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

// 主定时任务
async function handleScheduled(env) {
  console.log("⏳ 任务开始");

  // 从环境变量读取 URL 列表
  const urlString = env.URLS || "";
  const urls = urlString.split(/[\s,，]+/).filter(Boolean);

  if (urls.length === 0) {
    await sendTelegram(env, "⚠️ 未配置 URLS 环境变量或为空");
    return;
  }

  await sendTelegram(env, `⏳ 定时任务开始执行，共 ${urls.length} 个网址`);

  await Promise.all(urls.map((url) => fetchWithTimeout(url, env)));

  console.log("📊 任务结束");
  await sendTelegram(env, "📊 定时任务执行结束");
}
