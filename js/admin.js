const root = document.getElementById("admin");
let products = [];
let draft = null;
let query = "";
let group = "todos";
let status = "";

function brl(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function cover(product) {
  const visible = (product.variants || []).find((variant) => variant.visible && variant.image);
  return product.image || (visible && visible.image) || "";
}

function storeHref(product) {
  const path = product.category === "Solar"
    ? "/oculos-de-sol"
    : (/clip/i.test(product.category) || product.group === "Clip-on" ? "/acessorios" : "/oculos-de-grau");
  return `${path}?modelo=${encodeURIComponent(product.code)}`;
}

async function api(url, options) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options && options.headers) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não consegui concluir.");
  return data;
}

function paintLogin(message) {
  const form = el("form", "admin-login");
  form.append(
    el("h1", "", "Catálogo"),
    el("p", "", "Entre para editar as armações. O que você salvar vai para a loja e para o Google Shopping."),
    el("p", "admin-status", message || "")
  );
  const field = el("div", "admin-field");
  const input = document.createElement("input");
  input.type = "password";
  input.name = "password";
  input.required = true;
  input.autocomplete = "current-password";
  input.placeholder = "Senha";
  field.append(input);
  const button = el("button", "btn btn-dark", "Entrar");
  button.type = "submit";
  form.append(field, button);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: input.value }) });
      await openPanel();
    } catch (error) {
      paintLogin(error.message);
    }
  });
  root.replaceChildren(form);
}

function filtered() {
  const q = query.trim().toLowerCase();
  return products.filter((item) => {
    if (group !== "todos" && item.group !== group) return false;
    if (!q) return true;
    return `${item.title} ${item.name} ${item.code} ${item.line} ${item.category}`.toLowerCase().includes(q);
  });
}

function paint() {
  const shell = el("div", "admin");
  const bar = el("div", "admin-bar");
  const heading = el("div");
  heading.append(el("h1", "", "Catálogo"), el("p", "", "Um salvamento atualiza a loja e o Google Shopping."));
  const logout = el("button", "btn btn-line", "Sair");
  logout.type = "button";
  logout.addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
    draft = null;
    paintLogin();
  });
  bar.append(heading, logout);

  const tools = el("div", "admin-tools");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Buscar código ou nome";
  search.value = query;
  search.addEventListener("input", () => {
    query = search.value;
    paint();
  });
  const select = document.createElement("select");
  const groups = ["todos", ...new Set(products.map((item) => item.group).filter(Boolean))];
  groups.forEach((name) => select.append(new Option(name === "todos" ? "Todas as coleções" : name, name)));
  select.value = groups.includes(group) ? group : "todos";
  select.addEventListener("change", () => {
    group = select.value;
    paint();
  });
  tools.append(search, select);

  const layout = el("div", "admin-layout");
  const list = el("div", "admin-list");
  filtered().forEach((product) => {
    const button = el("button", "admin-item");
    button.type = "button";
    button.setAttribute("aria-pressed", String(draft && draft.id === product.id));
    const src = cover(product);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      button.append(img);
    } else {
      button.append(el("div", "admin-ph"));
    }
    const copy = el("div");
    copy.append(el("strong", "", product.title || product.name || product.line), el("span", "", `${product.code} · ${product.group}`));
    button.append(copy, el("span", "", brl(product.price)));
    button.addEventListener("click", () => {
      draft = JSON.parse(JSON.stringify(product));
      status = "";
      paint();
    });
    list.append(button);
  });

  const editor = el("div", "admin-editor");
  if (!draft) {
    editor.append(el("h2", "", "Escolha uma armação"), el("p", "admin-meta", "A lista reúne todos os modelos do catálogo."));
  } else {
    editor.append(editorForm());
  }
  layout.append(list, editor);
  shell.append(bar, tools, layout);
  root.replaceChildren(shell);
}

function field(label, node) {
  const wrap = el("div", "admin-field");
  wrap.append(el("label", "", label), node);
  return wrap;
}

