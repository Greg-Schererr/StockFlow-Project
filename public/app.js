const state = {
  currentView: "dashboard",
  products: [],
  movements: [],
  metadata: { categories: [], suppliers: [] },
  editingProductId: null,
  movementProduct: null,
  toastTimer: null
};

const elements = {
  pageLabel: document.querySelector("#pageLabel"),
  pageTitle: document.querySelector("#pageTitle"),
  pageDescription: document.querySelector("#pageDescription"),
  addProductButton: document.querySelector("#addProductButton"),
  exportButton: document.querySelector("#exportButton"),
  totalProducts: document.querySelector("#totalProducts"),
  totalUnits: document.querySelector("#totalUnits"),
  stockValue: document.querySelector("#stockValue"),
  needsAttention: document.querySelector("#needsAttention"),
  healthSummary: document.querySelector("#healthSummary"),
  categoryList: document.querySelector("#categoryList"),
  recentActivityList: document.querySelector("#recentActivityList"),
  attentionList: document.querySelector("#attentionList"),
  productSearch: document.querySelector("#productSearch"),
  categoryFilter: document.querySelector("#categoryFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  clearFiltersButton: document.querySelector("#clearFiltersButton"),
  inventoryResultCount: document.querySelector("#inventoryResultCount"),
  productsTableBody: document.querySelector("#productsTableBody"),
  productsEmptyState: document.querySelector("#productsEmptyState"),
  movementSearch: document.querySelector("#movementSearch"),
  movementTypeFilter: document.querySelector("#movementTypeFilter"),
  movementResultCount: document.querySelector("#movementResultCount"),
  movementsTableBody: document.querySelector("#movementsTableBody"),
  movementsEmptyState: document.querySelector("#movementsEmptyState"),
  productModal: document.querySelector("#productModal"),
  productForm: document.querySelector("#productForm"),
  productModalTitle: document.querySelector("#productModalTitle"),
  productFormError: document.querySelector("#productFormError"),
  productId: document.querySelector("#productId"),
  productName: document.querySelector("#productName"),
  productSku: document.querySelector("#productSku"),
  productCategory: document.querySelector("#productCategory"),
  productSupplier: document.querySelector("#productSupplier"),
  productLocation: document.querySelector("#productLocation"),
  productInitialQuantity: document.querySelector("#productInitialQuantity"),
  productMinStock: document.querySelector("#productMinStock"),
  productUnitPrice: document.querySelector("#productUnitPrice"),
  productDescription: document.querySelector("#productDescription"),
  initialQuantityField: document.querySelector("#initialQuantityField"),
  categoryOptions: document.querySelector("#categoryOptions"),
  supplierOptions: document.querySelector("#supplierOptions"),
  movementModal: document.querySelector("#movementModal"),
  movementForm: document.querySelector("#movementForm"),
  movementModalTitle: document.querySelector("#movementModalTitle"),
  movementProductId: document.querySelector("#movementProductId"),
  movementType: document.querySelector("#movementType"),
  movementQuantity: document.querySelector("#movementQuantity"),
  movementNote: document.querySelector("#movementNote"),
  movementStockHint: document.querySelector("#movementStockHint"),
  movementFormError: document.querySelector("#movementFormError"),
  toast: document.querySelector("#toast")
};

const viewContent = {
  dashboard: {
    label: "OPERATIONS",
    title: "Inventory overview",
    description: "Monitor stock health and recent activity."
  },
  inventory: {
    label: "CATALOG",
    title: "Inventory",
    description: "Manage products, prices and storage information."
  },
  movements: {
    label: "AUDIT TRAIL",
    title: "Stock movements",
    description: "Review entries, removals and resulting balances."
  }
};

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(normalized));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "An unexpected error occurred.");
  }

  return data;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");

  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2800);
}

function showError(element, message) {
  element.textContent = message;
  element.classList.remove("hidden");
}

function clearError(element) {
  element.textContent = "";
  element.classList.add("hidden");
}

function switchView(view) {
  if (!viewContent[view]) {
    return;
  }

  state.currentView = view;
  const content = viewContent[view];

  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  elements.pageLabel.textContent = content.label;
  elements.pageTitle.textContent = content.title;
  elements.pageDescription.textContent = content.description;
  elements.exportButton.classList.toggle("hidden", view !== "inventory");
}

