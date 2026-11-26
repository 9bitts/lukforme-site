const WA = "5531996930611";
const GROUPS = ["Ateliê", "Studio", "Heritage", "Flex 360°", "Clip-on"];
const FEATURED = ["CA7804", "CA3011", "CL3101", "CL5101", "CL7107", "SHA089", "SSM047", "G5752"];
const CAMPAIGN_TEXT = "Olá, Luk for Me. Vi a Black November no site e quero a promoção de 20% nas armações.";
const CAMPAIGN_END = Date.parse("2026-12-01T00:00:00-03:00");

const catalog = Array.isArray(window.LUK_CATALOG) ? window.LUK_CATALOG : [];

function brl(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function campaignOn() {
  return Date.now() < CAMPAIGN_END;
}

function salePrice(price) {
  return Math.round(Math.round(Number(price) * 100) * 0.8) / 100;
}

function onSale(product) {
  return campaignOn() && !product.note;
}

function payable(product) {
  return onSale(product) ? salePrice(product.price) : product.price;
}

function fillPrice(node, product) {
  node.replaceChildren();
  if (!onSale(product)) {
    node.textContent = brl(product.price);
    return;
  }
  node.append(
    el("s", "price-was", brl(product.price)),
    el("span", "price-now", brl(salePrice(product.price)))
  );
}

function waHref(text) {
  return `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
}

function productText(product) {
  const variant = selectedVariant(product);
  const color = variant ? `, cor ${variant.name}` : "";
  const title = product.name ? `${product.name} ${product.code}` : `${product.line} ${product.code}`;
  const name = `${title} (${product.category})${color}`;
  if (onSale(product)) {
    return `Olá, Luk for Me. Quero a armação ${name} na Black November, com 20%: de ${brl(product.price)} por ${brl(salePrice(product.price))}.`;
  }
  const status = product.note ? ` (${product.note})` : "";
  return `Olá, Luk for Me. Quero a armação ${name}, ${brl(product.price)}${status}.`;
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
  if (!img.dataset.bound) {
    img.dataset.bound = "1";
    img.addEventListener("error", () => {
      const frame = img.parentElement;
      if (!frame || frame.querySelector(".ph")) return;
      img.remove();
      const ph = el("div", "ph");
      ph.append(glassesMark(), el("span", "", "Foto em breve"));
      frame.append(ph);
    });
  }
}

function syncColor(product) {
  document.querySelectorAll(`[data-photo="${product.id}"]`).forEach((img) => paintImage(img, product));
  const current = product.selected || 0;
  document.querySelectorAll(`[data-swatches="${product.id}"]`).forEach((row) => {
    row.querySelectorAll(".swatch").forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === current));
    });
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
    figure.append(img);
    paintImage(img, product);
  } else {
    const ph = el("div", "ph ph-lg");
    ph.append(glassesMark(), el("span", "", "Foto em breve"));
    figure.append(ph);
  }
  dialog.querySelectorAll(".dialog-copy .swatches").forEach((row) => row.remove());
  const colors = swatchRow(product);
  if (colors) meta.before(colors);
  title.textContent = `${displayName(product)} ${product.code}`;
  const bits = [product.group];
  if (product.size) bits.push(`Tamanho ${product.size}`);
  const count = variantsOf(product).length || product.colors;
  if (count) bits.push(`${count} ${count === 1 ? "cor" : "cores"}`);
  meta.textContent = bits.join(" · ");
  fillPrice(price, product);
  note.textContent = product.note
    ? "Este modelo está em falta no momento. Peça para avisar quando voltar."
    : onSale(product)
      ? "Black November até 30/11: 20% nesta armação. O pagamento é só da armação. Depois, no WhatsApp, envie a foto da receita e uma foto de frente."
      : "O pagamento é só da armação. Depois, no WhatsApp, envie a foto da receita e uma foto de frente. A lente é orçada em seguida.";
  link.dataset.product = product.id;
  link.href = waHref(productText(product));
  link.textContent = product.note ? "Avisar quando chegar" : "Pedir no WhatsApp";
  link.className = product.note ? "btn btn-dark" : "btn btn-line";
  const pay = dialog.querySelector("[data-pay]");
  const payStatus = dialog.querySelector("[data-pay-status]");
  if (pay) {
    pay.hidden = Boolean(product.note);
    pay.disabled = false;
    pay.textContent = onSale(product) ? "Pagar com 20%" : "Pagar a armação";
  }
  if (payStatus) {
    payStatus.hidden = true;
    payStatus.textContent = "";
  }
  dialog.dataset.product = product.id;
  if (!dialog.open) dialog.showModal();
}

function displayName(product) {
  if (product.name) return product.name;
  if (product.line === "TR") return "Comfort";
  if (product.group === "Solar") return "Solar";
  return product.line;
}

function cardDetail(product) {
  if (product.name) return `${product.line} · ${product.code}`;
  if (product.category && product.line && product.category !== product.line) {
    return `${product.category} · ${product.code}`;
  }
  return `${product.line || product.group} · ${product.code}`;
}

function cardFor(product) {
  const card = el("article", "product-card");
  const button = el("button", "card-hit");
  button.type = "button";
  const media = el("div", "card-media");
  if (product.image || variantsOf(product).length) {
    const img = el("img");
    img.dataset.photo = product.id;
    img.loading = "lazy";
    img.decoding = "async";
    media.append(img);
    paintImage(img, product);
  } else {
    const ph = el("div", "ph");
    ph.append(glassesMark(), el("span", "", product.code));
    media.append(ph);
  }
  if (product.note) media.append(el("span", "badge", product.note));
  else if (onSale(product)) media.append(el("span", "badge badge-sale", "20%"));
  const copy = el("div", "card-copy");
  const price = el("p", "card-price");
  fillPrice(price, product);
  copy.append(
    el("p", "card-name", displayName(product)),
    el("p", "card-code", cardDetail(product)),
    price
  );
  button.append(media, copy);
  button.addEventListener("click", () => openProduct(product));
  card.append(button);
  const colors = swatchRow(product);
  if (colors) {
    const bar = el("div", "swatch-bar");
    bar.append(colors);
    card.append(bar);
  }
  return card;
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;
  const label = toggle.querySelector(".sr-only");
  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    if (label) label.textContent = open ? "Fechar menu" : "Abrir menu";
  }
  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
}

function initCounts() {
  const count = document.getElementById("model-count");
  if (count) count.textContent = String(catalog.length);
  const from = document.getElementById("price-from");
  if (from && catalog.length) {
    from.textContent = brl(Math.min(...catalog.map(payable)));
  }
}

function initFeatured() {
  const grid = document.getElementById("destaques");
  if (!grid) return;
  FEATURED.map(findProduct).filter(Boolean).forEach((product) => grid.append(cardFor(product)));
}

function sectionOf(product) {
  const category = product.category || "";
  if (category === "Solar") return "sol";
  if (/clip/i.test(category) || product.group === "Clip-on") return "acessorios";
  return "grau";
}

function initCatalog() {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;
  const section = grid.dataset.section || "";
  const pool = section ? catalog.filter((item) => sectionOf(item) === section) : catalog;
  const groups = GROUPS.filter((name) => pool.some((item) => item.group === name));
  const chips = document.getElementById("chips");
  const lineSelect = document.getElementById("linha");
  const sortSelect = document.getElementById("ordem");
  const search = document.getElementById("busca");
  const count = document.getElementById("resultado");
  const empty = document.getElementById("vazio");
  const params = new URLSearchParams(location.search);
  let group = params.get("grupo") || "todos";
  if (group !== "todos" && !groups.includes(group)) group = "todos";
  let line = params.get("linha") || "";
  let query = params.get("q") || "";
  if (search) search.value = query;

  function linesFor(currentGroup) {
    const source = currentGroup === "todos" ? pool : pool.filter((item) => item.group === currentGroup);
    return [...new Set(source.map((item) => item.line))].sort((a, b) => a.localeCompare(b, "pt"));
  }

  function paintChips() {
    chips.replaceChildren();
    ["todos", ...groups].forEach((name) => {
      const button = el("button", "chip", name === "todos" ? "Todos" : name);
      button.type = "button";
      button.setAttribute("aria-pressed", String(group === name));
      button.addEventListener("click", () => {
        group = name;
        line = "";
        paint("push");
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
    let items = pool.filter((item) => {
      if (group !== "todos" && item.group !== group) return false;
      if (line && item.line !== line) return false;
      if (!q) return true;
      return `${item.name || ""} ${item.line} ${item.code} ${item.category} ${item.group} ${item.size || ""} ${item.note || ""}`.toLowerCase().includes(q);
    });
    const mode = sortSelect.value;
    if (mode === "menor") items.sort((a, b) => payable(a) - payable(b) || a.code.localeCompare(b.code));
    if (mode === "maior") items.sort((a, b) => payable(b) - payable(a) || a.code.localeCompare(b.code));
    if (mode === "nome") items.sort((a, b) => a.line.localeCompare(b.line, "pt") || a.code.localeCompare(b.code));
    return items;
  }

  function paint(mode) {
    paintChips();
    paintLines();
    const items = filtered();
    grid.replaceChildren(...items.map(cardFor));
    count.textContent = `${items.length} ${items.length === 1 ? "modelo" : "modelos"}`;
    empty.hidden = items.length > 0;
    if (mode === "silent") return;
    const next = new URLSearchParams();
    if (group !== "todos") next.set("grupo", group);
    if (line) next.set("linha", line);
    if (query.trim()) next.set("q", query.trim());
    const qs = next.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    const current = location.pathname + location.search;
    if (url === current) return;
    if (mode === "push") history.pushState(null, "", url);
    else history.replaceState(null, "", url);
  }

  lineSelect.addEventListener("change", () => {
    line = lineSelect.value;
    paint("push");
  });
  sortSelect.addEventListener("change", () => paint("silent"));
  search.addEventListener("input", () => {
    query = search.value;
    paint("replace");
  });
  window.addEventListener("popstate", () => {
    const nextParams = new URLSearchParams(location.search);
    group = nextParams.get("grupo") || "todos";
    if (group !== "todos" && !groups.includes(group)) group = "todos";
    line = nextParams.get("linha") || "";
    query = nextParams.get("q") || "";
    if (search) search.value = query;
    paint("silent");
  });
  paint("replace");

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
      window.open(waHref(`Olá, Luk for Me. Quero entrar no Club e receber lançamentos. Meu e-mail: ${address}`), "_blank", "noopener,noreferrer");
      form.reset();
    });
  });
}

function checkoutUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)infinitepay\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
}

async function startCheckout(product, button, status) {
  const variant = selectedVariant(product);
  button.disabled = true;
  status.hidden = false;
  status.textContent = "Abrindo o pagamento…";
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: product.code, color: variant ? variant.name : "" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !checkoutUrl(data.url)) {
      status.textContent = data.error || "Não foi possível abrir o pagamento. Tente de novo ou peça no WhatsApp.";
      button.disabled = false;
      return;
    }
    location.href = data.url;
  } catch {
    status.textContent = "Sem conexão com o pagamento. Tente de novo ou peça no WhatsApp.";
    button.disabled = false;
  }
}

function initDialog() {
  const dialog = document.getElementById("product-dialog");
  if (!dialog) return;
  const pay = dialog.querySelector("[data-pay]");
  const payStatus = dialog.querySelector("[data-pay-status]");
  if (pay && payStatus) {
    pay.addEventListener("click", () => {
      const product = catalog.find((item) => item.id === dialog.dataset.product);
      if (!product || pay.disabled) return;
      startCheckout(product, pay, payStatus);
    });
  }
  const figure = dialog.querySelector("[data-figure]");
  dialog.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  function setZoom(zoomed) {
    dialog.classList.toggle("is-zoomed", zoomed);
    figure?.setAttribute("aria-label", zoomed ? "Reduzir a foto" : "Ampliar a foto da armação");
  }
  dialog.addEventListener("close", () => setZoom(false));
  dialog.addEventListener("cancel", (event) => {
    if (!dialog.classList.contains("is-zoomed")) return;
    event.preventDefault();
    setZoom(false);
  });
  figure?.addEventListener("click", () => {
    if (!figure.querySelector("img")) return;
    setZoom(!dialog.classList.contains("is-zoomed"));
  });
}

function initWaTexts() {
  document.querySelectorAll("[data-wa-text]").forEach((link) => {
    link.href = waHref(link.getAttribute("data-wa-text"));
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

function initCampaign() {
  initWaTexts();
  if (!campaignOn()) return;
  document.body.classList.add("is-campaign");
  document.querySelectorAll("[data-campaign]").forEach((node) => {
    node.hidden = false;
  });
  document.querySelectorAll(".legal").forEach((row) => {
    const notes = row.querySelectorAll(":scope > span");
    const note = notes[notes.length - 1];
    if (note) note.textContent = "Black November: 20% nas armações até 30/11. Lentes sob receita.";
  });
  document.querySelectorAll(".topbar").forEach((bar) => {
    bar.classList.add("topbar-campaign");
    const link = document.createElement("a");
    link.href = waHref(CAMPAIGN_TEXT);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Black November · 20% nas armações da loja · até 30/11";
    bar.replaceChildren(link);
  });
}

function initRotator() {
  const root = document.querySelector("[data-rotator]");
  if (!root) return;
  if (!campaignOn()) {
    root.querySelectorAll("[data-rotator-campaign]").forEach((node) => node.remove());
  }
  const slides = [...root.querySelectorAll(".rotator-slide")];
  const dots = root.querySelector(".rotator-dots");
  if (!slides.length) return;
  let index = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
  let timer = 0;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buttons = slides.map((slide, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", slide.getAttribute("data-label") || `Campanha ${i + 1}`);
    button.addEventListener("click", () => {
      show(i);
      start();
    });
    dots.append(button);
    return button;
  });
  if (slides.length < 2) dots.hidden = true;

  function show(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const on = i === index;
      slide.classList.toggle("is-active", on);
      slide.setAttribute("aria-hidden", on ? "false" : "true");
      if (on) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });
    buttons.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
  }

  function start() {
    stop();
    if (reduce || slides.length < 2) return;
    timer = window.setInterval(() => show(index + 1), 3000);
  }

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) start();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    if (event.target.closest("a, input, textarea")) return;
    event.preventDefault();
    show(index + (event.key === "ArrowRight" ? 1 : -1));
    start();
  });

  show(index);
  start();
}

function brlFromCents(cents) {
  return brl(Number(cents || 0) / 100);
}

function methodLabel(method) {
  if (method === "pix") return "Pix";
  if (method === "credit_card") return "cartão";
  return "InfinitePay";
}

function initOrder() {
  const title = document.querySelector("[data-order-title]");
  if (!title) return;
  const copy = document.querySelector("[data-order-copy]");
  const amount = document.querySelector("[data-order-amount]");
  const actions = document.querySelector("[data-order-actions]");
  const wa = document.querySelector("[data-order-wa]");
  const receipt = document.querySelector("[data-order-receipt]");
  const params = new URLSearchParams(location.search);
  const orderNsu = params.get("order_nsu") || "";
  const transactionNsu = params.get("transaction_nsu") || "";
  const slug = params.get("slug") || "";
  const receiptUrl = params.get("receipt_url") || "";

  function showPending(message) {
    title.textContent = "Pagamento ainda não confirmado";
    copy.textContent = message;
  }

  if (!orderNsu || !transactionNsu || !slug) {
    title.textContent = "Pedido";
    copy.textContent = "Esta página confirma o pagamento de uma armação feito pelo site. Escolha o modelo para pagar.";
    actions.hidden = false;
    wa.href = "/oculos-de-sol";
    wa.textContent = "Ver óculos de sol";
    return;
  }

  async function confirm(attempt) {
    try {
      const response = await fetch("/api/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNsu,
          transactionNsu,
          slug,
          receiptUrl
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showPending(data.error || "Não consegui confirmar agora. Atualize a página em instantes.");
        return;
      }
      if (!data.paid) {
        if (attempt < 3) {
          setTimeout(() => confirm(attempt + 1), 2000);
          return;
        }
        showPending("A InfinitePay ainda não marcou este pagamento como aprovado. Se você acabou de pagar, aguarde e atualize a página.");
        return;
      }
      const piece = data.description || `armação ${data.code || ""}`.trim();
      const paid = brlFromCents(data.cents);
      title.textContent = "Pagamento confirmado";
      copy.textContent = `${piece} ${paid ? `· ${paid}` : ""} via ${methodLabel(data.method)}. A lente ainda não está incluída. Envie a receita no WhatsApp para o orçamento.`;
      if (data.cents) {
        amount.hidden = false;
        amount.textContent = paid;
      }
      actions.hidden = false;
      const message = `Olá, Luk for Me. Paguei a armação ${piece}${paid ? `, ${paid}` : ""}. Pedido ${orderNsu}.`;
      wa.href = waHref(message);
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";
      if (typeof data.receiptUrl === "string" && data.receiptUrl.startsWith("https://")) {
        receipt.hidden = false;
        receipt.href = data.receiptUrl;
      }
    } catch {
      showPending("Sem conexão para confirmar o pagamento. Atualize a página.");
    }
  }

  confirm(1);
}

document.getElementById("ano") && (document.getElementById("ano").textContent = String(new Date().getFullYear()));
initNav();
initCounts();
initFeatured();
initCatalog();
initForms();
initDialog();
initCampaign();
initRotator();
initOrder();
