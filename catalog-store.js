const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname);
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const SEED_FILE = path.join(ROOT, "js", "catalog-data.js");

let products = [];

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number);
}

function parseSize(size) {
  const match = String(size || "").trim().match(/^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)$/);
  if (!match) return { horizontal: null, bridge: null, temple: null };
  return {
    horizontal: Number(match[1]),
    bridge: Number(match[2]),
    temple: Number(match[3])
  };
}

function text(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalize(raw) {
  const fromSize = parseSize(raw.size);
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  return {
    id: text(raw.id, 80),
    category: text(raw.category, 40),
    group: text(raw.group, 40),
    line: text(raw.line, 40),
    code: text(raw.code, 40),
    name: text(raw.name, 80),
    title: text(raw.title, 80),
    subtitle: text(raw.subtitle, 120),
    description: text(raw.description, 800),
    price: Math.round(Number(raw.price) * 100) / 100 || 0,
    note: text(raw.note, 80),
    horizontal: numberOrNull(raw.horizontal != null && raw.horizontal !== "" ? raw.horizontal : fromSize.horizontal),
    bridge: numberOrNull(raw.bridge != null && raw.bridge !== "" ? raw.bridge : fromSize.bridge),
    temple: numberOrNull(raw.temple != null && raw.temple !== "" ? raw.temple : fromSize.temple),
    image: text(raw.image, 240),
    variants: variants.map((variant) => ({
      name: text(variant.name, 40),
      image: text(variant.image, 240),
      color: /^#[0-9a-fA-F]{6}$/.test(String(variant.color || "")) ? String(variant.color).toLowerCase() : "#8a6844",
      visible: variant.visible !== false
    }))
  };
}

function readSeed() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(SEED_FILE, "utf8"), sandbox, { filename: "catalog-data.js" });
  return Array.isArray(sandbox.window.LUK_CATALOG) ? sandbox.window.LUK_CATALOG : [];
}

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
  } catch {
    raw = null;
  }
  const source = Array.isArray(raw) && raw.length ? raw : readSeed();
  products = source.map(normalize).filter((item) => item.id && item.code);
  if (!Array.isArray(raw) || !raw.length) saveFile();
  return products;
}

function saveFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const json = `${JSON.stringify(products, null, 2)}\n`;
  const temporary = `${CATALOG_FILE}.tmp`;
  fs.writeFileSync(temporary, json);
  fs.renameSync(temporary, CATALOG_FILE);
}

function list() {
  return products.map((item) => structuredClone(item));
}