async function loadMetadata() {
  const selectedCategory = elements.categoryFilter.value;
  state.metadata = await request("/api/meta");

  elements.categoryFilter.innerHTML = `
    <option value="">All categories</option>
    ${state.metadata.categories.map((category) => (
      `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
    )).join("")}
  `;

  if (state.metadata.categories.includes(selectedCategory)) {
    elements.categoryFilter.value = selectedCategory;
  }

  elements.categoryOptions.innerHTML = state.metadata.categories.map((category) => (
    `<option value="${escapeHtml(category)}"></option>`
  )).join("");

  elements.supplierOptions.innerHTML = state.metadata.suppliers.map((supplier) => (
    `<option value="${escapeHtml(supplier)}"></option>`
  )).join("");
}

async function loadDashboard() {
  const data = await request("/api/dashboard");
  const summary = data.summary;

  elements.totalProducts.textContent = formatNumber(summary.totalProducts);
  elements.totalUnits.textContent = formatNumber(summary.totalUnits);
  elements.stockValue.textContent = formatCurrency(summary.stockValue);
  elements.needsAttention.textContent = formatNumber(summary.lowStock + summary.outOfStock);

  renderHealth(summary);
  renderCategories(data.categoryStats);
  renderRecentActivity(data.recentMovements);
  renderAttention(data.attentionProducts);
}

function renderHealth(summary) {
  const total = Math.max(Number(summary.totalProducts), 1);
  const healthy = Math.max(summary.totalProducts - summary.lowStock - summary.outOfStock, 0);
  const groups = [
    { label: "Healthy", value: healthy, className: "" },
    { label: "Low stock", value: summary.lowStock, className: "low" },
    { label: "Out of stock", value: summary.outOfStock, className: "out" }
  ];

  elements.healthSummary.innerHTML = groups.map((group) => {
    const width = Math.round((group.value / total) * 100);

    return `
      <div class="health-row">
        <span class="health-label">${group.label}</span>
        <div class="progress-track" aria-label="${group.label}: ${group.value}">
          <div class="progress-fill ${group.className}" style="width: ${width}%"></div>
        </div>
        <span class="health-value">${group.value}</span>
      </div>
    `;
  }).join("");
}

function renderCategories(categories) {
  if (categories.length === 0) {
    elements.categoryList.innerHTML = emptyInline("No category data available.");
    return;
  }

  elements.categoryList.innerHTML = categories.slice(0, 6).map((category) => `
    <div class="category-item">
      <div class="category-copy">
        <strong>${escapeHtml(category.category)}</strong>
        <span>${category.products} product${category.products === 1 ? "" : "s"} · ${category.units} units</span>
      </div>
      <span class="category-value">${formatCurrency(category.value)}</span>
    </div>
  `).join("");
}

function renderRecentActivity(movements) {
  if (movements.length === 0) {
    elements.recentActivityList.innerHTML = emptyInline("No stock movements yet.");
    return;
  }

  elements.recentActivityList.innerHTML = movements.map((movement) => `
    <div class="activity-item">
      <span class="movement-symbol ${movement.type === "OUT" ? "out" : ""}">
        ${movement.type === "IN" ? "+" : "−"}
      </span>
      <div class="activity-copy">
        <strong>${escapeHtml(movement.productName)}</strong>
        <span>${movement.type === "IN" ? "Stock entry" : "Stock removal"} · ${movement.quantity} unit${movement.quantity === 1 ? "" : "s"}</span>
      </div>
      <time class="activity-time">${formatDate(movement.createdAt)}</time>
    </div>
  `).join("");
}

function renderAttention(products) {
  if (products.length === 0) {
    elements.attentionList.innerHTML = emptyInline("All products have healthy stock levels.");
    return;
  }

  elements.attentionList.innerHTML = products.map((product) => `
    <div class="attention-item">
      <div class="attention-copy">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.sku)} · Minimum ${product.minStock}</span>
      </div>
      <div class="attention-stock">
        <strong>${product.quantity}</strong>
        <span>in stock</span>
      </div>
    </div>
  `).join("");
}

function emptyInline(message) {
  return `<div class="empty-state"><span>${escapeHtml(message)}</span></div>`;
}

function productQuery() {
  const params = new URLSearchParams();
  const search = elements.productSearch.value.trim();
  const category = elements.categoryFilter.value;
  const status = elements.statusFilter.value;
  const sort = elements.sortFilter.value;

  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);

  return params.toString();
}

async function loadProducts() {
  const query = productQuery();
  state.products = await request(`/api/products${query ? `?${query}` : ""}`);
  renderProducts(state.products);
}

function productStatus(product) {
  if (product.quantity === 0) {
    return { label: "Out of stock", className: "out" };
  }

  if (product.quantity <= product.minStock) {
    return { label: "Low stock", className: "low" };
  }

  return { label: "Healthy", className: "healthy" };
}

function renderProducts(products) {
  elements.productsTableBody.innerHTML = "";
  elements.productsEmptyState.classList.toggle("hidden", products.length > 0);
  elements.inventoryResultCount.textContent = `${products.length} product${products.length === 1 ? "" : "s"}`;

  for (const product of products) {
    const status = productStatus(product);
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <div class="product-cell">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.sku)}${product.supplier ? ` · ${escapeHtml(product.supplier)}` : ""}</span>
        </div>
      </td>
      <td>${escapeHtml(product.category)}</td>
      <td>${escapeHtml(product.location || "—")}</td>
      <td>${formatNumber(product.quantity)}</td>
      <td>${formatCurrency(product.unitPrice)}</td>
      <td>${formatCurrency(product.totalValue)}</td>
      <td><span class="status-badge ${status.className}">${status.label}</span></td>
      <td>
        <div class="actions">
          <button class="action-button" type="button" data-action="movement" data-id="${product.id}">Move</button>
          <button class="action-button" type="button" data-action="edit" data-id="${product.id}">Edit</button>
          <button class="action-button danger" type="button" data-action="delete" data-id="${product.id}">Delete</button>
        </div>
      </td>
    `;

    elements.productsTableBody.appendChild(row);
  }
}

