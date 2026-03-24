const express = require('express');
const path = require('path');
const session = require('express-session');
const { Telegraf, Markup } = require('telegraf');
const db = require('./database');
require('dotenv').config();

// ===== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID) || 0;

if (!ADMIN_PASSWORD) console.warn('⚠️ ADMIN_PASSWORD не задан, админка будет недоступна');

// ===== EXPRESS =====
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function isAuthenticated(req, res, next) {
    if (req.session && req.session.authenticated) return next();
    res.redirect('/admin/login');
}

// ===== АДМИНКА (сокращённо, но с редактированием товаров) =====
// Для экономии места я приведу только нужные части: login, главная, категории, бренды, товары (с вариантами)
// Полный код админки можно взять из предыдущих сообщений, но важно, чтобы в /admin/products и /admin/products/edit были поля для ed_izm1..5 и cena1..5.

// --- Логин, логаут, главная ---
app.get('/admin/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Вход</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-5">
            <h2>Вход</h2>
            <form method="post" action="/admin/login">
                <div class="mb-3"><label>Пароль</label><input type="password" name="password" class="form-control" required></div>
                <button type="submit" class="btn btn-primary">Войти</button>
            </form>
        </body>
        </html>
    `);
});
app.post('/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/admin');
    } else {
        res.send('Неверный пароль. <a href="/admin/login">Попробовать снова</a>');
    }
});
app.get('/admin/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });
app.get('/admin', isAuthenticated, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Админка</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-4">
            <h1>Управление магазином</h1>
            <div class="list-group mt-4">
                <a href="/admin/categories" class="list-group-item list-group-item-action">Категории</a>
                <a href="/admin/brands" class="list-group-item list-group-item-action">Бренды</a>
                <a href="/admin/products" class="list-group-item list-group-item-action">Товары</a>
                <a href="/admin/orders" class="list-group-item list-group-item-action">Заказы</a>
                <a href="/admin/logout" class="list-group-item list-group-item-action text-danger">Выйти</a>
            </div>
        </body>
        </html>
    `);
});

// ----- Категории -----
app.get('/admin/categories', isAuthenticated, (req, res) => {
    const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    let rows = '';
    cats.forEach(c => {
        rows += `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.icon || ''}</td><td>${c.sort_order}</td><td>
            <a href="/admin/categories/edit/${c.id}" class="btn btn-sm btn-warning">Ред.</a>
            <a href="/admin/categories/delete/${c.id}" class="btn btn-sm btn-danger" onclick="return confirm('Удалить?')">Удалить</a>
        </td></tr>`;
    });
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Категории</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-4">
            <h1>Категории</h1>
            <table class="table table-bordered"><thead><tr><th>ID</th><th>Название</th><th>Иконка</th><th>Порядок</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table>
            <h3>Добавить категорию</h3>
            <form method="post" action="/admin/categories/add"><div class="row"><div class="col"><input name="name" class="form-control" placeholder="Название" required></div><div class="col"><input name="icon" class="form-control" placeholder="Иконка"></div><div class="col"><input name="sort_order" class="form-control" placeholder="Порядок" value="0"></div><div class="col"><button class="btn btn-success">Добавить</button></div></div></form>
            <p><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});
app.post('/admin/categories/add', isAuthenticated, (req, res) => {
    const { name, icon, sort_order } = req.body;
    db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)').run(name, icon, sort_order || 0);
    res.redirect('/admin/categories');
});
app.get('/admin/categories/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Редактировать</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-4">
            <h1>Редактировать категорию</h1>
            <form method="post" action="/admin/categories/edit/${id}">
                <div class="mb-3"><label>Название</label><input name="name" class="form-control" value="${cat.name}" required></div>
                <div class="mb-3"><label>Иконка</label><input name="icon" class="form-control" value="${cat.icon || ''}"></div>
                <div class="mb-3"><label>Порядок</label><input name="sort_order" class="form-control" value="${cat.sort_order}"></div>
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
    db.prepare('UPDATE categories SET name = ?, icon = ?, sort_order = ? WHERE id = ?').run(name, icon, sort_order || 0, id);
    res.redirect('/admin/categories');
});
app.get('/admin/categories/delete/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.redirect('/admin/categories');
});

