const DEMO_EXPENSE_POOL = [
  { merchant: "Starbucks", category: "FOOD_AND_DRINKS", min: 4, max: 14 },
  { merchant: "Chipotle", category: "FOOD_AND_DRINKS", min: 9, max: 22 },
  { merchant: "Target", category: "PERSONAL", min: 18, max: 90 },
  { merchant: "Uber", category: "TRANSPORTATION", min: 11, max: 48 },
  { merchant: "Shell Gas", category: "TRANSPORTATION", min: 28, max: 75 },
  { merchant: "Netflix", category: "ENTERTAINMENT", min: 8, max: 20 },
  { merchant: "ComEd", category: "BILLS_AND_UTILITIES", min: 60, max: 180 },
  { merchant: "Walgreens Pharmacy", category: "HEALTHCARE", min: 12, max: 55 },
  { merchant: "Emergency Fund Transfer", category: "SAVINGS", min: 40, max: 250 },
  { merchant: "Amazon", category: "OTHER", min: 15, max: 140 }
];

const DEMO_INCOME_POOL = [
  { merchant: "Bi-weekly Paycheck", min: 900, max: 2200 },
  { merchant: "Freelance Design", min: 180, max: 950 },
  { merchant: "Tutoring Payment", min: 80, max: 350 },
  { merchant: "Scholarship Deposit", min: 300, max: 1200 },
  { merchant: "Side Gig Delivery", min: 55, max: 260 }
];

const DEMO_BILL_POOL = [
  { name: "Internet", min: 45, max: 95 },
  { name: "Electric", min: 70, max: 190 },
  { name: "Phone", min: 35, max: 95 },
  { name: "Credit Card", min: 90, max: 300 },
  { name: "Water", min: 25, max: 70 },
  { name: "Car Insurance", min: 75, max: 210 }
];

const DEMO_BUDGET_TARGETS = {
  FOOD_AND_DRINKS: 350,
  BILLS_AND_UTILITIES: 420,
  TRANSPORTATION: 260,
  ENTERTAINMENT: 180,
  PERSONAL: 240,
  HEALTHCARE: 160,
  SAVINGS: 300,
  OTHER: 220
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAmount(min, max) {
  const cents = randomInt(min * 100, max * 100);
  return Math.round(cents) / 100;
}

function randomDateBetween(startDate, endDate) {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const pickMs = randomInt(startMs, endMs);
  return new Date(pickMs).toISOString().slice(0, 10);
}

function randomDateWithinPastMonths(monthsBack) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);
  return randomDateBetween(start, end);
}

function randomDateInMonth(ym) {
  const parts = String(ym || "").split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  if (!year || !month) return getTodayIso();
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return randomDateBetween(first, last);
}

function pickRandom(list) {
  if (list.length === 0) return null;
  const i = Math.floor(Math.random() * list.length);
  return list[i];
}

function refundableExpensesForUser(allTransactions, userId) {
  const refundedById = {};
  for (let i = 0; i < allTransactions.length; i++) {
    const t = allTransactions[i];
    if (t.userId !== userId) continue;
    if (t.type !== "REFUND") continue;
    if (!t.refundSourceId) continue;
    refundedById[t.refundSourceId] = (refundedById[t.refundSourceId] || 0) + t.amount;
  }

  const rows = [];
  for (let i = 0; i < allTransactions.length; i++) {
    const t = allTransactions[i];
    if (t.userId !== userId) continue;
    if (t.type !== "EXPENSE") continue;
    const refunded = refundedById[t.id] || 0;
    const remaining = Math.max(0, t.amount - refunded);
    if (remaining > 0) {
      rows.push({ expense: t, remaining: remaining });
    }
  }

  rows.sort((a, b) => {
    if (String(b.expense.date) !== String(a.expense.date)) {
      return String(b.expense.date).localeCompare(String(a.expense.date));
    }
    return Number(b.expense.id) - Number(a.expense.id);
  });
  return rows;
}

function addDemoTransaction(type) {
  if (!getCurrentUserId()) {
    alert("Sign in first to add demo data.");
    return;
  }
  const all = loadFromStorage(STORAGE_KEYS.transactions, []);

  let date;
  if (selectedTab === "reports") {
    date = randomDateInMonth(reportMonth);
  } else {
    date = randomDateWithinPastMonths(6);
  }

  if (type === "INCOME") {
    const item = pickRandom(DEMO_INCOME_POOL);
    all.push({
      id: makeId(),
      userId: getCurrentUserId(),
      amount: randomAmount(item.min, item.max),
      type: "INCOME",
      merchant: item.merchant,
      date: date,
      category: "INCOME",
      notes: "auto demo income"
    });
  } else if (type === "REFUND") {
    addDemoRefund(all, date);
    return;
  } else {
    const item = pickRandom(DEMO_EXPENSE_POOL);
    all.push({
      id: makeId(),
      userId: getCurrentUserId(),
      amount: randomAmount(item.min, item.max),
      type: "EXPENSE",
      merchant: item.merchant,
      date: date,
      category: item.category,
      notes: "auto demo expense"
    });
  }

  saveToStorage(STORAGE_KEYS.transactions, all);
  render();
  showTab(selectedTab, true);
}

