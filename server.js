require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { Telegraf, Markup } = require('telegraf');
const db = require('./database');  // наш модуль для работы с БД

// ===== НАСТРОЙКИ ОКРУЖЕНИЯ =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) console.warn('⚠️ ADMIN_PASSWORD не задан, админка будет недоступна');

// ===== EXPRESS =====
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Настройка сессий
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 день
}));

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function isAuthenticated(req, res, next) {
    if (req.session && req.session.authenticated) return next();
    res.redirect('/admin/login');
}

// ===== АДМИНКА =====
// Страница логина
app.get('/admin/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Вход в админку</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-5">
            <h2>Вход в админ-панель</h2>
            <form method="post" action="/admin/login">
                <div class="mb-3">
                    <label>Пароль</label>
                    <input type="password" name="password" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary">Войти</button>
            </form>
        </body>
        </html>
    `);
});

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/admin');
    } else {
        res.send('Неверный пароль. <a href="/admin/login">Попробовать снова</a>');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Главная страница админки
app.get('/admin', isAuthenticated, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Админка</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Управление магазином</h1>
            <div class="list-group mt-4">
                <a href="/admin/categories" class="list-group-item list-group-item-action">Категории</a>
                <a href="/admin/brands" class="list-group-item list-group-item-action">Бренды</a>
                <a href="/admin/products" class="list-group-item list-group-item-action">Товары</a>
                <a href="/admin/variants" class="list-group-item list-group-item-action">Варианты товаров</a>
                <a href="/admin/orders" class="list-group-item list-group-item-action">Заказы</a>
                <a href="/admin/logout" class="list-group-item list-group-item-action text-danger">Выйти</a>
            </div>
        </body>
        </html>
    `);
});

// ---- Категории ----
app.get('/admin/categories', isAuthenticated, (req, res) => {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    let rows = '';
    categories.forEach(c => {
        rows += `
            <tr>
                <td>${c.id}</td>
                <td>${c.name}</td>
                <td>${c.icon || ''}</td>
                <td>${c.sort_order}</td>
                <td>
                    <a href="/admin/categories/edit/${c.id}" class="btn btn-sm btn-warning">Редактировать</a>
                    <a href="/admin/categories/delete/${c.id}" class="btn btn-sm btn-danger" onclick="return confirm('Удалить?')">Удалить</a>
                </td>
            </tr>
        `;
    });
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Категории</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Категории</h1>
            <table class="table table-bordered mt-3">
                <thead>
                    <tr><th>ID</th><th>Название</th><th>Иконка</th><th>Порядок</th><th>Действия</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <h3>Добавить категорию</h3>
            <form method="post" action="/admin/categories/add">
                <div class="row">
                    <div class="col"><input name="name" class="form-control" placeholder="Название" required></div>
                    <div class="col"><input name="icon" class="form-control" placeholder="Иконка (эмодзи или ссылка)"></div>
                    <div class="col"><input name="sort_order" class="form-control" placeholder="Порядок" value="0"></div>
                    <div class="col"><button class="btn btn-success">Добавить</button></div>
                </div>
            </form>
            <p class="mt-3"><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});

app.post('/admin/categories/add', isAuthenticated, (req, res) => {
    const { name, icon, sort_order } = req.body;
    const stmt = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
    stmt.run(name, icon, sort_order || 0);
    res.redirect('/admin/categories');
});

