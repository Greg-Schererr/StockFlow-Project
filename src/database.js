const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDirectory = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "stockflow.db");
const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    supplier TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    balance_after INTEGER,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((item) => item.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("products", "supplier", "TEXT NOT NULL DEFAULT ''");
ensureColumn("products", "location", "TEXT NOT NULL DEFAULT ''");
ensureColumn("products", "description", "TEXT NOT NULL DEFAULT ''");
ensureColumn("stock_movements", "balance_after", "INTEGER");
ensureColumn("stock_movements", "note", "TEXT NOT NULL DEFAULT ''");

const productCount = db.prepare("SELECT COUNT(*) AS total FROM products").get().total;

if (productCount === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (
      name,
      sku,
      category,
      supplier,
      location,
      description,
      quantity,
      min_stock,
      unit_price
    )
    VALUES (
      @name,
      @sku,
      @category,
      @supplier,
      @location,
      @description,
      @quantity,
      @minStock,
      @unitPrice
    )
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      product_id,
      type,
      quantity,
      balance_after,
      note
    )
    VALUES (?, 'IN', ?, ?, 'Initial stock')
  `);

  const products = [
    {
      name: "Mechanical Keyboard",
      sku: "TECH-001",
      category: "Peripherals",
      supplier: "Nova Tech",
      location: "Shelf A-01",
      description: "Compact mechanical keyboard for office workstations.",
      quantity: 18,
      minStock: 5,
      unitPrice: 249.9
    },
    {
      name: "Wireless Mouse",
      sku: "TECH-002",
      category: "Peripherals",
      supplier: "Nova Tech",
      location: "Shelf A-02",
      description: "Wireless mouse with rechargeable battery.",
      quantity: 4,
      minStock: 6,
      unitPrice: 129.9
    },
    {
      name: "USB-C Hub",
      sku: "TECH-003",
      category: "Accessories",
      supplier: "Connect Supply",
      location: "Shelf B-01",
      description: "Multiport USB-C hub with HDMI and card reader.",
      quantity: 11,
      minStock: 4,
      unitPrice: 189.9
    },
    {
      name: "Laptop Stand",
      sku: "OFFICE-001",
      category: "Office",
      supplier: "Workspace Co.",
      location: "Shelf C-03",
      description: "Adjustable aluminum laptop stand.",
      quantity: 0,
      minStock: 3,
      unitPrice: 159.0
    },
    {
      name: "Webcam Full HD",
      sku: "TECH-004",
      category: "Peripherals",
      supplier: "Vision Hardware",
      location: "Shelf A-04",
      description: "1080p webcam for meetings and remote work.",
      quantity: 9,
      minStock: 4,
      unitPrice: 219.5
    }
  ];

  const seed = db.transaction(() => {
    for (const product of products) {
      const result = insertProduct.run(product);

      if (product.quantity > 0) {
        insertMovement.run(result.lastInsertRowid, product.quantity, product.quantity);
      }
    }
  });

  seed();
}

module.exports = db;
