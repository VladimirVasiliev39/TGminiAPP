const express = require('express');
const path = require('path');
const session = require('express-session');
const { Telegraf, Markup } = require('telegraf');
const db = require('./database');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID) || 0;

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

// ===== АДМИНКА (кратко, все разделы есть) =====
app.get('/admin/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Вход</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet"></head>
        <body class="container mt-5"><h2>Вход</h2>
        <form method="post" action="/admin/login"><input type="password" name="password" class="form-control" required><button class="btn btn-primary mt-2">Войти</button></form></body></html>
    `);
});
app.post('/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/admin');
    } else res.send('Неверный пароль <a href="/admin/login">назад</a>');
});
app.get('/admin/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });
app.get('/admin', isAuthenticated, (req, res) => {
    res.send(`<body class="container mt-4"><h1>Управление</h1><div class="list-group"><a href="/admin/categories" class="list-group-item">Категории</a><a href="/admin/brands" class="list-group-item">Бренды</a><a href="/admin/products" class="list-group-item">Товары</a><a href="/admin/orders" class="list-group-item">Заказы</a><a href="/admin/logout" class="list-group-item text-danger">Выйти</a></div></body>`);
});

// ----- Категории (полный CRUD) -----
app.get('/admin/categories', isAuthenticated, (req, res) => {
    const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    let rows = '';
    cats.forEach(c => rows += `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.icon||''}</td><td>${c.sort_order}</td><td><a href="/admin/categories/edit/${c.id}" class="btn btn-sm btn-warning">Ред.</a> <a href="/admin/categories/delete/${c.id}" class="btn btn-sm btn-danger">Уд</a></td></tr>`);
    res.send(`<body class="container mt-4"><h1>Категории</h1><table class="table"><thead><tr><th>ID</th><th>Название</th><th>Иконка</th><th>Порядок</th><th></th></tr></thead><tbody>${rows}</tbody></table><h3>Добавить</h3><form method="post" action="/admin/categories/add"><div class="row"><div class="col"><input name="name" placeholder="Название" required></div><div class="col"><input name="icon" placeholder="Иконка"></div><div class="col"><input name="sort_order" value="0"></div><div class="col"><button class="btn btn-success">Добавить</button></div></div></form><a href="/admin">Назад</a></body>`);
});
app.post('/admin/categories/add', isAuthenticated, (req, res) => {
    db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?,?,?)').run(req.body.name, req.body.icon, req.body.sort_order||0);
    res.redirect('/admin/categories');
});
app.get('/admin/categories/edit/:id', isAuthenticated, (req, res) => {
    const c = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
    res.send(`<form method="post" action="/admin/categories/edit/${c.id}"><input name="name" value="${c.name}"><input name="icon" value="${c.icon||''}"><input name="sort_order" value="${c.sort_order}"><button>Сохранить</button></form>`);
});
app.post('/admin/categories/edit/:id', isAuthenticated, (req, res) => {
    db.prepare('UPDATE categories SET name=?, icon=?, sort_order=? WHERE id=?').run(req.body.name, req.body.icon, req.body.sort_order||0, req.params.id);
    res.redirect('/admin/categories');
});
app.get('/admin/categories/delete/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
    res.redirect('/admin/categories');
});

// ----- Бренды (полный CRUD) -----
app.get('/admin/brands', isAuthenticated, (req, res) => {
    const brands = db.prepare('SELECT b.*, c.name as cat_name FROM brands b LEFT JOIN categories c ON b.category_id=c.id ORDER BY b.sort_order').all();
    const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    let rows = '';
    brands.forEach(b => rows += `<tr><td>${b.id}</td><td>${b.name}</td><td>${b.cat_name||'—'}</td><td>${b.logo||''}</td><td>${b.sort_order}</td><td><a href="/admin/brands/edit/${b.id}" class="btn btn-sm btn-warning">Ред.</a> <a href="/admin/brands/delete/${b.id}" class="btn btn-sm btn-danger">Уд</a></td></tr>`);
    let catOpts = '<option value="">Выберите</option>'+cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    res.send(`<body class="container mt-4"><h1>Бренды</h1><table class="table"><thead><tr><th>ID</th><th>Название</th><th>Категория</th><th>Лого</th><th>Порядок</th><th></th></tr></thead><tbody>${rows}</tbody></table><h3>Добавить</h3><form method="post" action="/admin/brands/add"><input name="name" placeholder="Название" required> <select name="category_id">${catOpts}</select> <input name="logo" placeholder="Лого"> <input name="sort_order" value="0"> <button>Добавить</button></form><a href="/admin">Назад</a></body>`);
});
app.post('/admin/brands/add', isAuthenticated, (req, res) => {
    db.prepare('INSERT INTO brands (name, category_id, logo, sort_order) VALUES (?,?,?,?)').run(req.body.name, req.body.category_id, req.body.logo, req.body.sort_order||0);
    res.redirect('/admin/brands');
});
app.get('/admin/brands/edit/:id', isAuthenticated, (req, res) => {
    const b = db.prepare('SELECT * FROM brands WHERE id=?').get(req.params.id);
    const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    let opts = cats.map(c=>`<option value="${c.id}" ${c.id==b.category_id?'selected':''}>${c.name}</option>`).join('');
    res.send(`<form method="post" action="/admin/brands/edit/${b.id}"><input name="name" value="${b.name}"> <select name="category_id">${opts}</select> <input name="logo" value="${b.logo||''}"> <input name="sort_order" value="${b.sort_order}"> <button>Сохранить</button></form>`);
});
app.post('/admin/brands/edit/:id', isAuthenticated, (req, res) => {
    db.prepare('UPDATE brands SET name=?, category_id=?, logo=?, sort_order=? WHERE id=?').run(req.body.name, req.body.category_id, req.body.logo, req.body.sort_order||0, req.params.id);
    res.redirect('/admin/brands');
});
app.get('/admin/brands/delete/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM brands WHERE id=?').run(req.params.id);
    res.redirect('/admin/brands');
});

// ----- Товары с вариантами (ed_izm1..5, cena1..5) -----
app.get('/admin/products', isAuthenticated, (req, res) => {
    const products = db.prepare('SELECT p.*, b.name as brand_name FROM products p LEFT JOIN brands b ON p.brand_id=b.id ORDER BY p.sort_order').all();
    const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order').all();
    let rows = '';
    products.forEach(p => {
        rows += `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.brand_name||'—'}</td><td>${p.description||''}</td><td>${p.image||''}</td><td>${p.sort_order}</td><td><a href="/admin/products/edit/${p.id}" class="btn btn-sm btn-warning">Ред.</a> <a href="/admin/products/delete/${p.id}" class="btn btn-sm btn-danger">Уд</a></td></tr>`;
    });
    let brandOpts = '<option value="">Выберите</option>'+brands.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
    res.send(`<body class="container mt-4"><h1>Товары</h1><table class="table"><thead><tr><th>ID</th><th>Название</th><th>Бренд</th><th>Описание</th><th>Изображение</th><th>Порядок</th><th></th></tr></thead><tbody>${rows}</tbody></table><h3>Добавить товар</h3><form method="post" action="/admin/products/add"><input name="name" placeholder="Название" required> <select name="brand_id">${brandOpts}</select> <input name="description" placeholder="Описание"> <input name="image" placeholder="Путь к фото (например /images/t-shirt.jpg)"> <input name="sort_order" value="0"> <button>Добавить</button></form><a href="/admin">Назад</a></body>`);
});
app.post('/admin/products/add', isAuthenticated, (req, res) => {
    const { name, brand_id, description, image, sort_order } = req.body;
    db.prepare('INSERT INTO products (name, brand_id, description, image, sort_order) VALUES (?,?,?,?,?)').run(name, brand_id, description, image, sort_order||0);
    res.redirect('/admin/products');
});
app.get('/admin/products/edit/:id', isAuthenticated, (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
    const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order').all();
    let brandOpts = brands.map(b=>`<option value="${b.id}" ${b.id==p.brand_id?'selected':''}>${b.name}</option>`).join('');
    // Форма для вариантов (5 полей)
    let variantFields = '';
    for (let i=1; i<=5; i++) {
        variantFields += `
            <div class="row mb-2">
                <div class="col"><input name="ed_izm${i}" value="${p[`ed_izm${i}`]||''}" placeholder="Ед. изм. ${i}"></div>
                <div class="col"><input name="cena${i}" value="${p[`cena${i}`]||''}" placeholder="Цена ${i}"></div>
            </div>
        `;
    }
    res.send(`
        <form method="post" action="/admin/products/edit/${p.id}">
            <input name="name" value="${p.name}" placeholder="Название" required><br>
            <select name="brand_id">${brandOpts}</select><br>
            <textarea name="description">${p.description||''}</textarea><br>
            <input name="image" value="${p.image||''}" placeholder="Изображение (URL)"><br>
            <input name="sort_order" value="${p.sort_order}" placeholder="Порядок"><br>
            <h4>Варианты (ед. изм. и цена)</h4>
            ${variantFields}
            <button>Сохранить</button>
        </form>
        <a href="/admin/products">Назад</a>
    `);
});
app.post('/admin/products/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const { name, brand_id, description, image, sort_order } = req.body;
    // собираем варианты
    const updates = {};
    for (let i=1; i<=5; i++) {
        updates[`ed_izm${i}`] = req.body[`ed_izm${i}`] || null;
        updates[`cena${i}`] = req.body[`cena${i}`] || null;
    }
    db.prepare(`UPDATE products SET name=?, brand_id=?, description=?, image=?, sort_order=?, ed_izm1=?, cena1=?, ed_izm2=?, cena2=?, ed_izm3=?, cena3=?, ed_izm4=?, cena4=?, ed_izm5=?, cena5=? WHERE id=?`).run(
        name, brand_id, description, image, sort_order||0,
        updates.ed_izm1, updates.cena1,
        updates.ed_izm2, updates.cena2,
        updates.ed_izm3, updates.cena3,
        updates.ed_izm4, updates.cena4,
        updates.ed_izm5, updates.cena5,
        id
    );
    res.redirect('/admin/products');
});
app.get('/admin/products/delete/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
    res.redirect('/admin/products');
});

// ----- Заказы (просмотр) -----
app.get('/admin/orders', isAuthenticated, (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    let rows = '';
    orders.forEach(o => {
        let itemsHtml = '';
        try {
            const items = JSON.parse(o.items);
            itemsHtml = items.map(i => `${i.productName} (${i.variantName}) x${i.quantity} = ${i.price*i.quantity}₽`).join('<br>');
        } catch(e) { itemsHtml = o.items; }
        rows += `<tr><td>${o.id}</td><td>${o.user_id}</td><td>${itemsHtml}</td><td>${o.total}</td><td>${o.status}</td><td>${o.created_at}</td></tr>`;
    });
    res.send(`<body class="container mt-4"><h1>Заказы</h1><table class="table"><thead><tr><th>ID</th><th>User ID</th><th>Состав</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${rows}</tbody></table><a href="/admin">Назад</a></body>`);
});

// ===== API ДЛЯ ВИТРИНЫ =====
app.get('/api/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
    res.json(categories);
});
app.get('/api/brands', (req, res) => {
    const { category_id } = req.query;
    let sql = 'SELECT * FROM brands ORDER BY sort_order, id';
    let params = [];
    if (category_id) {
        sql = 'SELECT * FROM brands WHERE category_id = ? ORDER BY sort_order, id';
        params = [category_id];
    }
    res.json(db.prepare(sql).all(params));
});
app.get('/api/products', (req, res) => {
    const { brand_id } = req.query;
    let sql = 'SELECT * FROM products ORDER BY sort_order, id';
    let params = [];
    if (brand_id) {
        sql = 'SELECT * FROM products WHERE brand_id = ? ORDER BY sort_order, id';
        params = [brand_id];
    }
    res.json(db.prepare(sql).all(params));
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
        ctx.reply('Добро пожаловать!', Markup.inlineKeyboard([Markup.button.webApp('🛍 Открыть магазин', WEB_APP_URL)]));
    });
    bot.command('admin', (ctx) => {
        if (ADMIN_USER_ID && ctx.from.id !== ADMIN_USER_ID) return ctx.reply('⛔ Доступ запрещён.');
        ctx.reply('🔐 Админ-панель:', Markup.inlineKeyboard([Markup.button.webApp('Перейти в админку', `${WEB_APP_URL.replace(/\/$/, '')}/admin`)]));
    });
    bot.on('web_app_data', (ctx) => ctx.reply('Спасибо!'));
    bot.launch().then(() => console.log('🤖 Бот запущен'));
} else console.log('⚠️ Бот не запущен');

app.listen(PORT, () => console.log(`🌍 Сервер запущен на http://localhost:${PORT}`));
process.once('SIGINT', () => { if (bot) bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { if (bot) bot.stop('SIGTERM'); process.exit(0); });