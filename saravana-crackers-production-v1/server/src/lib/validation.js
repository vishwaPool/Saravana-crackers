const present = value => value !== null && value !== undefined && String(value).trim() !== "";
const number = (value, min = 0, integer = false) => present(value) && Number.isFinite(Number(value)) && Number(value) >= min && (!integer || Number.isSafeInteger(Number(value)));
const text = value => typeof value === "string" && value.trim().length > 0;

export function validateInput(path, method, body = {}) {
  const errors = [];
  const requireText = (key, label = key) => { if (!text(body[key])) errors.push(`${label} is required.`); };
  const requireNumber = (key, min = 0, integer = false) => { if (!number(body[key], min, integer)) errors.push(`${key} must be ${integer ? "a whole number" : "a number"} of at least ${min}.`); };
  if (method === "POST" && path === "/orders") {
    for (const key of ["name", "phone", "address", "city"]) if (!text(body.customer?.[key])) errors.push(`Customer ${key} is required.`);
    if (body.customer?.phone && !/^[+0-9 ()-]{7,20}$/.test(body.customer.phone.trim())) errors.push("Enter a valid phone number.");
    if (body.deliveryMethod && !["PICKUP", "DELIVERY"].includes(body.deliveryMethod)) errors.push("Select a valid delivery method.");
    if (!Array.isArray(body.items) || !body.items.length) errors.push("Add at least one product.");
    else if (body.items.some(item => !number(item?.productId, 1, true) || !number(item?.quantity, 1, true))) errors.push("Cart items require a product and a positive whole quantity.");
  }
  if (method === "POST" && ["/categories", "/suppliers"].includes(path)) requireText("name", "Name");
  if (["POST", "PUT"].includes(method) && /^\/products(?:\/\d+)?$/.test(path)) {
    requireText("sku", "Product code"); requireText("name", "Product name");
    requireNumber("categoryId", 1, true);
    for (const key of ["purchasePrice", "mrp", "retailPrice"]) requireNumber(key);
    for (const key of ["stock", "minStock"]) if (present(body[key])) requireNumber(key, 0, true);
    if (present(body.wholesalePrice)) requireNumber("wholesalePrice");
  }
  if (method === "POST" && path === "/offers") {
    requireText("title", "Offer title"); requireNumber("value", 0.01);
    if (!["PERCENTAGE", "FIXED"].includes(body.type)) errors.push("Select a valid offer type.");
    if (body.type === "PERCENTAGE" && Number(body.value) > 100) errors.push("Percentage cannot exceed 100.");
    if (present(body.minOrder)) requireNumber("minOrder");
    const start = Date.parse(body.startAt), end = Date.parse(body.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) errors.push("Valid start and end dates are required.");
    else if (end < start) errors.push("End date must be on or after start date.");
  }
  if (method === "POST" && path === "/purchases") {
    requireNumber("supplierId", 1, true);
    if (!Array.isArray(body.items) || !body.items.length) errors.push("Add at least one purchase item.");
    else if (body.items.some(item => !number(item?.productId, 1, true) || !number(item?.quantity, 1, true) || !number(item?.unitCost))) errors.push("Select a product, positive whole quantity and non-negative unit cost.");
    if (present(body.charges)) requireNumber("charges");
  }
  if (method === "PUT" && path === "/settings") {
    requireText("shopName", "Shop name");
    for (const key of ["minimumOrder", "deliveryCharge"]) if (present(body[key])) requireNumber(key);
  }
  if (method === "POST" && path === "/stock/receive") {
    requireNumber("productId", 1, true); requireNumber("quantity", 1, true); requireNumber("purchasePrice");
  }
  if (method === "POST" && path === "/stock/adjust") {
    requireNumber("productId", 1, true); requireNumber("physicalStock", 0, true); requireText("reason", "Adjustment reason");
  }
  if (method === "POST" && path === "/sales") {
    if (!Array.isArray(body.items) || !body.items.length) errors.push("Add at least one product before completing a sale.");
    else if (body.items.some(item => !number(item?.productId, 1, true) || !number(item?.quantity, 1, true) || !number(item?.sellingPrice) || (present(item?.discount) && !number(item.discount)))) errors.push("Sale items require a product, positive whole quantity and non-negative price and discount.");
    for (const key of ["discountValue", "gst"]) if (present(body[key])) requireNumber(key);
  }
  if (method === "POST" && path === "/returns") {
    requireNumber("saleId", 1, true);
    if (!Array.isArray(body.items) || !body.items.length) errors.push("Select at least one return item.");
    else if (body.items.some(item => !number(item?.saleItemId, 1, true) || !number(item?.quantity, 1, true))) errors.push("Return quantities must be positive whole numbers.");
  }
  return errors;
}

export function validateRequest(req, res, next) {
  const errors = validateInput(req.path, req.method, req.body);
  if (errors.length) return res.status(400).json({error: errors.join(" "), errors});
  next();
}