app.get('/admin/categories/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) return res.redirect('/admin/categories');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Редактировать категорию</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Редактировать категорию</h1>
            <form method="post" action="/admin/categories/edit/${id}">
                <div class="mb-3"><label>Название</label><input name="name" class="form-control" value="${category.name}" required></div>
                <div class="mb-3"><label>Иконка</label><input name="icon" class="form-control" value="${category.icon || ''}"></div>
                <div class="mb-3"><label>Порядок</label><input name="sort_order" class="form-control" value="${category.sort_order}"></div>
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <a href="/admin/categories" class="btn btn-secondary">Отмена</a>
            </form>
        </body>
        </html>
    `);
});

app.post('/admin/categories/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const { name, icon, sort_order } = req.body;
    const stmt = db.prepare('UPDATE categories SET name = ?, icon = ?, sort_order = ? WHERE id = ?');
    stmt.run(name, icon, sort_order || 0, id);
    res.redirect('/admin/categories');
});

app.get('/admin/categories/delete/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    stmt.run(id);
    res.redirect('/admin/categories');
});

// Аналогичные маршруты для brands, products, variants и orders
// Чтобы не раздувать ответ, я покажу шаблон для brands, а ты сможешь аналогично сделать для остальных.
// Поскольку у нас таблица brands ссылается на categories, нужно добавить выпадающий список.
// Я приведу полный код для brands, а products и variants сделай по аналогии (если нужна помощь — скажи).

// ----- Бренды -----
app.get('/admin/brands', isAuthenticated, (req, res) => {
    const brands = db.prepare(`
        SELECT b.*, c.name as category_name 
        FROM brands b 
        LEFT JOIN categories c ON b.category_id = c.id 
        ORDER BY b.sort_order, b.id
    `).all();
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();

    let rows = '';
    brands.forEach(b => {
        rows += `
            <tr>
                <td>${b.id}</td>
                <td>${b.name}</td>
                <td>${b.category_name || '—'}</td>
                <td>${b.logo || ''}</td>
                <td>${b.sort_order}</td>
                <td>
                    <a href="/admin/brands/edit/${b.id}" class="btn btn-sm btn-warning">Ред.</a>
                    <a href="/admin/brands/delete/${b.id}" class="btn btn-sm btn-danger" onclick="return confirm('Удалить?')">Удалить</a>
                </td>
            </tr>
        `;
    });

    let catOptions = '';
    categories.forEach(c => {
        catOptions += `<option value="${c.id}">${c.name}</option>`;
    });

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Бренды</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Бренды</h1>
            <table class="table table-bordered mt-3">
                <thead><tr><th>ID</th><th>Название</th><th>Категория</th><th>Лого</th><th>Порядок</th><th>Действия</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <h3>Добавить бренд</h3>
            <form method="post" action="/admin/brands/add">
                <div class="row g-2">
                    <div class="col-auto"><input name="name" class="form-control" placeholder="Название" required></div>
                    <div class="col-auto">
                        <select name="category_id" class="form-select" required>
                            <option value="">Выберите категорию</option>
                            ${catOptions}
                        </select>
                    </div>
                    <div class="col-auto"><input name="logo" class="form-control" placeholder="Логотип (URL)"></div>
                    <div class="col-auto"><input name="sort_order" class="form-control" placeholder="Порядок" value="0"></div>
                    <div class="col-auto"><button class="btn btn-success">Добавить</button></div>
                </div>
            </form>
            <p class="mt-3"><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});

app.post('/admin/brands/add', isAuthenticated, (req, res) => {
    const { name, category_id, logo, sort_order } = req.body;
    const stmt = db.prepare('INSERT INTO brands (name, category_id, logo, sort_order) VALUES (?, ?, ?, ?)');
    stmt.run(name, category_id, logo, sort_order || 0);
    res.redirect('/admin/brands');
});

app.get('/admin/brands/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
    if (!brand) return res.redirect('/admin/brands');
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    let catOptions = '';
    categories.forEach(c => {
        const selected = (c.id === brand.category_id) ? 'selected' : '';
        catOptions += `<option value="${c.id}" ${selected}>${c.name}</option>`;
    });
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Редактировать бренд</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Редактировать бренд</h1>
            <form method="post" action="/admin/brands/edit/${id}">
                <div class="mb-3"><label>Название</label><input name="name" class="form-control" value="${brand.name}" required></div>
                <div class="mb-3"><label>Категория</label><select name="category_id" class="form-select">${catOptions}</select></div>
                <div class="mb-3"><label>Логотип (URL)</label><input name="logo" class="form-control" value="${brand.logo || ''}"></div>
                <div class="mb-3"><label>Порядок</label><input name="sort_order" class="form-control" value="${brand.sort_order}"></div>
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <a href="/admin/brands" class="btn btn-secondary">Отмена</a>
            </form>
        </body>
        </html>
    `);
});

app.post('/admin/brands/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const { name, category_id, logo, sort_order } = req.body;
    const stmt = db.prepare('UPDATE brands SET name = ?, category_id = ?, logo = ?, sort_order = ? WHERE id = ?');
    stmt.run(name, category_id, logo, sort_order || 0, id);
    res.redirect('/admin/brands');
});

app.get('/admin/brands/delete/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    res.redirect('/admin/brands');
});

// Аналогично нужно сделать маршруты для products, variants и orders.
// Чтобы не дублировать огромный код, давай сначала протестируем категории и бренды, а потом я добавлю остальные по запросу.

// ===== ВЕБ-СЕРВЕР =====
app.listen(PORT, () => {
    console.log(`🌍 Сервер запущен на http://localhost:${PORT}`);
});

// ===== БОТ =====
if (BOT_TOKEN) {
    const bot = new Telegraf(BOT_TOKEN);
    bot.start((ctx) => {
        ctx.reply('Добро пожаловать! Нажми кнопку:', Markup.inlineKeyboard([
            Markup.button.webApp('🛍 Открыть магазин', WEB_APP_URL)
        ]));
    });
    bot.on('web_app_data', (ctx) => ctx.reply('Спасибо, данные получены!'));
    bot.launch()
        .then(() => console.log('🤖 Бот успешно запущен'))
        .catch(console.error);
} else {
    console.log('⚠️ Бот не запущен, так как BOT_TOKEN не задан');
}

// ===== ЗАВЕРШЕНИЕ =====
process.once('SIGINT', () => {
    if (BOT_TOKEN) bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    if (BOT_TOKEN) bot.stop('SIGTERM');
    process.exit(0);
});