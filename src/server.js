const path = require("path");
const express = require("express");
const db = require("./database");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

function text(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseProductId(value) {
  const productId = Number(value);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

function normalizeProduct(body, isCreate = false) {
  return {
    name: text(body.name, 80),
    sku: text(body.sku, 30).toUpperCase(),
    category: text(body.category, 50),
    supplier: text(body.supplier, 80),
    location: text(body.location, 50),
    description: text(body.description, 300),
    minStock: Number(body.minStock),
    unitPrice: Number(body.unitPrice),
    initialQuantity: isCreate ? Number(body.initialQuantity) : undefined
  };
}

function validateProduct(product, isCreate = false) {
  if (!product.name || !product.sku || !product.category) {
    return "Name, SKU and category are required.";
  }

  if (!Number.isInteger(product.minStock) || product.minStock < 0) {
    return "Minimum stock must be a non-negative whole number.";
  }

  if (!Number.isFinite(product.unitPrice) || product.unitPrice < 0) {
    return "Unit price must be a valid non-negative number.";
  }

  if (isCreate && (!Number.isInteger(product.initialQuantity) || product.initialQuantity < 0)) {
    return "Initial quantity must be a non-negative whole number.";
  }

  return null;
}

function productSelect() {
  return `
    SELECT
      id,
      name,
      sku,
      category,
      supplier,
      location,
      description,
      quantity,
      min_stock AS minStock,
      unit_price AS unitPrice,
      quantity * unit_price AS totalValue,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM products
  `;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "StockFlow API" });
});

app.get("/api/dashboard", (req, res) => {
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS totalProducts,
      COALESCE(SUM(quantity), 0) AS totalUnits,
      ROUND(COALESCE(SUM(quantity * unit_price), 0), 2) AS stockValue,
      COALESCE(SUM(CASE WHEN quantity > 0 AND quantity <= min_stock THEN 1 ELSE 0 END), 0) AS lowStock,
      COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0) AS outOfStock
    FROM products
  `).get();

  const categoryStats = db.prepare(`
    SELECT
      category,
      COUNT(*) AS products,
      COALESCE(SUM(quantity), 0) AS units,
      ROUND(COALESCE(SUM(quantity * unit_price), 0), 2) AS value
    FROM products
    GROUP BY category
    ORDER BY value DESC, category ASC
  `).all();

  const recentMovements = db.prepare(`
    SELECT
      stock_movements.id,
      stock_movements.type,
      stock_movements.quantity,
      stock_movements.balance_after AS balanceAfter,
      stock_movements.note,
      stock_movements.created_at AS createdAt,
      products.name AS productName,
      products.sku
    FROM stock_movements
    INNER JOIN products ON products.id = stock_movements.product_id
    ORDER BY stock_movements.id DESC
    LIMIT 8
  `).all();

  const attentionProducts = db.prepare(`
    ${productSelect()}
    WHERE quantity <= min_stock
    ORDER BY quantity ASC, name ASC
    LIMIT 6
  `).all();

  res.json({ summary, categoryStats, recentMovements, attentionProducts });
});

app.get("/api/meta", (req, res) => {
  const categories = db.prepare(`
    SELECT DISTINCT category
    FROM products
    WHERE category <> ''
    ORDER BY category
  `).all().map((item) => item.category);

  const suppliers = db.prepare(`
    SELECT DISTINCT supplier
    FROM products
    WHERE supplier <> ''
    ORDER BY supplier
  `).all().map((item) => item.supplier);

  res.json({ categories, suppliers });
});

app.get("/api/products", (req, res) => {
  const search = text(req.query.search, 80);
  const category = text(req.query.category, 50);
  const status = text(req.query.status, 20).toLowerCase();
  const sort = text(req.query.sort, 30).toLowerCase();

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(name LIKE ? OR sku LIKE ? OR category LIKE ? OR supplier LIKE ? OR location LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  if (status === "healthy") {
    conditions.push("quantity > min_stock");
  } else if (status === "low") {
    conditions.push("quantity > 0 AND quantity <= min_stock");
  } else if (status === "out") {
    conditions.push("quantity = 0");
  }

  const orderBy = {
    name: "name ASC",
    newest: "id DESC",
    stock_asc: "quantity ASC, name ASC",
    stock_desc: "quantity DESC, name ASC",
    value_desc: "totalValue DESC, name ASC"
  }[sort] || "name ASC";

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const products = db.prepare(`
    ${productSelect()}
    ${where}
    ORDER BY ${orderBy}
  `).all(...params);

  res.json(products);
});

app.post("/api/products", (req, res) => {
  const product = normalizeProduct(req.body, true);
  const validationError = validateProduct(product, true);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const createProduct = db.transaction(() => {
      const result = db.prepare(`
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product.name,
        product.sku,
        product.category,
        product.supplier,
        product.location,
        product.description,
        product.initialQuantity,
        product.minStock,
        product.unitPrice
      );

      if (product.initialQuantity > 0) {
        db.prepare(`
          INSERT INTO stock_movements (
            product_id,
            type,
            quantity,
            balance_after,
            note
          )
          VALUES (?, 'IN', ?, ?, 'Initial stock')
        `).run(result.lastInsertRowid, product.initialQuantity, product.initialQuantity);
      }

      return result.lastInsertRowid;
    });

    const productId = createProduct();
    const createdProduct = db.prepare(`${productSelect()} WHERE id = ?`).get(productId);
    res.status(201).json(createdProduct);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "This SKU is already registered." });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to create product." });
  }
});

