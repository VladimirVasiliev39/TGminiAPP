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

// ===== АДМИНКА =====
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

// ----- Категории -----
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
                    <a href="/admin/categories/edit/${c.id}" class="btn btn-sm btn-warning">Ред.</a>
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
                <thead><tr><th>ID</th><th>Название</th><th>Иконка</th><th>Порядок</th><th>Действия</th></tr></thead>
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
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.redirect('/admin/categories');
});

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

// ----- Товары -----
app.get('/admin/products', isAuthenticated, (req, res) => {
    const products = db.prepare(`
        SELECT p.*, b.name as brand_name 
        FROM products p 
        LEFT JOIN brands b ON p.brand_id = b.id 
        ORDER BY p.sort_order, p.id
    `).all();
    const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order, id').all();

    let rows = '';
    products.forEach(p => {
        rows += `
            <tr>
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.brand_name || '—'}</td>
                <td>${p.description || ''}</td>
                <td>${p.image || ''}</td>
                <td>${p.sort_order}</td>
                <td>
                    <a href="/admin/products/edit/${p.id}" class="btn btn-sm btn-warning">Ред.</a>
                    <a href="/admin/products/delete/${p.id}" class="btn btn-sm btn-danger" onclick="return confirm('Удалить?')">Удалить</a>
                </td>
            </tr>
        `;
    });

    let brandOptions = '';
    brands.forEach(b => {
        brandOptions += `<option value="${b.id}">${b.name}</option>`;
    });

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Товары</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Товары</h1>
            <table class="table table-bordered mt-3">
                <thead><tr><th>ID</th><th>Название</th><th>Бренд</th><th>Описание</th><th>Изображение</th><th>Порядок</th><th>Действия</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <h3>Добавить товар</h3>
            <form method="post" action="/admin/products/add">
                <div class="row g-2">
                    <div class="col"><input name="name" class="form-control" placeholder="Название" required></div>
                    <div class="col">
                        <select name="brand_id" class="form-select" required>
                            <option value="">Выберите бренд</option>
                            ${brandOptions}
                        </select>
                    </div>
                    <div class="col"><input name="description" class="form-control" placeholder="Описание"></div>
                    <div class="col"><input name="image" class="form-control" placeholder="Изображение (URL)"></div>
                    <div class="col"><input name="sort_order" class="form-control" placeholder="Порядок" value="0"></div>
                    <div class="col"><button class="btn btn-success">Добавить</button></div>
                </div>
            </form>
            <p class="mt-3"><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});

app.post('/admin/products/add', isAuthenticated, (req, res) => {
    const { name, brand_id, description, image, sort_order } = req.body;
    const stmt = db.prepare('INSERT INTO products (name, brand_id, description, image, sort_order) VALUES (?, ?, ?, ?, ?)');
    stmt.run(name, brand_id, description, image, sort_order || 0);
    res.redirect('/admin/products');
});

