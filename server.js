const http = require('http');
const TelegramBot = require('node-telegram-bot-api');

// --- Config ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234/v1/chat/completions';
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || 'default';
const PORT = process.env.PORT || 3000;

// --- LM Studio helper ---
async function askLMStudio(userMessage) {
  const body = JSON.stringify({
    model: LMSTUDIO_MODEL,
    messages: [{ role: 'user', content: userMessage }]
  });

  const res = await fetch(LMSTUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LM Studio error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// --- Telegram Bot ---
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  try {
    const reply = await askLMStudio(text);
    bot.sendMessage(chatId, reply);
  } catch (err) {
    bot.sendMessage(chatId, `Error: ${err.message}`);
  }
});

bot.on('polling_error', (err) => {
  console.error('Telegram polling error:', err.message);
});

// --- CORS headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// --- HTTP Server (API only, HTML hosted externally) ---
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(body);
        const reply = await askLMStudio(message);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: `Error: ${err.message}` }));
      }
    });
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Telegram bot polling...');
});
