const express = require('express');
const { Telegraf, Markup } = require('telegraf');

// ===== ВЫВОДИМ ЛОГИ ДЛЯ ДИАГНОСТИКИ =====
console.log('🚀 Запуск сервера...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// ===== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://example.com';

// ===== ПРОВЕРЯЕМ ТОКЕН =====
if (!BOT_TOKEN) {
    console.error('❌ ОШИБКА: BOT_TOKEN не задан в переменных окружения!');
    // Не выходим сразу, а просто не запускаем бота
} else {
    console.log('✅ BOT_TOKEN найден');
}

// ===== СОЗДАЁМ EXPRESS ПРИЛОЖЕНИЕ =====
const app = express();

app.get('/', (req, res) => {
    res.send('Бот запускается, проверь логи. Если видишь эту страницу — сервер работает.');
});

// ===== ЗАПУСКАЕМ ВЕБ-СЕРВЕР =====
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🌍 Веб-сервер слушает порт ${PORT}`);
});
server.on('error', (err) => {
    console.error('❌ Ошибка веб-сервера:', err);
});

// ===== БОТ (запускаем только если есть токен) =====
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

    // Запускаем бота с обработкой ошибок
    bot.launch()
        .then(() => {
            console.log('🤖 Бот успешно запущен');
        })
        .catch((err) => {
            console.error('❌ Ошибка запуска бота:', err);
        });
} else {
    console.log('⚠️ Бот не запущен, так как BOT_TOKEN не задан');
}

// Корректное завершение
process.once('SIGINT', () => {
    if (BOT_TOKEN) bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    if (BOT_TOKEN) bot.stop('SIGTERM');
    process.exit(0);
});