app.get('/admin/products/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.redirect('/admin/products');
    const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order, id').all();
    let brandOptions = '';
    brands.forEach(b => {
        const selected = (b.id === product.brand_id) ? 'selected' : '';
        brandOptions += `<option value="${b.id}" ${selected}>${b.name}</option>`;
    });
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Редактировать товар</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Редактировать товар</h1>
            <form method="post" action="/admin/products/edit/${id}">
                <div class="mb-3"><label>Название</label><input name="name" class="form-control" value="${product.name}" required></div>
                <div class="mb-3"><label>Бренд</label><select name="brand_id" class="form-select">${brandOptions}</select></div>
                <div class="mb-3"><label>Описание</label><textarea name="description" class="form-control">${product.description || ''}</textarea></div>
                <div class="mb-3"><label>Изображение (URL)</label><input name="image" class="form-control" value="${product.image || ''}"></div>
                <div class="mb-3"><label>Порядок</label><input name="sort_order" class="form-control" value="${product.sort_order}"></div>
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <a href="/admin/products" class="btn btn-secondary">Отмена</a>
            </form>
        </body>
        </html>
    `);
});

app.post('/admin/products/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const { name, brand_id, description, image, sort_order } = req.body;
    const stmt = db.prepare('UPDATE products SET name = ?, brand_id = ?, description = ?, image = ?, sort_order = ? WHERE id = ?');
    stmt.run(name, brand_id, description, image, sort_order || 0, id);
    res.redirect('/admin/products');
});

app.get('/admin/products/delete/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.redirect('/admin/products');
});

// ----- Варианты товаров -----
app.get('/admin/variants', isAuthenticated, (req, res) => {
    const variants = db.prepare(`
        SELECT v.*, p.name as product_name 
        FROM product_variants v 
        LEFT JOIN products p ON v.product_id = p.id 
        ORDER BY v.sort_order, v.id
    `).all();
    const products = db.prepare('SELECT * FROM products ORDER BY sort_order, id').all();

    let rows = '';
    variants.forEach(v => {
        rows += `
            <tr>
                <td>${v.id}</td>
                <td>${v.product_name || '—'}</td>
                <td>${v.name}</td>
                <td>${v.price}</td>
                <td>${v.stock}</td>
                <td>${v.sku || ''}</td>
                <td>${v.sort_order}</td>
                <td>
                    <a href="/admin/variants/edit/${v.id}" class="btn btn-sm btn-warning">Ред.</a>
                    <a href="/admin/variants/delete/${v.id}" class="btn btn-sm btn-danger" onclick="return confirm('Удалить?')">Удалить</a>
                </td>
            </tr>
        `;
    });

    let productOptions = '';
    products.forEach(p => {
        productOptions += `<option value="${p.id}">${p.name}</option>`;
    });

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Варианты товаров</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Варианты товаров</h1>
            <table class="table table-bordered mt-3">
                <thead><tr><th>ID</th><th>Товар</th><th>Название варианта</th><th>Цена</th><th>Остаток</th><th>Артикул</th><th>Порядок</th><th>Действия</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <h3>Добавить вариант</h3>
            <form method="post" action="/admin/variants/add">
                <div class="row g-2">
                    <div class="col-auto">
                        <select name="product_id" class="form-select" required>
                            <option value="">Выберите товар</option>
                            ${productOptions}
                        </select>
                    </div>
                    <div class="col-auto"><input name="name" class="form-control" placeholder="Название (например, 50 ml)" required></div>
                    <div class="col-auto"><input name="price" class="form-control" placeholder="Цена" required></div>
                    <div class="col-auto"><input name="stock" class="form-control" placeholder="Остаток" value="0"></div>
                    <div class="col-auto"><input name="sku" class="form-control" placeholder="Артикул"></div>
                    <div class="col-auto"><input name="sort_order" class="form-control" placeholder="Порядок" value="0"></div>
                    <div class="col-auto"><button class="btn btn-success">Добавить</button></div>
                </div>
            </form>
            <p class="mt-3"><a href="/admin">← Назад</a></p>
        </body>
        </html>
    `);
});

