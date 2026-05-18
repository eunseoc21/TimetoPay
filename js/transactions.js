let transactionMode = "add";
let editingTransactionId = null;

function renderTransactions(transactions) {
  const sortedHistory = sortTransactionsNewestFirst(transactions);

  let editingTx = null;
  for (let i = 0; i < sortedHistory.length; i++) {
    if (sortedHistory[i].id === editingTransactionId) {
      editingTx = sortedHistory[i];
      break;
    }
  }
  if (transactionMode === "edit" && editingTx === null) {
    transactionMode = "history";
    editingTransactionId = null;
  }

  const isHistoryMode = transactionMode === "history";
  const isEditMode = transactionMode === "edit";

  let title;
  let subtitle;
  if (isHistoryMode) {
    title = "Transaction History";
    subtitle = "Modify your transaction history";
  } else if (isEditMode) {
    title = "Edit Transaction";
    subtitle = "Update existing transaction details";
  } else {
    title = "Add Transaction";
    subtitle = "Enter expense or deposit details";
  }

  const txDate = isEditMode ? editingTx.date : getTodayIso();
  const target = document.getElementById("screenTransactions");

  if (isHistoryMode) {
    target.innerHTML = `
      <h2>${title}</h2>
      <p class="muted">${subtitle}</p>
      ${transactionTabsHtml()}
      <div class="card">${historyListHtml(sortedHistory)}</div>
    `;
    return;
  }

  const data = getCurrentUserData();
  const activeSavingsPlans = data.savingsPlans.filter((p) => p.active);

  const initialCategory = isEditMode ? editingTx.category : "FOOD_AND_DRINKS";
  const initialPlanId = isEditMode && editingTx.savingsPlanId ? editingTx.savingsPlanId : "";
  const showSavingsRow = initialCategory === "SAVINGS";

  let initialAmount = "";
  if (isEditMode) {
    if (editingTx.category === "SAVINGS" && editingTx.savingsFlow === "REMOVED") {
      initialAmount = "-" + editingTx.amount;
    } else {
      initialAmount = String(editingTx.amount);
    }
  }

  target.innerHTML = `
    <h2>${title}</h2>
    <p class="muted">${subtitle}</p>
    ${transactionTabsHtml()}
    <form class="form" id="txForm">
      <label>Amount</label>
      <input id="txAmount" placeholder="-5.00 expense | +5.00 income" value="${initialAmount}" />

      <label>Type (auto)</label>
      <select id="txType" disabled>
        ${typeOptionsHtml(isEditMode ? editingTx.type : "EXPENSE")}
      </select>

      <div id="txMerchantRow">
        <label>Merchant</label>
        <input id="txMerchant" placeholder="Coffee shop" value="${isEditMode ? editingTx.merchant : ""}" />
      </div>

      <label>Date</label>
      <input id="txDate" type="date" value="${txDate}" />

      <label>Category</label>
      <select id="txCategory">
        ${categoryOptionsHtml(initialCategory)}
      </select>

      <div id="txSavingsRow" class="${showSavingsRow ? "" : "hidden"}">
        <label>Savings plan</label>
        <select id="txSavingsPlanId">
          ${savingsPlanOptionsHtml(activeSavingsPlans, initialPlanId)}
        </select>
        <small class="muted">Use - on the amount to remove from savings, no sign or + to add.</small>
      </div>

      <label>Notes</label>
      <textarea id="txNotes" rows="3">${isEditMode ? (editingTx.notes || "") : ""}</textarea>

      <button class="primary" type="submit">${isEditMode ? "Modify Transaction" : "Save Transaction"}</button>
      ${isEditMode ? `<button type="button" class="ghost" id="cancelEditBtn">Cancel Edit</button>` : ""}
    </form>
  `;

  bindTransactionForm(isEditMode);
}

function savingsPlanOptionsHtml(activePlans, selectedId) {
  if (activePlans.length === 0) {
    return `<option value="">No active savings plans (add one in Budget tab)</option>`;
  }
  let html = `<option value="">Select active savings</option>`;
  for (let i = 0; i < activePlans.length; i++) {
    const p = activePlans[i];
    const isSelected = String(p.id) === String(selectedId);
    html += `<option value="${p.id}" ${isSelected ? "selected" : ""}>${p.description || "(no description)"}</option>`;
  }
  return html;
}