// ----- Бренды -----
app.get('/admin/brands', isAuthenticated, (req, res) => {
    const brands = db.prepare(`SELECT b.*, c.name as category_name FROM brands b LEFT JOIN categories c ON b.category_id = c.id ORDER BY b.sort_order, b.id`).all();
    const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    let rows = '';
    brands.forEach(b => {
        rows += `<tr><td>${b.id}</td><td>${b.name}</td><td>${b.category_name || '—'}</td><td>${b.logo || ''}</td><td>${b.sort_order}</td><td>
            <a href="/admin/brands/edit/${b.id}" class="btn btn-sm btn-warning">Ред.</a>
            <a href="/admin/brands/delete/${b.id}" class="btn btn-sm btn-danger" onclick="return confirm('Удалить?')">Удалить</a>
        </td></tr>`;
    });
    let catOptions = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Бренды</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-4">
            <h1>Бренды</h1>
            <table class="table table-bordered"><thead><tr><th>ID</th><th>Название</th><th>Категория</th><th>Лого</th><th>Порядок</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table>
            <h3>Добавить бренд</h3>
            <form method="post" action="/admin/brands/add">
                <div class="row g-2"><div class="col-auto"><input name="name" class="form-control" placeholder="Название" required></div>
                <div class="col-auto"><select name="category_id" class="form-select">${catOptions}</select></div>
                <div class="col-auto"><input name="logo" class="form-control" placeholder="Логотип URL"></div>
                <div class="col-auto"><input name="sort_order" class="form-control" placeholder="Порядок" value="0"></div>
                <div class="col-auto"><button class="btn btn-success">Добавить</button></div></div>
            </form>
            <p><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});
app.post('/admin/brands/add', isAuthenticated, (req, res) => {
    const { name, category_id, logo, sort_order } = req.body;
    db.prepare('INSERT INTO brands (name, category_id, logo, sort_order) VALUES (?, ?, ?, ?)').run(name, category_id, logo, sort_order || 0);
    res.redirect('/admin/brands');
});
app.get('/admin/brands/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
    const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    let catOptions = cats.map(c => `<option value="${c.id}" ${c.id === brand.category_id ? 'selected' : ''}>${c.name}</option>`).join('');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Редактировать бренд</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
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
    db.prepare('UPDATE brands SET name = ?, category_id = ?, logo = ?, sort_order = ? WHERE id = ?').run(name, category_id, logo, sort_order || 0, id);
    res.redirect('/admin/brands');
});
app.get('/admin/brands/delete/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
    res.redirect('/admin/brands');
});

// ----- Товары (с вариантами ed_izm1..5, cena1..5) -----
app.get('/admin/products', isAuthenticated, (req, res) => {
    const products = db.prepare(`SELECT p.*, b.name as brand_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id ORDER BY p.sort_order, p.id`).all();
    const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order, id').all();
    let rows = '';
    products.forEach(p => {
        rows += `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.brand_name || '—'}</td><td>${p.description || ''}</td><td>${p.image || ''}</td><td>${p.sort_order}</td><td>
            <a href="/admin/products/edit/${p.id}" class="btn btn-sm btn-warning">Ред.</a>
            <a href="/admin/products/delete/${p.id}" class="btn btn-sm btn-danger" onclick="return confirm('Удалить?')">Удалить</a>
        </td></tr>`;
    });
    let brandOptions = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Товары</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-4">
            <h1>Товары</h1>
            <table class="table table-bordered"><thead><tr><th>ID</th><th>Название</th><th>Бренд</th><th>Описание</th><th>Изображение</th><th>Порядок</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table>
            <h3>Добавить товар</h3>
            <form method="post" action="/admin/products/add">
                <div class="row g-2"><div class="col"><input name="name" class="form-control" placeholder="Название" required></div>
                <div class="col"><select name="brand_id" class="form-select">${brandOptions}</select></div>
                <div class="col"><input name="description" class="form-control" placeholder="Описание"></div>
                <div class="col"><input name="image" class="form-control" placeholder="Изображение (URL)"></div>
                <div class="col"><input name="sort_order" class="form-control" placeholder="Порядок" value="0"></div>
                <div class="col"><button class="btn btn-success">Добавить</button></div></div>
            </form>
            <p><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});
app.post('/admin/products/add', isAuthenticated, (req, res) => {
    const { name, brand_id, description, image, sort_order } = req.body;
    // Добавляем пустые поля для вариантов (их можно заполнить позже в редактировании)
    const stmt = db.prepare('INSERT INTO products (name, brand_id, description, image, sort_order) VALUES (?, ?, ?, ?, ?)');
    stmt.run(name, brand_id, description, image, sort_order || 0);
    res.redirect('/admin/products');
});

