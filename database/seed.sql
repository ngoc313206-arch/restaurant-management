INSERT INTO restaurant_tables (table_number, capacity)
VALUES
(1, 2),
(2, 4),
(3, 4),
(4, 6),
(5, 8)
ON CONFLICT (table_number) DO NOTHING;

INSERT INTO categories (name)
SELECT v.name
FROM (VALUES
    ('Món chính'),
    ('Đồ uống'),
    ('Món tráng miệng')
) AS v(name)
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.name = v.name
);

INSERT INTO menu_items (category_id, name, price)
SELECT c.id, v.name, v.price
FROM (
    VALUES
    ('Món chính', 'Cơm chiên hải sản', 65000),
    ('Món chính', 'Phở bò', 50000),
    ('Món chính', 'Bún chả Hà Nội', 55000),
    ('Đồ uống', 'Trà đào', 30000),
    ('Đồ uống', 'Nước cam', 35000),
    ('Món tráng miệng', 'Bánh flan', 25000)
) AS v(category_name, name, price)
JOIN categories c ON c.name = v.category_name
WHERE NOT EXISTS (
    SELECT 1 FROM menu_items m WHERE m.name = v.name
);