function movementQuery() {
  const params = new URLSearchParams();
  const search = elements.movementSearch.value.trim();
  const type = elements.movementTypeFilter.value;

  if (search) params.set("search", search);
  if (type) params.set("type", type);

  return params.toString();
}

async function loadMovements() {
  const query = movementQuery();
  state.movements = await request(`/api/movements${query ? `?${query}` : ""}`);
  renderMovements(state.movements);
}

function renderMovements(movements) {
  elements.movementsTableBody.innerHTML = "";
  elements.movementsEmptyState.classList.toggle("hidden", movements.length > 0);
  elements.movementResultCount.textContent = `${movements.length} movement${movements.length === 1 ? "" : "s"}`;

  for (const movement of movements) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatDate(movement.createdAt)}</td>
      <td>
        <div class="product-cell">
          <strong>${escapeHtml(movement.productName)}</strong>
          <span>${escapeHtml(movement.sku)}</span>
        </div>
      </td>
      <td><span class="movement-badge ${movement.type === "IN" ? "in" : "out"}">${movement.type === "IN" ? "Entry" : "Removal"}</span></td>
      <td>${movement.type === "IN" ? "+" : "−"}${movement.quantity}</td>
      <td>${movement.balanceAfter ?? "—"}</td>
      <td>${escapeHtml(movement.note || "—")}</td>
    `;

    elements.movementsTableBody.appendChild(row);
  }
}

function openProductModal(product = null) {
  state.editingProductId = product?.id || null;
  elements.productForm.reset();
  clearError(elements.productFormError);

  const editing = Boolean(product);
  elements.productModalTitle.textContent = editing ? "Edit product" : "Add product";
  elements.initialQuantityField.classList.toggle("hidden", editing);
  elements.productInitialQuantity.required = !editing;

  elements.productId.value = product?.id || "";
  elements.productName.value = product?.name || "";
  elements.productSku.value = product?.sku || "";
  elements.productCategory.value = product?.category || "";
  elements.productSupplier.value = product?.supplier || "";
  elements.productLocation.value = product?.location || "";
  elements.productInitialQuantity.value = editing ? 0 : 0;
  elements.productMinStock.value = product?.minStock ?? 0;
  elements.productUnitPrice.value = product?.unitPrice ?? 0;
  elements.productDescription.value = product?.description || "";

  elements.productModal.showModal();
  elements.productName.focus();
}

function closeDialog(dialog) {
  if (dialog?.open) {
    dialog.close();
  }
}

function openMovementModal(product) {
  state.movementProduct = product;
  elements.movementForm.reset();
  clearError(elements.movementFormError);
  elements.movementModalTitle.textContent = `Update ${product.name}`;
  elements.movementProductId.value = product.id;
  elements.movementType.value = "IN";
  elements.movementQuantity.value = 1;
  elements.movementNote.value = "";
  elements.movementStockHint.textContent = `Current stock: ${product.quantity} units.`;
  elements.movementModal.showModal();
  elements.movementQuantity.focus();
}

async function submitProduct(event) {
  event.preventDefault();
  clearError(elements.productFormError);

  const payload = {
    name: elements.productName.value,
    sku: elements.productSku.value,
    category: elements.productCategory.value,
    supplier: elements.productSupplier.value,
    location: elements.productLocation.value,
    initialQuantity: Number(elements.productInitialQuantity.value),
    minStock: Number(elements.productMinStock.value),
    unitPrice: Number(elements.productUnitPrice.value),
    description: elements.productDescription.value
  };

  try {
    if (state.editingProductId) {
      await request(`/api/products/${state.editingProductId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showToast("Product updated successfully.");
    } else {
      await request("/api/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast("Product created successfully.");
    }

    closeDialog(elements.productModal);
    await refreshAll();
  } catch (error) {
    showError(elements.productFormError, error.message);
  }
}

