const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = __dirname;
const HANDLE = "oticalukforme";
const CAMPAIGN_END = Date.parse("2026-12-01T00:00:00-03:00");
const DATA_DIR = path.join(ROOT, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.jsonl");
const ALLOWED_HOSTS = new Set(["lukfor.me", "www.lukfor.me", "localhost", "127.0.0.1"]);
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "1; mode=block",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https: *; style-src 'self' 'unsafe-inline' https: *; script-src 'self' 'unsafe-inline' https: *; font-src 'self' data: https: *; connect-src 'self' https: *; media-src 'self' https: *; object-src 'none'; frame-src 'self' https: *; base-uri 'self'"
};
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2"
};

loadEnv(path.join(ROOT, ".env"));

const catalog = loadCatalog();
const orders = new Map();
loadOrders();

const hits = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/health") {
    res.writeHead(200, { ...SECURITY, "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (pathname === "/api/checkout" && req.method === "POST") {
    handleCheckout(req, res).catch((error) => fail(res, error));
    return;
  }
  if (pathname === "/api/pagamento" && req.method === "POST") {
    handlePayment(req, res).catch((error) => fail(res, error));
    return;
  }
  if (pathname === "/api/webhook/infinitepay" && req.method === "POST") {
    handleWebhook(req, res).catch((error) => fail(res, error));
    return;
  }
  if (pathname.startsWith("/api/")) {
    sendJson(res, 405, { error: "Método não aceito." });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, SECURITY);
    res.end();
    return;
  }

  if (pathname === "/index.html") {
    redirect(res, `/${url.search}`);
    return;
  }
  const html = pathname.match(/^(.*)\.html$/);
  if (html) {
    redirect(res, `${html[1] || "/"}${url.search}`);
    return;
  }

  serveStatic(req, res, pathname);
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => {
  console.log(`Luk for Me em http://localhost:${port}`);
});

function loadEnv(file) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadCatalog() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "catalog-data.js"), "utf8"), sandbox, {
    filename: "catalog-data.js"
  });
  return Array.isArray(sandbox.window.LUK_CATALOG) ? sandbox.window.LUK_CATALOG : [];
}

function loadOrders() {
  let text = "";
  try {
    text = fs.readFileSync(ORDERS_FILE, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const order = JSON.parse(line);
      if (order && order.orderNsu) orders.set(order.orderNsu, order);
    } catch {
      /* linha incompleta */
    }
  }
}

function remember(order) {
  orders.set(order.orderNsu, order);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(ORDERS_FILE, `${JSON.stringify(order)}\n`);
}

function cents(price) {
  return Math.round(Number(price) * 100);
}

function onSale(product) {
  return Date.now() < CAMPAIGN_END && !product.note;
}

function chargeCents(product) {
  const full = cents(product.price);
  return onSale(product) ? Math.round(full * 0.8) : full;
}

function displayName(product) {
  if (product.name) return product.name;
  if (product.line === "TR") return "Comfort";
  if (product.group === "Solar") return "Solar";
  return product.line;
}

function variantOf(product, color) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (!variants.length) return null;
  if (!color) return variants.length === 1 ? variants[0] : null;
  return variants.find((item) => item.name.toLowerCase() === String(color).toLowerCase()) || null;
}

function publicOrigin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const hostname = hostHeader.replace(/:\d+$/, "").toLowerCase();
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwarded || (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https");
  if (!ALLOWED_HOSTS.has(hostname)) return "https://lukfor.me";
  return `${proto}://${hostHeader}`;
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "local";
}

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 12) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Pedido grande demais."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const text = await readBody(req);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Não entendi o pedido."), { status: 400 });
  }
}

