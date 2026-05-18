let editingSavingsPlanId = null;

const NEW_SAVINGS_FORM = {
  description: "",
  targetAmount: 0,
  mode: "PERCENT",
  percentIncome: 10,
  fixedAmount: 100,
  frequency: "WEEKLY",
  recurring: true,
  active: true
};

function monthlyContributionEstimate(plan, monthlyIncome) {
  if (!plan || !plan.recurring) return 0;
  if (plan.mode === "PERCENT") {
    const pct = Math.max(0, Number(plan.percentIncome || 0));
    return monthlyIncome * (pct / 100);
  }
  const amount = Math.max(0, Number(plan.fixedAmount || 0));
  if (plan.frequency === "DAILY") return amount * 30;
  if (plan.frequency === "WEEKLY") return amount * 4.33;
  return amount;
}

function renderBudgets(budgets, monthTx) {
  const target = document.getElementById("screenBudgets");
  const rows = budgetRows(monthTx, budgets);

  const spendingRows = rows.filter((b) => b.category !== "SAVINGS");

  let savingsBudget = null;
  for (let i = 0; i < budgets.length; i++) {
    if (budgets[i].category === "SAVINGS") {
      savingsBudget = budgets[i];
      break;
    }
  }

  const savingsUsed = netCategorySpend(monthTx, "SAVINGS");

  let monthIncome = 0;
  for (let i = 0; i < monthTx.length; i++) {
    if (isIncomeType(monthTx[i].type)) {
      monthIncome += monthTx[i].amount;
    }
  }

  const data = getCurrentUserData();
  const plans = data.savingsPlans;

  let editingPlan = null;
  for (let i = 0; i < plans.length; i++) {
    if (plans[i].id === editingSavingsPlanId) {
      editingPlan = plans[i];
      break;
    }
  }
  if (editingSavingsPlanId !== null && editingPlan === null) {
    editingSavingsPlanId = null;
  }
  const formPlan = editingPlan || NEW_SAVINGS_FORM;

  let totalProjectedMonthly = 0;
  for (let i = 0; i < plans.length; i++) {
    if (!plans[i].active) continue;
    totalProjectedMonthly += monthlyContributionEstimate(plans[i], monthIncome);
  }

  target.innerHTML = `
    <h2>Budgets</h2>
    <p class="muted">Track category limits and remaining amounts</p>

    <div class="card">
      ${budgetListHtml(spendingRows)}
    </div>

    <form class="form card" id="budgetForm">
      <h3>Add or update budget</h3>
      <label>Category</label>
      <select id="budgetCategory">${budgetCategoryOptionsHtml()}</select>
      <label>Monthly limit</label>
      <input id="budgetLimit" placeholder="250" required />
      <button class="primary" type="submit">Save Budget</button>
    </form>

    <div class="card">
      <h3>Savings plans</h3>
      <p class="muted">${editingPlan ? "Modifying an existing savings plan" : "Add a savings goal, contribution amount, and schedule"}</p>
      ${savingsPlanFormHtml(formPlan, editingPlan !== null)}
      <div class="spacer"></div>
      <small>Saved this month (all plans): <strong>$${savingsUsed.toFixed(2)}</strong></small><br />
      <small>Projected monthly contribution: <strong>$${totalProjectedMonthly.toFixed(2)}</strong></small><br />
      <small>${savingsBudget ? `Savings budget target: $${savingsBudget.monthlyLimit.toFixed(2)}` : "Set a SAVINGS budget for an overall monthly target."}</small>
    </div>

    <div class="card">
      <h3>Your savings plans</h3>
      ${savingsPlansListHtml(plans, data.transactions)}
    </div>
  `;

  bindBudgetForm();
  bindSavingsPlanForm();
  bindSavingsPlanListButtons();
}

function budgetListHtml(spendingRows) {
  if (spendingRows.length === 0) {
    return "<p class='muted'>No spending budgets yet</p>";
  }
  let html = "";
  for (let i = 0; i < spendingRows.length; i++) {
    const b = spendingRows[i];
    let colorClass;
    if (b.remaining <= 0) {
      colorClass = "red";
    } else if (b.remaining <= 20) {
      colorClass = "orange";
    } else {
      colorClass = "green";
    }
    const percentUsed = Math.min(100, (b.used / (b.monthlyLimit || 1)) * 100);
    html += `
      <div class="list-item">
        <div class="line">
          <strong>${b.category.replaceAll("_", " ")}</strong>
          <strong class="${colorClass}">$${b.remaining.toFixed(2)} left</strong>
        </div>
        <small>Used $${b.used.toFixed(2)} of $${b.monthlyLimit.toFixed(2)}</small>
        <div class="progress"><div style="width:${percentUsed}%"></div></div>
      </div>
    `;
  }
  return html;
}

function budgetCategoryOptionsHtml() {
  let html = "";
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    if (c === "INCOME" || c === "SAVINGS") continue;
    html += `<option>${c}</option>`;
  }
  return html;
}

