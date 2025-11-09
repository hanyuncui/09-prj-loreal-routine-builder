// ======================
// Auto-detect RTL Language
// ======================
const rtlLangs = ["ar", "he", "fa", "ur"]; // Arabic, Hebrew, Persian, Urdu
const userLang = navigator.language || navigator.userLanguage;
const langCode = userLang.slice(0, 2).toLowerCase();

if (rtlLangs.includes(langCode)) {
  document.documentElement.setAttribute("dir", "rtl");
  document.body.classList.add("rtl-mode");
} else {
  document.documentElement.setAttribute("dir", "ltr");
  document.body.classList.remove("rtl-mode");
}


/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const productSearch = document.getElementById("productSearch"); // 新增搜索输入引用

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
let productsCache = []; // 缓存所有产品
async function loadProducts() {
  if (productsCache.length) return productsCache;
  const response = await fetch("products.json");
  const data = await response.json();
  productsCache = data.products;
  return productsCache;
}

/* Manage selected product IDs in localStorage */
let selectedIds = new Set(
  JSON.parse(localStorage.getItem("selectedProductIds") || "[]")
);

function saveSelectedIds() {
  localStorage.setItem(
    "selectedProductIds",
    JSON.stringify(Array.from(selectedIds))
  );
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = ""; // 清空旧内容

  if (!products || products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">No products found</div>
    `;
    return;
  }

  const maxVisible = 6;
  let showingAll = false;

  // 渲染前 n 个
  function render(limit) {
    const visibleProducts = products.slice(0, limit);
    const productHTML = visibleProducts
      .map((product) => {
        const isSelected = selectedIds.has(product.id);
        return `
          <div class="product-card ${isSelected ? "selected" : ""}" data-id="${product.id}">
            <img src="${product.image}" alt="${product.name}">
            <div class="product-info">
              <h3>${product.name}</h3>
              <p>${product.brand}</p>
              <button class="toggle-desc" aria-expanded="false">Details</button>
              <div class="product-desc" hidden>${product.description}</div>
            </div>
          </div>
        `;
      })
      .join("");

    // 插入产品卡片
    productsContainer.innerHTML = productHTML;

    // 如果产品数超过 6，就加按钮
    if (products.length > maxVisible) {
      const btn = document.createElement("button");
      btn.className = "show-more-btn";
      btn.textContent = showingAll ? "Show Less" : "Show More";

      btn.addEventListener("click", () => {
        showingAll = !showingAll;
        if (showingAll) {
          render(products.length);
          btn.textContent = "Show Less";
        } else {
          render(maxVisible);
          btn.textContent = "Show More";
        }
      });

      // 重新渲染后再插入按钮
      productsContainer.appendChild(btn);
    }
  }

  render(maxVisible);
}


/* 新：根据当前 category + 搜索关键字 返回过滤后的产品数组 */
async function getFilteredProducts() {
  await loadProducts();
  const category = categoryFilter.value;
  const q = (productSearch && productSearch.value.trim().toLowerCase()) || "";
  let result = productsCache.slice();
  if (category) {
    result = result.filter((p) => p.category === category);
  }
  if (q) {
    result = result.filter((p) => {
      const hay = `${p.name} ${p.brand} ${p.description}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return result;
}

/* Event delegation for product interactions (select & toggle description) */
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return;
  const id = Number(card.getAttribute("data-id"));

  // If clicked the Details button, toggle description only
  if (e.target.classList.contains("toggle-desc")) {
    const desc = card.querySelector(".product-desc");
    const btn = e.target;
    const expanded = btn.getAttribute("aria-expanded") === "true";
    if (desc) {
      desc.hidden = expanded;
      btn.setAttribute("aria-expanded", String(!expanded));
    }
    return;
  }

  // Otherwise toggle selection
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    card.classList.remove("selected");
  } else {
    selectedIds.add(id);
    card.classList.add("selected");
  }
  saveSelectedIds();
  updateSelectedProductsUI();
});

/* Update Selected Products UI */
async function updateSelectedProductsUI() {
  // Ensure we have products cached
  await loadProducts();
  const selectedArray = Array.from(selectedIds)
    .map((id) => productsCache.find((p) => p.id === id))
    .filter(Boolean);

  // render list items with remove buttons
  selectedProductsList.innerHTML = selectedArray.length
    ? selectedArray
        .map(
          (p) => `
    <div class="selected-item" data-id="${p.id}">
      <strong>${p.brand}</strong> — ${p.name}
      <button class="remove-item" aria-label="Remove">✕</button>
    </div>
  `
        )
        .join("")
    : `<div class="placeholder-message">No products selected</div>`;

  // Sync grid rendering with active filters (category + search)
  const anyFilterActive =
    categoryFilter.value || (productSearch && productSearch.value.trim());
  if (anyFilterActive) {
    const filtered = await getFilteredProducts();
    if (filtered.length) displayProducts(filtered);
    else
      productsContainer.innerHTML = `<div class="placeholder-message">No products found</div>`;
    // reapply selected classes for visible cards
    Array.from(productsContainer.querySelectorAll(".product-card")).forEach(
      (card) => {
        const id = Number(card.getAttribute("data-id"));
        if (selectedIds.has(id)) card.classList.add("selected");
      }
    );
  } else {
    // no filters active: keep placeholder until user chooses category/search
  }
}

/* Remove from selected list by clicking remove button (event delegation) */
selectedProductsList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-item")) return;
  const item = e.target.closest(".selected-item");
  if (!item) return;
  const id = Number(item.getAttribute("data-id"));
  selectedIds.delete(id);
  saveSelectedIds();
  updateSelectedProductsUI();
  // Also remove highlight from grid if visible
  const card = productsContainer.querySelector(
    `.product-card[data-id="${id}"]`
  );
  if (card) card.classList.remove("selected");
});