app.post('/admin/variants/add', isAuthenticated, (req, res) => {
    const { product_id, name, price, stock, sku, sort_order } = req.body;
    const stmt = db.prepare('INSERT INTO product_variants (product_id, name, price, stock, sku, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(product_id, name, price, stock || 0, sku, sort_order || 0);
    res.redirect('/admin/variants');
});

app.get('/admin/variants/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id);
    if (!variant) return res.redirect('/admin/variants');
    const products = db.prepare('SELECT * FROM products ORDER BY sort_order, id').all();
    let productOptions = '';
    products.forEach(p => {
        const selected = (p.id === variant.product_id) ? 'selected' : '';
        productOptions += `<option value="${p.id}" ${selected}>${p.name}</option>`;
    });
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Редактировать вариант</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Редактировать вариант</h1>
            <form method="post" action="/admin/variants/edit/${id}">
                <div class="mb-3"><label>Товар</label><select name="product_id" class="form-select">${productOptions}</select></div>
                <div class="mb-3"><label>Название варианта</label><input name="name" class="form-control" value="${variant.name}" required></div>
                <div class="mb-3"><label>Цена</label><input name="price" class="form-control" value="${variant.price}" required></div>
                <div class="mb-3"><label>Остаток</label><input name="stock" class="form-control" value="${variant.stock}"></div>
                <div class="mb-3"><label>Артикул</label><input name="sku" class="form-control" value="${variant.sku || ''}"></div>
                <div class="mb-3"><label>Порядок</label><input name="sort_order" class="form-control" value="${variant.sort_order}"></div>
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <a href="/admin/variants" class="btn btn-secondary">Отмена</a>
            </form>
        </body>
        </html>
    `);
});

app.post('/admin/variants/edit/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    const { product_id, name, price, stock, sku, sort_order } = req.body;
    const stmt = db.prepare('UPDATE product_variants SET product_id = ?, name = ?, price = ?, stock = ?, sku = ?, sort_order = ? WHERE id = ?');
    stmt.run(product_id, name, price, stock || 0, sku, sort_order || 0, id);
    res.redirect('/admin/variants');
});

app.get('/admin/variants/delete/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM product_variants WHERE id = ?').run(id);
    res.redirect('/admin/variants');
});

// ----- Заказы -----
app.get('/admin/orders', isAuthenticated, (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    let rows = '';
    orders.forEach(o => {
        let itemsHtml = '';
        try {
            const items = JSON.parse(o.items);
            itemsHtml = items.map(item => `${item.productName} (${item.variantName}) x${item.quantity} = ${item.price*item.quantity}₽`).join('<br>');
        } catch(e) {
            itemsHtml = o.items;
        }
        rows += `
            <tr>
                <td>${o.id}</td>
                <td>${o.user_id}</td>
                <td>${itemsHtml}</td>
                <td>${o.total}</td>
                <td>${o.status}</td>
                <td>${o.created_at}</td>
            </tr>
        `;
    });
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Заказы</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-4">
            <h1>Заказы</h1>
            <table class="table table-bordered mt-3">
                <thead><tr><th>ID</th><th>User ID</th><th>Состав</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="mt-3"><a href="/admin">← Назад</a></p>
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
    let query = 'SELECT * FROM brands ORDER BY sort_order, id';
    let params = [];
    if (category_id) {
        query = 'SELECT * FROM brands WHERE category_id = ? ORDER BY sort_order, id';
        params = [category_id];
    }
    const brands = db.prepare(query).all(params);
    res.json(brands);
});

app.get('/api/products', (req, res) => {
    const { brand_id } = req.query;
    let query = 'SELECT * FROM products ORDER BY sort_order, id';
    let params = [];
    if (brand_id) {
        query = 'SELECT * FROM products WHERE brand_id = ? ORDER BY sort_order, id';
        params = [brand_id];
    }
    const products = db.prepare(query).all(params);
    res.json(products);
});

app.get('/api/variants', (req, res) => {
    const { product_id } = req.query;
    let query = 'SELECT * FROM product_variants ORDER BY sort_order, id';
    let params = [];
    if (product_id) {
        query = 'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id';
        params = [product_id];
    }
    const variants = db.prepare(query).all(params);
    res.json(variants);
});

app.post('/api/orders', (req, res) => {
    const { user_id, items, total } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO orders (user_id, items, total, status) VALUES (?, ?, ?, ?)');
        const info = stmt.run(user_id, JSON.stringify(items), total, 'new');
        res.json({ success: true, orderId: info.lastInsertRowid });
    } catch (err) {
        console.error('Ошибка сохранения заказа:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===== ВЕБ-СЕРВЕР =====
app.listen(PORT, () => {
    console.log(`🌍 Сервер запущен на http://localhost:${PORT}`);
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
                inline_keyboard: [
                    [{ text: 'Перейти в админку', web_app: { url: adminUrl } }]
                ]
            }
        });
    });

   /* bot.on('web_app_data', (ctx) => {
        ctx.reply('Спасибо, данные получены!');
    });*/

//====================================================================
bot.on('web_app_data', (ctx) => {
    console.log('web_app_data received:', ctx.message.web_app_data.data);
    ctx.reply('Спасибо, данные получены!')
        .catch(err => console.error('Ошибка отправки ответа:', err));
});
//====================================================================/




    bot.launch()
        .then(() => console.log('🤖 Бот успешно запущен'))
        .catch(console.error);
} else {
    console.log('⚠️ Бот не запущен, так как BOT_TOKEN не задан');
}

// ===== ЗАВЕРШЕНИЕ =====
process.once('SIGINT', () => {
    if (bot) bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    if (bot) bot.stop('SIGTERM');
    process.exit(0);
});