function savingsPlanFormHtml(plan, isEditing) {
  const isPercent = plan.mode === "PERCENT";
  const isFixed = plan.mode === "FIXED";
  const submitLabel = isEditing ? "Save Changes" : "Save Savings Plan";

  const editControls = isEditing
    ? `
      <button class="ghost" type="button" id="deleteSavingsPlanBtn">Delete</button>
      <button class="ghost" type="button" id="cancelEditSavingsBtn">Cancel</button>
    `
    : "";

  const targetValue = plan.targetAmount > 0 ? plan.targetAmount : "";

  return `
    <form class="form" id="savingsPlanForm">
      <label>Goal description</label>
      <input id="savingsDescription" placeholder="Laptop Fund" value="${plan.description || ""}" required />

      <label>Goal target amount ($)</label>
      <input id="savingsTargetAmount" placeholder="1500" value="${targetValue}" required />

      <label>Contribution mode</label>
      <select id="savingsMode">
        <option value="PERCENT" ${isPercent ? "selected" : ""}>Percent of monthly income</option>
        <option value="FIXED" ${isFixed ? "selected" : ""}>Fixed contribution</option>
      </select>

      <div id="savingsPercentWrap" class="${isPercent ? "" : "hidden"}">
        <label>Percent of income (%)</label>
        <input id="savingsPercentIncome" type="number" min="0" step="0.1" value="${Number(plan.percentIncome || 0)}" />
      </div>

      <div id="savingsFixedWrap" class="${isFixed ? "" : "hidden"}">
        <label>Contribution amount</label>
        <input id="savingsFixedAmount" placeholder="100" value="${Number(plan.fixedAmount || 0)}" />
        <label>Contribution frequency</label>
        <select id="savingsFrequency">
          <option value="DAILY" ${plan.frequency === "DAILY" ? "selected" : ""}>Daily</option>
          <option value="WEEKLY" ${plan.frequency === "WEEKLY" ? "selected" : ""}>Weekly</option>
          <option value="MONTHLY" ${plan.frequency === "MONTHLY" ? "selected" : ""}>Monthly</option>
        </select>
      </div>

      <label>
        <input id="savingsRecurring" type="checkbox" style="width:auto;" ${plan.recurring ? "checked" : ""} />
        Recurring contribution
      </label>
      <label>
        <input id="savingsActive" type="checkbox" style="width:auto;" ${plan.active ? "checked" : ""} />
        Active (show in transaction picker)
      </label>

      <button class="primary" type="submit">${submitLabel}</button>
      ${editControls}
    </form>
  `;
}

function savingsPlansListHtml(plans, transactions) {
  if (plans.length === 0) {
    return "<p class='muted'>No savings plans yet. Use the form above to create one.</p>";
  }
  let html = "";
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const balance = savingsPlanBalance(transactions, plan.id, false);
    const monthBalance = savingsPlanBalance(transactions, plan.id, true);
    const statusLabel = plan.active ? "Active" : "Inactive";
    const statusClass = plan.active ? "green" : "muted";

    let cadence;
    if (plan.mode === "PERCENT") {
      cadence = `${Number(plan.percentIncome || 0)}% of monthly income`;
    } else {
      const fixed = Number(plan.fixedAmount || 0).toFixed(2);
      const freq = String(plan.frequency || "MONTHLY").toLowerCase();
      cadence = `$${fixed} ${freq}`;
    }
    const recurringLabel = plan.recurring ? "recurring" : "one-time";

    const target = Number(plan.targetAmount || 0);
    const progress = target > 0 ? Math.min(100, (Math.max(0, balance) / target) * 100) : 0;
    const reached = target > 0 && balance >= target;
    const completeClass = reached ? " complete" : "";

    let goalLine;
    if (target > 0) {
      goalLine = `<small>$${balance.toFixed(2)} / $${target.toFixed(2)} goal${reached ? " — Goal reached!" : ""}</small>`;
    } else {
      goalLine = `<small class="muted">No goal target set</small>`;
    }

    html += `
      <div class="list-item">
        <div class="line">
          <strong>${plan.description || "(no description)"}</strong>
          <small class="${statusClass}">${statusLabel}</small>
        </div>
        <small class="muted">${cadence} (${recurringLabel})</small><br />
        ${goalLine}
        <div class="savings-bar animate${completeClass}" style="--fill-target:${progress}%"><div></div></div>
        <small class="muted">This month: $${monthBalance.toFixed(2)}</small>
        <div class="actions">
          <button class="ghost" data-savings-modify="${plan.id}">Modify</button>
        </div>
      </div>
    `;
  }
  return html;
}

function bindBudgetForm() {
  const form = document.getElementById("budgetForm");
  form.onsubmit = (e) => {
    e.preventDefault();
    const limit = parseMoney(document.getElementById("budgetLimit").value);
    if (limit === null || limit <= 0) {
      setAppError("Enter valid budget limit");
      return;
    }
    const category = document.getElementById("budgetCategory").value;
    const userId = getCurrentUserId();
    const all = loadFromStorage(STORAGE_KEYS.budgets, []);

    let existing = null;
    for (let i = 0; i < all.length; i++) {
      if (all[i].userId === userId && all[i].category === category) {
        existing = all[i];
        break;
      }
    }
    if (existing !== null) {
      existing.monthlyLimit = limit;
    } else {
      all.push({
        id: makeId(),
        userId: userId,
        category: category,
        monthlyLimit: limit
      });
    }
    saveToStorage(STORAGE_KEYS.budgets, all);
    clearAppError();
    render();
  };
}