function sortTransactionsNewestFirst(transactions) {
  const sorted = transactions.slice();
  sorted.sort((a, b) => {
    if (String(b.date) !== String(a.date)) {
      return String(b.date).localeCompare(String(a.date));
    }
    return Number(b.id) - Number(a.id);
  });
  return sorted;
}

function transactionTabsHtml() {
  const addClass = transactionMode === "add" ? "chip active" : "chip";
  const histClass = transactionMode === "history" ? "chip active" : "chip";
  return `
    <div class="chip-row">
      <button type="button" class="${addClass}" onclick="setTransactionMode('add')">Add</button>
      <button type="button" class="${histClass}" onclick="setTransactionMode('history')">History</button>
    </div>
  `;
}

function historyListHtml(sortedHistory) {
  if (sortedHistory.length === 0) {
    return "<p class='muted'>No transactions yet</p>";
  }

  const data = getCurrentUserData();
  const planNamesById = {};
  for (let i = 0; i < data.savingsPlans.length; i++) {
    const p = data.savingsPlans[i];
    planNamesById[p.id] = p.description || "(no description)";
  }

  let html = "";
  for (let i = 0; i < sortedHistory.length; i++) {
    const tx = sortedHistory[i];
    const sign = isIncomeType(tx.type) ? "+" : "-";
    const colorClass = isIncomeType(tx.type) ? "green" : "red";

    let savingsLine = "";
    if (tx.category === "SAVINGS" && tx.savingsPlanId) {
      const planName = planNamesById[tx.savingsPlanId] || "(deleted plan)";
      const direction = tx.savingsFlow === "REMOVED" ? "Removed" : "Added";
      savingsLine = `<small class="muted">${direction} • ${planName}</small><br />`;
    }

    html += `
      <div class="list-item">
        <div class="line">
          <strong>${tx.merchant}</strong>
          <strong class="${colorClass}">${sign}$${tx.amount.toFixed(2)}</strong>
        </div>
        <small>${tx.category.replaceAll("_", " ")} • ${formatDateForDisplay(tx.date)}</small>
        ${savingsLine ? "<br />" + savingsLine : ""}
        <div class="actions">
          <button class="ghost" onclick="editTransaction(${tx.id})">Edit</button>
          <button class="ghost" onclick="deleteTransaction(${tx.id})">Delete</button>
        </div>
      </div>
    `;
  }
  return html;
}

function typeOptionsHtml(selectedType) {
  const types = ["EXPENSE", "INCOME"];
  let html = "";
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    html += `<option ${t === selectedType ? "selected" : ""}>${t}</option>`;
  }
  return html;
}

function categoryOptionsHtml(selectedCategory) {
  let html = "";
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    html += `<option ${c === selectedCategory ? "selected" : ""}>${c}</option>`;
  }
  return html;
}