/* Add Clear All button handling (created in HTML) */
const clearBtn = document.getElementById("clearSelections");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    selectedIds.clear();
    saveSelectedIds();
    updateSelectedProductsUI();
    // remove selected class from any visible cards
    document
      .querySelectorAll(".product-card.selected")
      .forEach((c) => c.classList.remove("selected"));
  });
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const filteredProducts = await getFilteredProducts();
  if (filteredProducts.length) {
    displayProducts(filteredProducts);
  } else {
    productsContainer.innerHTML = `<div class="placeholder-message">No products found</div>`;
  }
});

/* 新：搜索输入实时过滤（与类别过滤组合） */
if (productSearch) {
  productSearch.addEventListener("input", async (e) => {
    // show matching products while typing
    const filteredProducts = await getFilteredProducts();
    if (filteredProducts.length) {
      displayProducts(filteredProducts);
    } else {
      productsContainer.innerHTML = `<div class="placeholder-message">No products found</div>`;
    }
    // keep selected visuals in sync
    // (updateSelectedProductsUI will refresh selected list and re-render grid if appropriate)
    // but we want selection badges immediately, so reapply selected classes:
    Array.from(productsContainer.querySelectorAll(".product-card")).forEach(
      (card) => {
        const id = Number(card.getAttribute("data-id"));
        if (selectedIds.has(id)) card.classList.add("selected");
        else card.classList.remove("selected");
      }
    );
  });
}

/* Chat / AI integration */

/* conversation history in OpenAI messages format */
let messagesHistory = []; // array of {role, content}

/* Helper: append message to chat window */
function appendChatMessage(role, text) {
  const el = document.createElement("div");
  el.className = `chat-message ${role}`;
  el.textContent = text;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send messages array to Cloudflare Worker, expect OpenAI-like response:
   The worker should return an object where data.choices[0].message.content exists.
*/
async function sendToWorker(messages) {
  if (typeof WORKER_URL === "undefined" || !WORKER_URL) {
    throw new Error("WORKER_URL not found. Check secrets.js inclusion order.");
  }

  console.log("📤 Sending to Worker:", WORKER_URL, messages);

  // 确保消息格式正确
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages array is empty or invalid.");
  }

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Worker error: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log("📩 Response from Worker:", data);

  if (
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
  ) {
    return data.choices[0].message.content;
  }
  if (data && data.content) return data.content;
  throw new Error("Unexpected worker response format.");
}

/* Generate Routine button handler */
generateRoutineBtn.addEventListener("click", async () => {
  // collect selected product objects
  await loadProducts();
  const selectedProducts = Array.from(selectedIds)
    .map((id) => productsCache.find((p) => p.id === id))
    .filter(Boolean);

  if (!selectedProducts.length) {
    chatWindow.innerHTML =
      "Please select at least one product to generate a routine.";
    return;
  }

  // Build initial messages. System: assistant behavior + product context
  const systemContent =
    "You are a helpful beauty assistant. Use only the provided product information to create a simple step-by-step personalized routine (morning/night and usage order). Keep it concise and beginner-friendly.";
  const productContext = `Products JSON:\n${JSON.stringify(
    selectedProducts.map((p) => ({
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.description,
    })),
    null,
    2
  )}`;

  messagesHistory = [
    { role: "system", content: systemContent },
    {
      role: "user",
      content: `Create a personalized routine using these products:\n\n${productContext}`,
    },
  ];

  chatWindow.innerHTML = "Generating routine...";
  try {
    const assistantText = await sendToWorker(messagesHistory);
    // display assistant response
    chatWindow.innerHTML = "";
    appendChatMessage("assistant", assistantText);
    // store assistant message into history so follow-ups keep context
    messagesHistory.push({ role: "assistant", content: assistantText });
  } catch (err) {
    chatWindow.innerHTML = `Error: ${err.message}`;
  }
});

/* Chat follow-up form: send user message along with conversation history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;
  appendChatMessage("user", text);
  input.value = "";

  // Append to history and send full history
  messagesHistory.push({ role: "user", content: text });
  appendChatMessage("assistant", "Thinking..."); // temporary

  try {
    const assistantText = await sendToWorker(messagesHistory);
    // remove last "Thinking..." and append actual
    const thinking = chatWindow.querySelector(
      ".chat-message.assistant:last-child"
    );
    if (thinking && thinking.textContent === "Thinking...") thinking.remove();
    appendChatMessage("assistant", assistantText);
    messagesHistory.push({ role: "assistant", content: assistantText });
  } catch (err) {
    const thinking = chatWindow.querySelector(
      ".chat-message.assistant:last-child"
    );
    if (thinking && thinking.textContent === "Thinking...") thinking.remove();
    appendChatMessage("assistant", `Error: ${err.message}`);
  }
});

/* Initialize: load products cache and restore selected UI on page load */
(async function init() {
  await loadProducts();
  updateSelectedProductsUI();

  // 💬 在聊天窗口显示默认欢迎消息
  chatWindow.innerHTML = "";
  appendChatMessage(
    "assistant",
    "👋 Hi! I'm your L’Oréal beauty assistant. Ask me anything about your skincare or makeup routine ✨"
  );

  // 初始化对话历史
  messagesHistory = [
    {
      role: "system",
      content:
        "You are a friendly and knowledgeable L’Oréal beauty assistant. Always answer in a warm, concise tone with product insights and skincare tips.",
    },
    {
      role: "assistant",
      content:
        "Hi! I'm your L’Oréal beauty assistant. Ask me anything about your skincare or makeup routine ✨",
    },
  ];
})();