function bindSavingsPlanForm() {
  const modeSelect = document.getElementById("savingsMode");
  const percentWrap = document.getElementById("savingsPercentWrap");
  const fixedWrap = document.getElementById("savingsFixedWrap");

  function syncMode() {
    if (modeSelect.value === "PERCENT") {
      percentWrap.classList.remove("hidden");
      fixedWrap.classList.add("hidden");
    } else {
      percentWrap.classList.add("hidden");
      fixedWrap.classList.remove("hidden");
    }
  }
  modeSelect.onchange = syncMode;
  syncMode();

  document.getElementById("savingsPlanForm").onsubmit = (e) => {
    e.preventDefault();
    saveSavingsPlanFromForm();
  };

  const deleteBtn = document.getElementById("deleteSavingsPlanBtn");
  if (deleteBtn) {
    deleteBtn.onclick = () => deleteSavingsPlan(editingSavingsPlanId);
  }
  const cancelBtn = document.getElementById("cancelEditSavingsBtn");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      editingSavingsPlanId = null;
      render();
      showTab("budgets", true);
    };
  }
}

function bindSavingsPlanListButtons() {
  const buttons = document.querySelectorAll("[data-savings-modify]");
  buttons.forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.getAttribute("data-savings-modify"));
      editingSavingsPlanId = id;
      render();
      showTab("budgets", true);
    };
  });
}

function saveSavingsPlanFromForm() {
  const mode = document.getElementById("savingsMode").value;
  const description = document.getElementById("savingsDescription").value.trim();
  const targetAmount = parseMoney(document.getElementById("savingsTargetAmount").value);
  const percentIncome = Number(document.getElementById("savingsPercentIncome").value || 0);
  const fixedAmount = parseMoney(document.getElementById("savingsFixedAmount").value) || 0;
  const frequency = document.getElementById("savingsFrequency").value;
  const recurring = document.getElementById("savingsRecurring").checked;
  const active = document.getElementById("savingsActive").checked;

  if (description === "") {
    setAppError("Goal description is required");
    return;
  }
  if (targetAmount === null || targetAmount <= 0) {
    setAppError("Enter a goal target amount greater than 0");
    return;
  }
  if (mode === "PERCENT" && percentIncome < 0) {
    setAppError("Percent cannot be negative");
    return;
  }
  if (mode === "FIXED" && fixedAmount < 0) {
    setAppError("Contribution amount cannot be negative");
    return;
  }

  const userId = getCurrentUserId();
  const allPlans = loadFromStorage(STORAGE_KEYS.savingsPlan, []);

  if (editingSavingsPlanId !== null) {
    let target = null;
    for (let i = 0; i < allPlans.length; i++) {
      if (allPlans[i].id === editingSavingsPlanId && allPlans[i].userId === userId) {
        target = allPlans[i];
        break;
      }
    }
    if (!target) {
      setAppError("Savings plan not found");
      return;
    }
    target.description = description;
    target.targetAmount = targetAmount;
    target.mode = mode;
    target.percentIncome = Math.max(0, percentIncome);
    target.fixedAmount = Math.max(0, fixedAmount);
    target.frequency = frequency;
    target.recurring = recurring;
    target.active = active;
  } else {
    allPlans.push({
      id: makeId(),
      userId: userId,
      description: description,
      targetAmount: targetAmount,
      mode: mode,
      percentIncome: Math.max(0, percentIncome),
      fixedAmount: Math.max(0, fixedAmount),
      frequency: frequency,
      recurring: recurring,
      active: active
    });
  }

  saveToStorage(STORAGE_KEYS.savingsPlan, allPlans);
  editingSavingsPlanId = null;
  clearAppError();
  render();
  showTab("budgets", true);
}

function deleteSavingsPlan(planId) {
  if (!confirm("Delete this savings plan? Linked transactions will be kept but unlinked.")) return;

  const userId = getCurrentUserId();
  const allPlans = loadFromStorage(STORAGE_KEYS.savingsPlan, []);
  const keptPlans = [];
  for (let i = 0; i < allPlans.length; i++) {
    const p = allPlans[i];
    if (p.id === planId && p.userId === userId) continue;
    keptPlans.push(p);
  }
  saveToStorage(STORAGE_KEYS.savingsPlan, keptPlans);

  const allTx = loadFromStorage(STORAGE_KEYS.transactions, []);
  let txChanged = false;
  for (let i = 0; i < allTx.length; i++) {
    if (allTx[i].userId === userId && allTx[i].savingsPlanId === planId) {
      allTx[i].savingsPlanId = null;
      allTx[i].savingsFlow = null;
      txChanged = true;
    }
  }
  if (txChanged) saveToStorage(STORAGE_KEYS.transactions, allTx);

  if (editingSavingsPlanId === planId) editingSavingsPlanId = null;
  clearAppError();
  render();
  showTab("budgets", true);
}