app.get('/admin/products/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order, id').all();
    let brandOptions = brands.map(b => `<option value="${b.id}" ${b.id === product.brand_id ? 'selected' : ''}>${b.name}</option>`).join('');
    // Форма с полями для 5 вариантов
    const variantFields = [];
    for (let i = 1; i <= 5; i++) {
        variantFields.push(`
            <div class="row mb-2">
                <div class="col"><input name="ed_izm${i}" class="form-control" placeholder="Ед. изм. ${i}" value="${product[`ed_izm${i}`] || ''}"></div>
                <div class="col"><input name="cena${i}" class="form-control" placeholder="Цена ${i}" value="${product[`cena${i}`] || ''}"></div>
            </div>
        `);
    }
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Редактировать товар</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-4">
            <h1>Редактировать товар</h1>
            <form method="post" action="/admin/products/edit/${id}">
                <div class="mb-3"><label>Название</label><input name="name" class="form-control" value="${product.name}" required></div>
                <div class="mb-3"><label>Бренд</label><select name="brand_id" class="form-select">${brandOptions}</select></div>
                <div class="mb-3"><label>Описание</label><textarea name="description" class="form-control">${product.description || ''}</textarea></div>
                <div class="mb-3"><label>Изображение (URL)</label><input name="image" class="form-control" value="${product.image || ''}"></div>
                <div class="mb-3"><label>Порядок</label><input name="sort_order" class="form-control" value="${product.sort_order}"></div>
                <h4>Варианты товара</h4>
                ${variantFields.join('')}
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <a href="/admin/products" class="btn btn-secondary">Отмена</a>
            </form>
        </body>
        </html>
    `);
});
app.post('/admin/products/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const { name, brand_id, description, image, sort_order, ...rest } = req.body;
    // Собираем обновление для вариантов
    const updateFields = [];
    const params = [];
    for (let i = 1; i <= 5; i++) {
        const edKey = `ed_izm${i}`;
        const cenaKey = `cena${i}`;
        if (rest[edKey] !== undefined) {
            updateFields.push(`${edKey} = ?`);
            params.push(rest[edKey]);
        }
        if (rest[cenaKey] !== undefined) {
            updateFields.push(`${cenaKey} = ?`);
            params.push(rest[cenaKey] || null);
        }
    }
    updateFields.push('name = ?', 'brand_id = ?', 'description = ?', 'image = ?', 'sort_order = ?');
    params.push(name, brand_id, description, image, sort_order || 0, id);
    const sql = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    res.redirect('/admin/products');
});

app.get('/admin/products/delete/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.redirect('/admin/products');
});

// ----- Заказы (простой просмотр) -----
app.get('/admin/orders', isAuthenticated, (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    let rows = '';
    orders.forEach(o => {
        let itemsHtml = '';
        try {
            const items = JSON.parse(o.items);
            itemsHtml = items.map(item => `${item.productName} (${item.variantName}) x${item.quantity} = ${item.price*item.quantity}₽`).join('<br>');
        } catch(e) { itemsHtml = o.items; }
        rows += `<tr><td>${o.id}</td><td>${o.user_id}</td><td>${itemsHtml}</td><td>${o.total}</td><td>${o.status}</td><td>${o.created_at}</td></tr>`;
    });
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Заказы</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-4">
            <h1>Заказы</h1>
            <table class="table table-bordered"><thead><tr><th>ID</th><th>User ID</th><th>Состав</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${rows}</tbody></table>
            <p><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});

// ===== API ДЛЯ ВИТРИНЫ =====
app.get('/api/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    res.json(categories);
});
app.get('/api/brands', (req, res) => {
    const { category_id } = req.query;
    if (category_id) {
        const brands = db.prepare('SELECT * FROM brands WHERE category_id = ? ORDER BY sort_order, id').all(category_id);
        res.json(brands);
    } else {
        const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order, id').all();
        res.json(brands);
    }
});
app.get('/api/products', (req, res) => {
    const { brand_id } = req.query;
    if (brand_id) {
        const products = db.prepare('SELECT * FROM products WHERE brand_id = ? ORDER BY sort_order, id').all(brand_id);
        res.json(products);
    } else {
        const products = db.prepare('SELECT * FROM products ORDER BY sort_order, id').all();
        res.json(products);
    }
});
app.post('/api/orders', (req, res) => {
    const { user_id, items, total } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO orders (user_id, items, total, status) VALUES (?, ?, ?, ?)');
        const info = stmt.run(user_id, JSON.stringify(items), total, 'new');
        res.json({ success: true, orderId: info.lastInsertRowid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===== БОТ =====
let bot;
if (BOT_TOKEN) {
    bot = new Telegraf(BOT_TOKEN);
    bot.start((ctx) => {
        ctx.reply('Добро пожаловать! Нажми кнопку:', Markup.inlineKeyboard([
            Markup.button.webApp('🛍 Открыть магазин', WEB_APP_URL)
        ]));
    });
    bot.command('admin', (ctx) => {
        if (ADMIN_USER_ID && ctx.from.id !== ADMIN_USER_ID) {
            ctx.reply('⛔ Доступ запрещён.');
            return;
        }
        const adminUrl = `${WEB_APP_URL.replace(/\/$/, '')}/admin`;
        ctx.reply('🔐 Админ-панель:', {
            reply_markup: {
                inline_keyboard: [[{ text: 'Перейти в админку', web_app: { url: adminUrl } }]]
            }
        });
    });
    bot.on('web_app_data', (ctx) => ctx.reply('Спасибо, данные получены!'));
    bot.launch().then(() => console.log('🤖 Бот запущен')).catch(console.error);
} else {
    console.log('⚠️ Бот не запущен, BOT_TOKEN не задан');
}

app.listen(PORT, () => console.log(`🌍 Сервер на порту ${PORT}`));
process.once('SIGINT', () => { if (bot) bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { if (bot) bot.stop('SIGTERM'); process.exit(0); });