function addDemoRefund(all, fallbackDate) {
  const userId = getCurrentUserId();
  const refundableAll = refundableExpensesForUser(all, userId);

  let candidates = refundableAll;
  if (selectedTab === "reports") {
    const inMonth = refundableAll.filter(
      (r) => String(r.expense.date || "").slice(0, 7) === reportMonth
    );
    if (inMonth.length) candidates = inMonth;
  }

  if (candidates.length === 0) {
    alert("No refundable expense transactions found.");
    return;
  }

  const sourceRow = candidates[0];
  const source = sourceRow.expense;
  const refundAmount = sourceRow.remaining;
  if (refundAmount <= 0) {
    alert("Selected expense is already fully refunded.");
    return;
  }

  const sourceDate = new Date(source.date || fallbackDate);
  const today = new Date();
  let refundDate;
  if (sourceDate <= today) {
    refundDate = randomDateBetween(sourceDate, today);
  } else {
    refundDate = today.toISOString().slice(0, 10);
  }

  all.push({
    id: makeId(),
    userId: userId,
    amount: refundAmount,
    type: "REFUND",
    merchant: `Refund: ${source.merchant}`,
    date: refundDate,
    category: source.category,
    refundSourceId: source.id,
    notes: `auto demo refund for transaction #${source.id}`
  });

  saveToStorage(STORAGE_KEYS.transactions, all);
  render();
  showTab(selectedTab, true);
}

function addDemoBudgets() {
  if (!getCurrentUserId()) {
    alert("Sign in first to add demo data.");
    return;
  }
  const all = loadFromStorage(STORAGE_KEYS.budgets, []);
  const userId = getCurrentUserId();
  const categories = Object.keys(DEMO_BUDGET_TARGETS);

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const baseLimit = DEMO_BUDGET_TARGETS[category];

    let alreadyExists = false;
    for (let j = 0; j < all.length; j++) {
      if (all[j].userId === userId && all[j].category === category) {
        alreadyExists = true;
        break;
      }
    }
    if (alreadyExists) continue;

    const variation = baseLimit * (randomInt(-15, 15) / 100);
    const monthlyLimit = Math.max(25, Math.round(baseLimit + variation));
    all.push({
      id: makeId(),
      userId: userId,
      category: category,
      monthlyLimit: monthlyLimit
    });
  }
  saveToStorage(STORAGE_KEYS.budgets, all);
  render();
  showTab(selectedTab, true);
}

function addDemoBills() {
  if (!getCurrentUserId()) {
    alert("Sign in first to add demo data.");
    return;
  }
  const all = loadFromStorage(STORAGE_KEYS.bills, []);
  const item = pickRandom(DEMO_BILL_POOL);

  const dueOffsetDays = randomInt(2, 25);
  const due = new Date();
  due.setDate(due.getDate() + dueOffsetDays);

  all.push({
    id: makeId(),
    userId: getCurrentUserId(),
    name: item.name,
    amount: randomAmount(item.min, item.max),
    dueDate: due.toISOString().slice(0, 10),
    reminderEnabled: true,
    autoPayEnabled: false,
    paid: false,
    paidDate: null
  });
  saveToStorage(STORAGE_KEYS.bills, all);
  render();
  showTab(selectedTab, true);
}

function resetDemo() {
  if (!confirm("Reset all demo data and start over?")) return;
  localStorage.removeItem(STORAGE_KEYS.users);
  localStorage.removeItem(STORAGE_KEYS.currentUserId);
  localStorage.removeItem(STORAGE_KEYS.transactions);
  localStorage.removeItem(STORAGE_KEYS.budgets);
  localStorage.removeItem(STORAGE_KEYS.bills);
  localStorage.removeItem(STORAGE_KEYS.alertsSeen);
  localStorage.removeItem(STORAGE_KEYS.savingsPlan);

  selectedTab = "home";
  transactionMode = "add";
  editingTransactionId = null;
  pendingNavigation = null;
  reportMonth = new Date().toISOString().slice(0, 7);
  closeLeaveWarning();
  render();
}