async function submitMovement(event) {
  event.preventDefault();
  clearError(elements.movementFormError);

  const productId = Number(elements.movementProductId.value);
  const payload = {
    type: elements.movementType.value,
    quantity: Number(elements.movementQuantity.value),
    note: elements.movementNote.value
  };

  try {
    await request(`/api/products/${productId}/movements`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    closeDialog(elements.movementModal);
    showToast("Stock movement registered.");
    await refreshAll();
  } catch (error) {
    showError(elements.movementFormError, error.message);
  }
}

async function handleProductAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const productId = Number(button.dataset.id);
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  if (button.dataset.action === "movement") {
    openMovementModal(product);
    return;
  }

  if (button.dataset.action === "edit") {
    openProductModal(product);
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(`Delete "${product.name}" and its movement history?`);

    if (!confirmed) {
      return;
    }

    try {
      await request(`/api/products/${product.id}`, { method: "DELETE" });
      showToast("Product deleted.");
      await refreshAll();
    } catch (error) {
      showToast(error.message);
    }
  }
}

function exportProductsCsv() {
  if (state.products.length === 0) {
    showToast("There are no products to export.");
    return;
  }

  const headers = [
    "Name",
    "SKU",
    "Category",
    "Supplier",
    "Location",
    "Quantity",
    "Minimum stock",
    "Unit price",
    "Total value",
    "Status"
  ];

  const rows = state.products.map((product) => {
    const status = productStatus(product).label;
    return [
      product.name,
      product.sku,
      product.category,
      product.supplier,
      product.location,
      product.quantity,
      product.minStock,
      product.unitPrice,
      product.totalValue,
      status
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map(csvValue).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stockflow-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function clearFilters() {
  elements.productSearch.value = "";
  elements.categoryFilter.value = "";
  elements.statusFilter.value = "";
  elements.sortFilter.value = "name";
  loadProducts().catch((error) => showToast(error.message));
}

async function refreshAll() {
  await Promise.all([
    loadDashboard(),
    loadProducts(),
    loadMovements(),
    loadMetadata()
  ]);
}

let productSearchTimer;
let movementSearchTimer;

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-go-to]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.goTo));
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    closeDialog(document.querySelector(`#${button.dataset.close}`));
  });
});

elements.addProductButton.addEventListener("click", () => openProductModal());
elements.exportButton.addEventListener("click", exportProductsCsv);
elements.clearFiltersButton.addEventListener("click", clearFilters);
elements.productForm.addEventListener("submit", submitProduct);
elements.movementForm.addEventListener("submit", submitMovement);
elements.productsTableBody.addEventListener("click", handleProductAction);

elements.productSearch.addEventListener("input", () => {
  window.clearTimeout(productSearchTimer);
  productSearchTimer = window.setTimeout(() => {
    loadProducts().catch((error) => showToast(error.message));
  }, 250);
});

[elements.categoryFilter, elements.statusFilter, elements.sortFilter].forEach((element) => {
  element.addEventListener("change", () => {
    loadProducts().catch((error) => showToast(error.message));
  });
});

elements.movementSearch.addEventListener("input", () => {
  window.clearTimeout(movementSearchTimer);
  movementSearchTimer = window.setTimeout(() => {
    loadMovements().catch((error) => showToast(error.message));
  }, 250);
});

elements.movementTypeFilter.addEventListener("change", () => {
  loadMovements().catch((error) => showToast(error.message));
});

[elements.productModal, elements.movementModal].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog(dialog);
    }
  });
});

refreshAll().catch((error) => {
  console.error(error);
  showToast("Unable to load application data.");
});