async function infinitePay(apiPath, body) {
  const key = process.env.INFINITEPAY_KEY;
  if (!key) throw Object.assign(new Error("Pagamento indisponível no momento."), { status: 503 });
  const response = await fetch(`https://api.checkout.infinitepay.io${apiPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": key
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data };
}

function findCheckoutUrl(value) {
  if (typeof value === "string" && /^https:\/\/([a-z0-9-]+\.)*infinitepay\.io\//i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCheckoutUrl(item);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findCheckoutUrl(item);
      if (found) return found;
    }
  }
  return "";
}

function validUntil() {
  const when = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(when);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}-03:00`;
}

async function handleCheckout(req, res) {
  if (limited(clientIp(req))) {
    sendJson(res, 429, { error: "Muitas tentativas agora. Espere um minuto." });
    return;
  }
  const body = await readJson(req);
  const code = String(body.code || "").trim();
  const product = catalog.find((item) => item.code.toLowerCase() === code.toLowerCase());
  if (!product) {
    sendJson(res, 404, { error: "Não encontrei essa armação." });
    return;
  }
  if (product.note) {
    sendJson(res, 409, { error: "Essa armação está em falta." });
    return;
  }
  const variant = variantOf(product, String(body.color || "").trim());
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length > 1 && !variant) {
    sendJson(res, 400, { error: "Escolha a cor da armação." });
    return;
  }
  const price = chargeCents(product);
  if (!Number.isInteger(price) || price < 100) {
    sendJson(res, 422, { error: "Essa armação está sem preço para pagamento." });
    return;
  }

  const color = variant ? `, cor ${variant.name}` : "";
  const promo = onSale(product) ? " Black November, 20%." : "";
  const description = `Armação ${displayName(product)} ${product.code} (${product.category})${color}. Somente a armação, sem lente.${promo}`.slice(0, 180);
  const orderNsu = `lfm-${product.code}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const origin = publicOrigin(req);
  const payload = {
    handle: HANDLE,
    order_nsu: orderNsu,
    redirect_url: `${origin}/pedido`,
    items: [{ quantity: 1, price, description }],
    options: {
      single_payment: true,
      valid_until: validUntil()
    }
  };
  if (origin.startsWith("https://")) payload.webhook_url = `${origin}/api/webhook/infinitepay`;

  const result = await infinitePay("/links", payload);
  const url = findCheckoutUrl(result.data);
  if (!result.ok || !url) {
    console.error("InfinitePay recusou o link", result.status);
    sendJson(res, 502, { error: "A InfinitePay não abriu o pagamento. Tente de novo em instantes." });
    return;
  }

  remember({
    orderNsu,
    code: product.code,
    color: variant ? variant.name : "",
    description,
    cents: price,
    createdAt: new Date().toISOString()
  });
  sendJson(res, 200, { url });
}

async function handlePayment(req, res) {
  const body = await readJson(req);
  const orderNsu = String(body.orderNsu || body.order_nsu || "").trim();
  const transactionNsu = String(body.transactionNsu || body.transaction_nsu || "").trim();
  const slug = String(body.slug || "").trim();
  if (!orderNsu || !transactionNsu || !slug) {
    sendJson(res, 400, { error: "Faltam dados do pagamento." });
    return;
  }
  const result = await infinitePay("/payment_check", {
    handle: HANDLE,
    order_nsu: orderNsu,
    transaction_nsu: transactionNsu,
    slug
  });
  if (!result.ok) {
    console.error("InfinitePay não confirmou", result.status);
    sendJson(res, 502, { error: "Não consegui confirmar o pagamento agora." });
    return;
  }
  sendJson(res, 200, paymentView(result.data, orderNsu, body.receiptUrl || body.receipt_url));
}

async function handleWebhook(req, res) {
  let body = {};
  try {
    body = await readJson(req);
  } catch {
    sendJson(res, 400, { error: "Aviso inválido." });
    return;
  }
  const orderNsu = String(body.order_nsu || "").trim();
  const transactionNsu = String(body.transaction_nsu || "").trim();
  const slug = String(body.invoice_slug || body.slug || "").trim();
  if (!orderNsu || !transactionNsu || !slug) {
    sendJson(res, 200, { ok: true });
    return;
  }
  const result = await infinitePay("/payment_check", {
    handle: HANDLE,
    order_nsu: orderNsu,
    transaction_nsu: transactionNsu,
    slug
  });
  if (result.ok && result.data && result.data.paid === true) {
    const view = paymentView(result.data, orderNsu, body.receipt_url);
    remember({ ...view, source: "webhook", paidAt: new Date().toISOString() });
  }
  sendJson(res, 200, { ok: true });
}

function paymentView(data, orderNsu, receiptUrl) {
  const saved = orders.get(orderNsu) || {};
  const receipt = typeof receiptUrl === "string" && receiptUrl.startsWith("https://") ? receiptUrl : "";
  return {
    paid: data.paid === true,
    cents: Number(data.paid_amount || data.amount || saved.cents || 0),
    method: data.capture_method === "pix" ? "pix" : data.capture_method === "credit_card" ? "credit_card" : "",
    receiptUrl: receipt,
    orderNsu,
    description: saved.description || "",
    code: saved.code || "",
    color: saved.color || ""
  };
}

function fail(res, error) {
  const status = error.status || 500;
  sendJson(res, status, { error: status === 500 ? "Algo saiu do esperado." : error.message });
}

function sendJson(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    ...SECURITY,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": payload.length
  });
  res.end(payload);
}

function redirect(res, location) {
  res.writeHead(301, { ...SECURITY, Location: location || "/" });
  res.end();
}

function resolveFile(pathname) {
  const clean = pathname.replace(/^\/+/, "");
  const pieces = clean.split("/").filter(Boolean);
  if (pieces.some((piece) => piece.startsWith("."))) return "";
  const relative = pieces.join(path.sep);
  const target = path.resolve(ROOT, relative);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return "";
  const blocked = new Set(["server.js", "package.json", "package-lock.json", "Caddyfile", "Caddyfile.static"]);
  if (blocked.has(path.basename(target))) return "";
  if (target.startsWith(DATA_DIR + path.sep) || target === DATA_DIR) return "";
  return target;
}

function serveStatic(req, res, pathname) {
  let file = resolveFile(pathname);
  if (!file) {
    notFound(res);
    return;
  }
  let stat = null;
  try {
    stat = fs.statSync(file);
  } catch {
    stat = null;
  }
  if (stat && stat.isDirectory()) {
    file = path.join(file, "index.html");
    try {
      stat = fs.statSync(file);
    } catch {
      stat = null;
    }
  }
  if (!stat || !stat.isFile()) {
    const htmlFile = resolveFile(`${pathname.replace(/\/$/, "")}.html`);
    if (htmlFile && fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) {
      file = htmlFile;
      stat = fs.statSync(file);
    }
  }
  if (!stat || !stat.isFile()) {
    notFound(res);
    return;
  }

  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  const headers = { ...SECURITY, "Content-Type": type, "Accept-Ranges": "bytes" };
  const range = req.headers.range;
  if (range && stat.size) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start > end || end >= stat.size) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

function notFound(res) {
  const html = "<!DOCTYPE html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>Não encontrado · Luk for Me</title><p>Página não encontrada. <a href=\"/\">Voltar ao início</a></p>";
  const payload = Buffer.from(html);
  res.writeHead(404, { ...SECURITY, "Content-Type": "text/html; charset=utf-8", "Content-Length": payload.length });
  res.end(payload);
}