function bindTransactionForm(isEditMode) {
  const amountInput = document.getElementById("txAmount");
  const typeSelect = document.getElementById("txType");
  const categorySelect = document.getElementById("txCategory");
  const merchantRow = document.getElementById("txMerchantRow");
  const savingsRow = document.getElementById("txSavingsRow");

  function syncTypeFromAmount() {
    const parsed = parseSignedMoney(amountInput.value);
    if (!parsed) return;
    if (categorySelect.value === "SAVINGS") {
      typeSelect.value = parsed.sign === "-" ? "INCOME" : "EXPENSE";
    } else {
      typeSelect.value = parsed.sign === "+" ? "INCOME" : "EXPENSE";
    }
  }

  function syncSavingsRow() {
    if (categorySelect.value === "SAVINGS") {
      savingsRow.classList.remove("hidden");
      merchantRow.classList.add("hidden");
    } else {
      savingsRow.classList.add("hidden");
      merchantRow.classList.remove("hidden");
    }
    syncTypeFromAmount();
  }

  amountInput.addEventListener("input", syncTypeFromAmount);
  categorySelect.addEventListener("change", syncSavingsRow);
  syncSavingsRow();

  document.getElementById("txForm").onsubmit = (e) => {
    e.preventDefault();
    const parsedAmount = parseSignedMoney(amountInput.value);
    if (!parsedAmount || parsedAmount.value === 0) {
      setAppError("Amount must be a valid number (example: -5.00, 5.00, +5.00)");
      return;
    }

    const date = document.getElementById("txDate").value;
    const category = document.getElementById("txCategory").value;
    const notes = document.getElementById("txNotes").value.trim();

    let resolvedType;
    let merchant;
    let savingsPlanId = null;
    let savingsFlow = null;

    if (category === "SAVINGS") {
      const planIdRaw = document.getElementById("txSavingsPlanId").value;
      if (!planIdRaw) {
        setAppError("Pick an active savings plan, or create one in the Budget tab");
        return;
      }
      savingsPlanId = Number(planIdRaw);
      savingsFlow = parsedAmount.sign === "-" ? "REMOVED" : "ADDED";
      resolvedType = savingsFlow === "ADDED" ? "EXPENSE" : "INCOME";

      const planName = lookupSavingsPlanName(savingsPlanId);
      merchant = savingsFlow === "ADDED" ? `Added to ${planName}` : `Withdrew from ${planName}`;
    } else {
      merchant = document.getElementById("txMerchant").value.trim();
      if (merchant === "") {
        setAppError("Merchant is required");
        return;
      }
      resolvedType = parsedAmount.sign === "+" ? "INCOME" : "EXPENSE";
    }

    const allTransactions = loadFromStorage(STORAGE_KEYS.transactions, []);

    if (isEditMode) {
      const tx = findUserTransaction(allTransactions, editingTransactionId);
      if (!tx) {
        setAppError("Transaction not found");
        return;
      }
      tx.amount = parsedAmount.value;
      tx.type = resolvedType;
      tx.merchant = merchant;
      tx.date = date;
      tx.category = category;
      tx.notes = notes;
      tx.savingsPlanId = savingsPlanId;
      tx.savingsFlow = savingsFlow;
      transactionMode = "history";
      editingTransactionId = null;
    } else {
      allTransactions.push({
        id: makeId(),
        userId: getCurrentUserId(),
        amount: parsedAmount.value,
        type: resolvedType,
        merchant: merchant,
        date: date,
        category: category,
        notes: notes,
        savingsPlanId: savingsPlanId,
        savingsFlow: savingsFlow
      });
    }

    saveToStorage(STORAGE_KEYS.transactions, allTransactions);
    clearAppError();
    render();
    showTab("transactions");
  };

  if (isEditMode) {
    document.getElementById("cancelEditBtn").onclick = () => {
      transactionMode = "history";
      editingTransactionId = null;
      render();
      showTab("transactions");
    };
  }
}

function lookupSavingsPlanName(planId) {
  const data = getCurrentUserData();
  for (let i = 0; i < data.savingsPlans.length; i++) {
    if (data.savingsPlans[i].id === planId) {
      return data.savingsPlans[i].description || "Savings";
    }
  }
  return "Savings";
}

function findUserTransaction(allTransactions, txId) {
  const userId = getCurrentUserId();
  for (let i = 0; i < allTransactions.length; i++) {
    const t = allTransactions[i];
    if (t.id === txId && t.userId === userId) return t;
  }
  return null;
}

function editTransaction(txId) {
  editingTransactionId = txId;
  transactionMode = "edit";
  render();
  showTab("transactions");
}

function deleteTransaction(txId) {
  if (!confirm("Delete this transaction?")) return;
  const userId = getCurrentUserId();
  const all = loadFromStorage(STORAGE_KEYS.transactions, []);
  const kept = [];
  for (let i = 0; i < all.length; i++) {
    const t = all[i];
    if (t.id === txId && t.userId === userId) continue;
    kept.push(t);
  }
  saveToStorage(STORAGE_KEYS.transactions, kept);
  render();
}

function setTransactionMode(mode) {
  if (transactionMode === "edit" && mode !== "edit") {
    openLeaveWarning(() => setTransactionMode(mode));
    return;
  }
  transactionMode = mode;
  if (mode !== "edit") editingTransactionId = null;
  render();
  showTab("transactions");
}