function editorForm() {
  const form = document.createElement("form");
  form.append(el("h2", "", draft.title || draft.name || draft.code), el("p", "admin-meta", `${draft.code} · ${draft.line} · ${draft.category} · ${draft.group}`));

  const photo = el("div", "admin-photo");
  if (draft.image) {
    const img = document.createElement("img");
    img.src = draft.image;
    img.alt = "";
    photo.append(img);
  }
  const photoInput = document.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/jpeg,image/png,image/webp";
  photoInput.addEventListener("change", () => uploadInto(photoInput, (image) => {
    draft.image = image;
    status = "Foto enviada. Salve para publicar.";
    paint();
  }));
  photo.append(photoInput);
  form.append(field("Foto", photo));

  const title = document.createElement("input");
  title.value = draft.title || "";
  title.maxLength = 80;
  title.addEventListener("input", () => { draft.title = title.value; });
  const subtitle = document.createElement("input");
  subtitle.value = draft.subtitle || "";
  subtitle.maxLength = 120;
  subtitle.addEventListener("input", () => { draft.subtitle = subtitle.value; });
  const description = document.createElement("textarea");
  description.rows = 4;
  description.maxLength = 800;
  description.value = draft.description || "";
  description.addEventListener("input", () => { draft.description = description.value; });
  form.append(field("Título", title), field("Subtítulo", subtitle), field("Descrição", description));

  const measures = el("div", "admin-grid");
  measures.append(
    measure("Horizontal", "horizontal"),
    measure("Ponte", "bridge"),
    measure("Haste", "temple"),
    priceField()
  );
  form.append(measures, el("p", "admin-meta", "Medidas em milímetros. Ponte, haste e horizontal aparecem na ficha da loja."));

  form.append(el("h2", "", "Cores"));
  const colors = el("div", "admin-colors");
  draft.variants.forEach((variant, index) => colors.append(colorRow(variant, index)));
  form.append(colors);
  const add = el("button", "linkish", "Adicionar cor");
  add.type = "button";
  add.addEventListener("click", () => {
    draft.variants.push({ name: `C${draft.variants.length + 1}`, image: "", color: "#8a6844", visible: true });
    paint();
  });
  form.append(add);

  const actions = el("div", "admin-actions");
  const save = el("button", "btn btn-dark", "Salvar");
  save.type = "submit";
  const view = el("a", "btn btn-line", "Ver na loja");
  view.href = storeHref(draft);
  view.target = "_blank";
  actions.append(save, view, el("p", "admin-status", status));
  form.append(actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    status = "Salvando…";
    try {
      const data = await api(`/api/admin/products/${encodeURIComponent(draft.id)}`, {
        method: "PUT",
        body: JSON.stringify(draft)
      });
      const index = products.findIndex((item) => item.id === data.product.id);
      if (index >= 0) products[index] = data.product;
      draft = JSON.parse(JSON.stringify(data.product));
      status = "Salvo na loja e no Google Shopping.";
    } catch (error) {
      status = error.message;
    }
    paint();
  });
  return form;
}

function measure(label, key) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "200";
  input.inputMode = "numeric";
  input.value = draft[key] || "";
  input.addEventListener("input", () => { draft[key] = input.value; });
  return field(label, input);
}

function priceField() {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.step = "0.01";
  input.required = true;
  input.value = draft.price;
  input.addEventListener("input", () => { draft.price = Number(input.value); });
  const wrap = field("Preço", input);
  wrap.classList.add("span-2");
  return wrap;
}

function colorRow(variant, index) {
  const row = el("div", "admin-color");
  const visible = document.createElement("input");
  visible.type = "checkbox";
  visible.checked = variant.visible !== false;
  visible.title = "Aparece para escolher";
  visible.addEventListener("change", () => { variant.visible = visible.checked; });
  const name = document.createElement("input");
  name.value = variant.name || "";
  name.placeholder = "Nome da cor";
  name.addEventListener("input", () => { variant.name = name.value; });
  const color = document.createElement("input");
  color.type = "color";
  color.value = /^#[0-9a-fA-F]{6}$/.test(variant.color || "") ? variant.color : "#8a6844";
  color.addEventListener("input", () => { variant.color = color.value; });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/jpeg,image/png,image/webp";
  file.addEventListener("change", () => uploadInto(file, (image) => {
    variant.image = image;
    if (!draft.image) draft.image = image;
    status = "Foto da cor enviada. Salve para publicar.";
    paint();
  }));
  const remove = el("button", "linkish", "Tirar");
  remove.type = "button";
  remove.addEventListener("click", () => {
    draft.variants.splice(index, 1);
    paint();
  });
  row.append(visible, name, color);
  if (variant.image) {
    const img = document.createElement("img");
    img.src = variant.image;
    img.alt = "";
    row.append(img);
  }
  row.append(file, remove);
  return row;
}

function uploadInto(input, done) {
  const file = input.files && input.files[0];
  if (!file || !draft) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = await api("/api/admin/upload", {
        method: "POST",
        body: JSON.stringify({ code: draft.code, name: file.name, mime: file.type, data: reader.result })
      });
      done(data.image);
    } catch (error) {
      status = error.message;
      paint();
    }
  };
  reader.readAsDataURL(file);
}

async function openPanel() {
  const data = await api("/api/admin/products");
  products = data.products || [];
  paint();
}

api("/api/admin/session").then(openPanel).catch(() => paintLogin());
