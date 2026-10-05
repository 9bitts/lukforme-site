const WA = "5531996930611";
const GROUPS = ["Acetato", "Metal", "Flex 360°", "TR Comfort", "Solar", "Clip-on"];
const FEATURED = ["CL3101", "My24001", "8779", "CL2601", "2701", "220603"];

const catalog = Array.isArray(window.LUK_CATALOG) ? window.LUK_CATALOG : [];

function brl(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function waHref(text) {
  return `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
}

function productText(product) {
  const status = product.note ? ` (${product.note})` : "";
  const variant = selectedVariant(product);
  const color = variant ? `, cor ${variant.name}` : "";
  return `Olá, Luk for Me. Quero a armação ${product.line} ${product.code} (${product.category})${color}, ${brl(product.price)}${status}. Vou enviar a foto da receita e uma foto de frente.`;
}

function findProduct(code) {
  return catalog.find((item) => item.code.toLowerCase() === String(code).toLowerCase());
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function glassesMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 48");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `
    <g fill="none" stroke="currentColor" stroke-width="1.6">
      <circle cx="28" cy="24" r="16"/>
      <circle cx="76" cy="24" r="16"/>
      <path d="M44 24h16M12 24H6M108 24h6M12 18c-6 2-8 8-6 14M108 18c6 2 8 8 6 14"/>
    </g>`;
  return svg;
}

function variantsOf(product) {
  return Array.isArray(product.variants) ? product.variants : [];
}

function selectedVariant(product) {
  const variants = variantsOf(product);
  const index = Math.min(product.selected || 0, Math.max(0, variants.length - 1));
  return variants[index] || null;
}

function paintImage(img, product) {
  const variant = selectedVariant(product);
  img.src = variant ? variant.image : product.image;
  img.alt = variant
    ? `Armação ${displayName(product)} ${product.code}, cor ${variant.name}`
    : `Armação ${displayName(product)} ${product.code}`;
}

function syncColor(product) {
  document.querySelectorAll(`[data-photo="${product.id}"]`).forEach((img) => paintImage(img, product));
  const current = product.selected || 0;
  document.querySelectorAll(`[data-swatches="${product.id}"] .swatch`).forEach((button, index) => {
    button.setAttribute("aria-pressed", String(index === current));
  });
  const dialog = document.getElementById("product-dialog");
  const link = dialog?.querySelector("[data-wa]");
  if (dialog?.open && link?.dataset.product === product.id) link.href = waHref(productText(product));
}

function swatchRow(product) {
  const variants = variantsOf(product);
  if (variants.length < 2) return null;
  const row = el("div", "swatches");
  row.dataset.swatches = product.id;
  variants.forEach((variant, index) => {
    const button = el("button", "swatch");
    button.type = "button";
    button.style.background = variant.color;
    button.title = variant.name;
    button.setAttribute("aria-label", `Cor ${variant.name}`);
    button.setAttribute("aria-pressed", String(index === (product.selected || 0)));
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      product.selected = index;
      syncColor(product);
    });
    row.append(button);
  });
  return row;
}

function openProduct(product) {
  const dialog = document.getElementById("product-dialog");
  if (!dialog) return;
  const figure = dialog.querySelector("[data-figure]");
  const title = dialog.querySelector("[data-title]");
  const meta = dialog.querySelector("[data-meta]");
  const price = dialog.querySelector("[data-price]");
  const note = dialog.querySelector("[data-note]");
  const link = dialog.querySelector("[data-wa]");
  figure.replaceChildren();
  if (product.image || variantsOf(product).length) {
    const img = el("img");
    img.dataset.photo = product.id;
    paintImage(img, product);
    figure.append(img);
  } else {
    const ph = el("div", "ph ph-lg");
    ph.append(glassesMark(), el("span", "", "Foto em breve"));
    figure.append(ph);
  }
  dialog.querySelectorAll(".dialog-copy .swatches").forEach((row) => row.remove());
  const colors = swatchRow(product);
  if (colors) meta.before(colors);
  title.textContent = `${displayName(product)} ${product.code}`;
  const bits = [product.category];
  if (product.size) bits.push(`Tamanho ${product.size}`);
  const count = variantsOf(product).length || product.colors;
  if (count) bits.push(`${count} ${count === 1 ? "cor" : "cores"}`);
  meta.textContent = bits.join(" · ");
  price.textContent = brl(product.price);
  note.textContent = product.note
    ? "Este modelo está em falta no momento. Peça para avisar quando voltar."
    : "Valor da armação. No WhatsApp, envie a foto da receita e uma foto de frente. A lente é orçada em seguida.";
  link.dataset.product = product.id;
  link.href = waHref(productText(product));
  link.textContent = product.note ? "Avisar quando chegar" : "Pedir no WhatsApp";
  if (!dialog.open) dialog.showModal();
}

function displayName(product) {
  if (product.line === "TR") return "Comfort";
  if (product.group === "Solar") return "Solar";
  return product.line;
}

function cardFor(product) {
  const card = el("article", "product-card");
  const button = el("button", "card-hit");
  button.type = "button";
  button.setAttribute("aria-label", `${displayName(product)} ${product.code}`);
  const media = el("div", "card-media");
  if (product.image || variantsOf(product).length) {
    const img = el("img");
    img.dataset.photo = product.id;
    img.loading = "lazy";
    paintImage(img, product);
    media.append(img);
  } else {
    const ph = el("div", "ph");
    ph.append(glassesMark(), el("span", "", product.code));
    media.append(ph);
  }
  if (product.note) media.append(el("span", "badge", product.note));
  button.append(media);
  button.addEventListener("click", () => openProduct(product));
  card.append(button);
  const foot = el("div", "card-foot");
  foot.append(el("p", "card-line", `${product.group} · ${product.code} · ${brl(product.price)}`));
  const colors = swatchRow(product);
  if (colors) foot.append(colors);
  card.append(foot);
  return card;
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    });
  });
}

function initCounts() {
  const count = document.getElementById("model-count");
  if (count) count.textContent = String(catalog.length);
  const from = document.getElementById("price-from");
  if (from && catalog.length) {
    from.textContent = brl(Math.min(...catalog.map((item) => item.price)));
  }
}

function initFeatured() {
  const grid = document.getElementById("destaques");
  if (!grid) return;
  FEATURED.map(findProduct).filter(Boolean).forEach((product) => grid.append(cardFor(product)));
}

function initCatalog() {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;
  const chips = document.getElementById("chips");
  const lineSelect = document.getElementById("linha");
  const sortSelect = document.getElementById("ordem");
  const search = document.getElementById("busca");
  const count = document.getElementById("resultado");
  const empty = document.getElementById("vazio");
  const params = new URLSearchParams(location.search);
  let group = params.get("grupo") || "todos";
  if (group !== "todos" && !GROUPS.includes(group)) group = "todos";
  let line = params.get("linha") || "";
  let query = params.get("q") || "";
  if (search) search.value = query;

  function linesFor(currentGroup) {
    const pool = currentGroup === "todos" ? catalog : catalog.filter((item) => item.group === currentGroup);
    return [...new Set(pool.map((item) => item.line))].sort((a, b) => a.localeCompare(b, "pt"));
  }

  function paintChips() {
    chips.replaceChildren();
    ["todos", ...GROUPS].forEach((name) => {
      const button = el("button", "chip", name === "todos" ? "Toda a coleção" : name);
      button.type = "button";
      button.setAttribute("aria-pressed", String(group === name));
      button.addEventListener("click", () => {
        group = name;
        line = "";
        paint();
      });
      chips.append(button);
    });
  }

  function paintLines() {
    const lines = linesFor(group);
    if (line && !lines.includes(line)) line = "";
    lineSelect.replaceChildren(new Option("Todas as linhas", ""));
    lines.forEach((name) => lineSelect.append(new Option(name, name)));
    lineSelect.value = line;
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    let items = catalog.filter((item) => {
      if (group !== "todos" && item.group !== group) return false;
      if (line && item.line !== line) return false;
      if (!q) return true;
      return `${item.line} ${item.code} ${item.category} ${item.group}`.toLowerCase().includes(q);
    });
    const mode = sortSelect.value;
    if (mode === "menor") items.sort((a, b) => a.price - b.price || a.code.localeCompare(b.code));
    if (mode === "maior") items.sort((a, b) => b.price - a.price || a.code.localeCompare(b.code));
    if (mode === "nome") items.sort((a, b) => a.line.localeCompare(b.line, "pt") || a.code.localeCompare(b.code));
    return items;
  }

  function paint() {
    paintChips();
    paintLines();
    const items = filtered();
    grid.replaceChildren(...items.map(cardFor));
    count.textContent = `${items.length} ${items.length === 1 ? "modelo" : "modelos"}`;
    empty.hidden = items.length > 0;
    const next = new URLSearchParams();
    if (group !== "todos") next.set("grupo", group);
    if (line) next.set("linha", line);
    if (query.trim()) next.set("q", query.trim());
    const qs = next.toString();
    history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
  }

  lineSelect.addEventListener("change", () => {
    line = lineSelect.value;
    paint();
  });
  sortSelect.addEventListener("change", paint);
  search.addEventListener("input", () => {
    query = search.value;
    paint();
  });
  paint();

  const modelo = params.get("modelo");
  if (modelo) {
    const product = findProduct(modelo);
    if (product) openProduct(product);
  }
}

function initForms() {
  document.querySelectorAll("[data-club]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = new FormData(form).get("email");
      const address = String(email || "").trim();
      if (!address) return;
      window.open(waHref(`Olá, Luk for Me. Quero entrar no Club e receber lançamentos. Meu e-mail: ${address}`), "_blank", "noopener");
      form.reset();
    });
  });
}

function initDialog() {
  const dialog = document.getElementById("product-dialog");
  if (!dialog) return;
  dialog.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.getElementById("ano") && (document.getElementById("ano").textContent = String(new Date().getFullYear()));
initNav();
initCounts();
initFeatured();
initCatalog();
initForms();
initDialog();
