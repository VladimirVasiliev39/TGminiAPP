const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

console.log('🚀 Запуск сервера...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://example.com';

if (!BOT_TOKEN) {
    console.error('❌ ОШИБКА: BOT_TOKEN не задан в переменных окружения!');
} else {
    console.log('✅ BOT_TOKEN найден');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Раздаём статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Если файл не найден (например, запросили / или /something) — отдаём index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запускаем сервер
const server = app.listen(PORT, () => {
    console.log(`🌍 Веб-сервер слушает порт ${PORT}`);
});

server.on('error', (err) => {
    console.error('❌ Ошибка веб-сервера:', err);
});

// ===== БОТ =====
if (BOT_TOKEN) {
    const bot = new Telegraf(BOT_TOKEN);

    bot.start((ctx) => {
        ctx.reply('Добро пожаловать! Нажми кнопку:', Markup.inlineKeyboard([
            Markup.button.webApp('🛍 Открыть магазин', WEB_APP_URL)
        ]));
    });

    bot.on('web_app_data', (ctx) => {
        ctx.reply('Спасибо, данные получены!');
    });

    bot.launch()
        .then(() => console.log('🤖 Бот успешно запущен'))
        .catch((err) => console.error('❌ Ошибка запуска бота:', err));
} else {
    console.log('⚠️ Бот не запущен, так как BOT_TOKEN не задан');
}

process.once('SIGINT', () => {
    if (BOT_TOKEN) bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    if (BOT_TOKEN) bot.stop('SIGTERM');
    process.exit(0);
});