function priceLabel(price) {
  return Number(price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toPublic(product) {
  const variants = product.variants.filter((variant) => variant.visible);
  const size = product.horizontal && product.bridge && product.temple
    ? `${product.horizontal}-${product.bridge}-${product.temple}`
    : "";
  return {
    id: product.id,
    category: product.category,
    group: product.group,
    line: product.line,
    code: product.code,
    name: product.name,
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    price: product.price,
    priceLabel: priceLabel(product.price),
    note: product.note,
    size,
    horizontal: product.horizontal,
    bridge: product.bridge,
    temple: product.temple,
    colors: variants.length,
    image: product.image || (variants[0] ? variants[0].image : ""),
    variants: variants.map((variant) => ({
      name: variant.name,
      image: variant.image,
      color: variant.color
    }))
  };
}

function publicList() {
  return products.map(toPublic);
}

function script() {
  return `window.LUK_CATALOG = ${JSON.stringify(publicList(), null, 2)};\n`;
}

function imageFile(imagePath) {
  const clean = String(imagePath || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || clean.includes("\\")) return "";
  if (clean.startsWith("uploads/")) {
    const target = path.resolve(UPLOAD_DIR, clean.slice("uploads/".length));
    if (target !== UPLOAD_DIR && !target.startsWith(UPLOAD_DIR + path.sep)) return "";
    return target;
  }
  if (clean.startsWith("assets/cores/")) {
    const target = path.resolve(ROOT, clean);
    const root = path.resolve(ROOT, "assets", "cores");
    if (target !== root && !target.startsWith(root + path.sep)) return "";
    return target;
  }
  return "";
}

function imageExists(imagePath) {
  if (!imagePath) return true;
  const file = imageFile(imagePath);
  return Boolean(file && fs.existsSync(file) && fs.statSync(file).isFile());
}

function applyEdit(current, input) {
  const next = normalize({
    ...current,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    price: input.price,
    horizontal: input.horizontal,
    bridge: input.bridge,
    temple: input.temple,
    image: input.image,
    variants: input.variants
  });
  next.id = current.id;
  next.category = current.category;
  next.group = current.group;
  next.line = current.line;
  next.code = current.code;
  next.name = current.name;
  next.note = current.note;
  if (!Number.isFinite(Number(input.price)) || next.price < 1 || next.price > 100000) {
    throw Object.assign(new Error("Informe um preço entre R$ 1 e R$ 100.000."), { status: 422 });
  }
  if (!imageExists(next.image)) {
    throw Object.assign(new Error("A foto principal não foi encontrada."), { status: 422 });
  }
  if (!next.variants.length || next.variants.length > 12) {
    throw Object.assign(new Error("A armação precisa de 1 a 12 cores."), { status: 422 });
  }
  if (next.variants.some((variant) => !variant.name)) {
    throw Object.assign(new Error("Toda cor precisa de um nome."), { status: 422 });
  }
  if (next.variants.some((variant) => !imageExists(variant.image))) {
    throw Object.assign(new Error("Uma das fotos de cor não foi encontrada."), { status: 422 });
  }
  const visible = next.variants.filter((variant) => variant.visible);
  if (visible.length && visible.some((variant) => !variant.image)) {
    throw Object.assign(new Error("Cada cor que aparece na loja precisa de uma foto."), { status: 422 });
  }
  if (!next.image) next.image = visible[0] ? visible[0].image : (next.variants[0].image || "");
  return next;
}

function update(id, input) {
  const index = products.findIndex((item) => item.id === id);
  if (index < 0) throw Object.assign(new Error("Não encontrei essa armação."), { status: 404 });
  products[index] = applyEdit(products[index], input);
  saveFile();
  return structuredClone(products[index]);
}

function sniff(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "";
}

function saveUpload(code, originalName, buffer, mime) {
  const sniffed = sniff(buffer);
  const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[sniffed];
  if (!ext) throw Object.assign(new Error("Use uma foto JPG, PNG ou WebP."), { status: 415 });
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw Object.assign(new Error("A foto precisa ter até 5 MB."), { status: 413 });
  }
  const safeCode = String(code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!safeCode) throw Object.assign(new Error("Código da armação ausente."), { status: 422 });
  const base = path.basename(String(originalName || "foto"), path.extname(String(originalName || "")))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "foto";
  const dir = path.join(UPLOAD_DIR, safeCode);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${base}-${Date.now().toString(36)}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `uploads/${safeCode}/${filename}`;
}

function uploadFile(relative) {
  const clean = String(relative || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || clean.includes("\\")) return "";
  const target = path.resolve(UPLOAD_DIR, clean);
  if (target !== UPLOAD_DIR && !target.startsWith(UPLOAD_DIR + path.sep)) return "";
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return "";
  return target;
}

function sectionPath(product) {
  if (product.category === "Solar") return "/oculos-de-sol";
  if (/clip/i.test(product.category) || product.group === "Clip-on") return "/acessorios";
  return "/oculos-de-grau";
}

function xml(value) {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    "\"": "&quot;"
  }[char]));
}

function shoppingId(code, name, used) {
  const slug = String(name || "cor").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cor";
  let id = `${code}-${slug}`;
  let n = 2;
  while (used.has(id)) {
    id = `${code}-${slug}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function feedXml(origin) {
  const base = String(origin || "https://lukforme.com").replace(/\/$/, "");
  const used = new Set();
  const items = [];
  for (const product of publicList()) {
    const variants = product.variants.length ? product.variants : [{ name: "", image: product.image, color: "" }];
    const label = product.title || product.name || product.line || "Armação";
    for (const variant of variants) {
      const title = `${label} ${product.code}${variant.name ? ` ${variant.name}` : ""}`.replace(/\s+/g, " ").trim().slice(0, 150);
      const description = (product.description
        || `Armação ${label} ${product.code}${variant.name ? `, cor ${variant.name}` : ""}. ${product.category}. Somente a armação, lente sob receita.`
      ).slice(0, 5000);
      const page = new URL(sectionPath(product), `${base}/`);
      page.searchParams.set("modelo", product.code);
      if (variant.name) page.searchParams.set("cor", variant.name);
      const image = variant.image || product.image;
      if (!image) continue;
      const category = product.category === "Solar" || product.group === "Clip-on" ? "178" : "524";
      items.push(`    <item>
      <g:id>${xml(shoppingId(product.code, variant.name, used))}</g:id>
      <g:item_group_id>${xml(product.code)}</g:item_group_id>
      <g:title>${xml(title)}</g:title>
      <g:description>${xml(description)}</g:description>
      <g:link>${xml(page.href)}</g:link>
      <g:image_link>${xml(new URL(image, `${base}/`).href)}</g:image_link>
      <g:availability>${product.note ? "out_of_stock" : "in_stock"}</g:availability>
      <g:price>${product.price.toFixed(2)} BRL</g:price>
      <g:brand>Luk for Me</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:mpn>${xml(product.code)}</g:mpn>
      ${variant.name ? `<g:color>${xml(variant.name)}</g:color>` : ""}
      <g:google_product_category>${category}</g:google_product_category>
    </item>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Luk for Me</title>
    <link>${xml(base)}/</link>
    <description>Armações da Ótica Luk for Me</description>
${items.join("\n")}
  </channel>
</rss>
`;
}

load();

module.exports = {
  DATA_DIR,
  UPLOAD_DIR,
  list,
  publicList,
  script,
  update,
  saveUpload,
  uploadFile,
  feedXml,
  imageFile
};
