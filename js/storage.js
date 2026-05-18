const STORAGE_KEYS = {
  users: "ttp_users",
  currentUserId: "ttp_current_user_id",
  transactions: "ttp_transactions",
  budgets: "ttp_budgets",
  bills: "ttp_bills",
  alertsSeen: "ttp_alerts_seen",
  savingsPlan: "ttp_savings_plan"
};

const CATEGORIES = [
  "FOOD_AND_DRINKS",
  "BILLS_AND_UTILITIES",
  "TRANSPORTATION",
  "ENTERTAINMENT",
  "PERSONAL",
  "INCOME",
  "HEALTHCARE",
  "SAVINGS",
  "OTHER"
];

function loadFromStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function getCurrentUserId() {
  const raw = localStorage.getItem(STORAGE_KEYS.currentUserId);
  if (!raw) return 0;
  return Number(raw);
}

function getAllUsers() {
  return loadFromStorage(STORAGE_KEYS.users, []);
}

function saveAllUsers(users) {
  saveToStorage(STORAGE_KEYS.users, users);
}

function getCurrentUser() {
  const userId = getCurrentUserId();
  const users = getAllUsers();
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === userId) {
      return users[i];
    }
  }
  return null;
}

function getCurrentUserData() {
  const userId = getCurrentUserId();

  const allTx = loadFromStorage(STORAGE_KEYS.transactions, []);
  const allBudgets = loadFromStorage(STORAGE_KEYS.budgets, []);
  const allBills = loadFromStorage(STORAGE_KEYS.bills, []);
  const allPlans = loadFromStorage(STORAGE_KEYS.savingsPlan, []);

  const transactions = allTx.filter((t) => t.userId === userId);
  const budgets = allBudgets.filter((b) => b.userId === userId);

  const bills = allBills
    .filter((b) => b.userId === userId)
    .map((b) => ({
      id: b.id,
      userId: b.userId,
      name: b.name,
      amount: b.amount,
      dueDate: b.dueDate,
      reminderEnabled: b.reminderEnabled !== false,
      autoPayEnabled: b.autoPayEnabled === true,
      paid: b.paid === true,
      paidDate: b.paidDate || null
    }));

  const savingsPlans = allPlans
    .filter((p) => p.userId === userId)
    .map((p) => ({
      id: p.id,
      userId: p.userId,
      description: p.description || "",
      targetAmount: Number(p.targetAmount || 0),
      mode: p.mode || "PERCENT",
      percentIncome: Number(p.percentIncome || 0),
      fixedAmount: Number(p.fixedAmount || 0),
      frequency: p.frequency || "MONTHLY",
      recurring: p.recurring !== false,
      active: p.active !== false
    }));

  return {
    userId: userId,
    transactions: transactions,
    budgets: budgets,
    bills: bills,
    savingsPlans: savingsPlans
  };
}

function savingsPlanBalance(transactions, planId, monthOnly) {
  const ym = new Date().toISOString().slice(0, 7);
  let balance = 0;
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (t.savingsPlanId !== planId) continue;
    if (monthOnly && String(t.date).slice(0, 7) !== ym) continue;
    if (t.savingsFlow === "ADDED") {
      balance += t.amount;
    } else if (t.savingsFlow === "REMOVED") {
      balance -= t.amount;
    }
  }
  return balance;
}

function parseMoney(text) {
  const cleaned = String(text || "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return num;
}

function parseSignedMoney(text) {
  const raw = String(text || "").trim();
  if (raw === "") return null;
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(raw)) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  let sign = "";
  if (raw.charAt(0) === "+") sign = "+";
  if (raw.charAt(0) === "-") sign = "-";
  return { value: Math.abs(num), sign: sign };
}

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateForDisplay(value) {
  const text = String(value || "");
  const parts = text.split("-");
  if (parts.length !== 3) return text;
  return parts[1] + "/" + parts[2] + "/" + parts[0];
}

function setAppError(message) {
  const box = document.getElementById("appError");
  if (box) box.textContent = message;
}
function clearAppError() {
  setAppError("");
}

function isIncomeType(type) {
  return type === "INCOME" || type === "REFUND";
}
function isExpenseType(type) {
  return !isIncomeType(type);
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

function monthTransactions(transactions, ym) {
  return transactions.filter((t) => String(t.date).slice(0, 7) === ym);
}

function sums(transactions) {
  let income = 0;
  let expense = 0;
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (isIncomeType(t.type)) {
      income += t.amount;
    } else if (isExpenseType(t.type)) {
      expense += t.amount;
    }
    if (t.type === "REFUND") {
      expense -= t.amount;
    }
  }
  if (expense < 0) expense = 0;
  return { income: income, expense: expense, balance: income - expense };
}

function netCategorySpend(transactions, category) {
  let total = 0;
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (t.category !== category) continue;
    if (t.type === "REFUND") {
      total -= t.amount;
    } else if (isExpenseType(t.type)) {
      total += t.amount;
    }
  }
  if (total < 0) total = 0;
  return total;
}

function budgetRows(transactions, budgets) {
  const rows = [];
  for (let i = 0; i < budgets.length; i++) {
    const b = budgets[i];
    const used = netCategorySpend(transactions, b.category);
    rows.push({
      id: b.id,
      userId: b.userId,
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      used: used,
      remaining: b.monthlyLimit - used
    });
  }
  return rows;
}
