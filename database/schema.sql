-- 1. Nhân viên
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('admin', 'manager', 'waiter', 'chef', 'cashier')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bàn ăn
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id SERIAL PRIMARY KEY,
    table_number INT UNIQUE NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    status VARCHAR(20) DEFAULT 'available'
        CHECK (status IN ('available', 'occupied', 'reserved'))
);

-- 3. Danh mục món ăn
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 4. Thực đơn
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES categories(id),
    name VARCHAR(150) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    is_available BOOLEAN DEFAULT TRUE
);

-- 5. Đơn gọi món
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    table_id INT REFERENCES restaurant_tables(id),
    staff_id INT REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'preparing', 'served', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Chi tiết đơn hàng
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id),
    menu_item_id INT NOT NULL REFERENCES menu_items(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0)
);

-- 7. Thanh toán
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INT UNIQUE NOT NULL REFERENCES orders(id),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('cash', 'bank_transfer', 'card')),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