app.put("/api/products/:id", (req, res) => {
  const productId = parseProductId(req.params.id);
  const product = normalizeProduct(req.body);
  const validationError = validateProduct(product);

  if (!productId) {
    return res.status(400).json({ error: "Invalid product ID." });
  }

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const exists = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);

  if (!exists) {
    return res.status(404).json({ error: "Product not found." });
  }

  try {
    db.prepare(`
      UPDATE products
      SET
        name = ?,
        sku = ?,
        category = ?,
        supplier = ?,
        location = ?,
        description = ?,
        min_stock = ?,
        unit_price = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      product.name,
      product.sku,
      product.category,
      product.supplier,
      product.location,
      product.description,
      product.minStock,
      product.unitPrice,
      productId
    );

    const updatedProduct = db.prepare(`${productSelect()} WHERE id = ?`).get(productId);
    res.json(updatedProduct);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "This SKU is already registered." });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to update product." });
  }
});

app.delete("/api/products/:id", (req, res) => {
  const productId = parseProductId(req.params.id);

  if (!productId) {
    return res.status(400).json({ error: "Invalid product ID." });
  }

  const result = db.prepare("DELETE FROM products WHERE id = ?").run(productId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Product not found." });
  }

  res.status(204).send();
});

app.get("/api/movements", (req, res) => {
  const search = text(req.query.search, 80);
  const type = text(req.query.type, 10).toUpperCase();
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(products.name LIKE ? OR products.sku LIKE ? OR stock_movements.note LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (["IN", "OUT"].includes(type)) {
    conditions.push("stock_movements.type = ?");
    params.push(type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const movements = db.prepare(`
    SELECT
      stock_movements.id,
      stock_movements.type,
      stock_movements.quantity,
      stock_movements.balance_after AS balanceAfter,
      stock_movements.note,
      stock_movements.created_at AS createdAt,
      products.id AS productId,
      products.name AS productName,
      products.sku
    FROM stock_movements
    INNER JOIN products ON products.id = stock_movements.product_id
    ${where}
    ORDER BY stock_movements.id DESC
    LIMIT 250
  `).all(...params);

  res.json(movements);
});

app.post("/api/products/:id/movements", (req, res) => {
  const productId = parseProductId(req.params.id);
  const type = text(req.body.type, 10).toUpperCase();
  const quantity = Number(req.body.quantity);
  const note = text(req.body.note, 160);

  if (!productId) {
    return res.status(400).json({ error: "Invalid product ID." });
  }

  if (!["IN", "OUT"].includes(type)) {
    return res.status(400).json({ error: "Movement type must be IN or OUT." });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive whole number." });
  }

  const product = db.prepare("SELECT id, quantity FROM products WHERE id = ?").get(productId);

  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  if (type === "OUT" && quantity > product.quantity) {
    return res.status(400).json({ error: "Insufficient stock for this movement." });
  }

  const balanceAfter = type === "IN"
    ? product.quantity + quantity
    : product.quantity - quantity;

  const registerMovement = db.transaction(() => {
    db.prepare(`
      UPDATE products
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(balanceAfter, productId);

    const result = db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        type,
        quantity,
        balance_after,
        note
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(productId, type, quantity, balanceAfter, note);

    return result.lastInsertRowid;
  });

  const movementId = registerMovement();
  res.status(201).json({ id: movementId, balanceAfter });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`StockFlow is running at http://localhost:${PORT}`);
});
