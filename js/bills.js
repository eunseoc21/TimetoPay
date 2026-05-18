function billStatus(bill, todayIso) {
  const today = todayIso || getTodayIso();
  if (bill.paid) return "PAID";
  const due = String(bill.dueDate || "");
  if (due < today) return "LATE";
  if (due === today) return "DUE_TODAY";
  return "UNPAID";
}

function billStatusLabel(status) {
  if (status === "PAID") return "Paid";
  if (status === "LATE") return "Late";
  if (status === "DUE_TODAY") return "Due today";
  return "Unpaid";
}

function processAutomaticBillsForUser(userId) {
  const allBills = loadFromStorage(STORAGE_KEYS.bills, []);
  const allTx = loadFromStorage(STORAGE_KEYS.transactions, []);
  const today = getTodayIso();
  let billsChanged = false;
  let txChanged = false;

  for (let i = 0; i < allBills.length; i++) {
    const bill = allBills[i];
    if (bill.userId !== userId) continue;

    if (bill.reminderEnabled === undefined) {
      bill.reminderEnabled = true;
      billsChanged = true;
    }
    if (bill.autoPayEnabled === undefined) {
      bill.autoPayEnabled = false;
      billsChanged = true;
    }
    if (bill.paid === undefined) {
      bill.paid = false;
      billsChanged = true;
    }
    if (!bill.paidDate) {
      bill.paidDate = null;
    }

    const due = String(bill.dueDate || "");
    if (!bill.paid && bill.autoPayEnabled && due <= today) {
      bill.paid = true;
      bill.paidDate = today;
      billsChanged = true;

      allTx.push({
        id: makeId(),
        userId: userId,
        amount: Math.abs(Number(bill.amount || 0)),
        type: "EXPENSE",
        merchant: `Bill Payment: ${bill.name}`,
        date: today,
        category: "BILLS_AND_UTILITIES",
        notes: `Auto-paid bill #${bill.id}`
      });
      txChanged = true;
    }
  }

  if (billsChanged) saveToStorage(STORAGE_KEYS.bills, allBills);
  if (txChanged) saveToStorage(STORAGE_KEYS.transactions, allTx);
}

function renderBills(bills) {
  const target = document.getElementById("screenBills");

  const sortedBills = bills.slice();
  sortedBills.sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));

  target.innerHTML = `
    <h2>Bills</h2>
    <p class="muted">Track dues, payment status, and auto-pay</p>

    <form class="form" id="billForm">
      <label>Bill name</label><input id="billName" required />
      <label>Amount</label><input id="billAmount" required />
      <label>Due date</label><input id="billDate" type="date" value="${getTodayIso()}" />
      <label><input id="billReminder" type="checkbox" checked style="width:auto;" /> Reminder enabled</label>
      <label><input id="billAutoPay" type="checkbox" style="width:auto;" /> Auto pay on due date</label>
      <button class="primary" type="submit">Save Bill</button>
    </form>

    <div class="card">${billListHtml(sortedBills)}</div>
  `;

  bindBillForm();
}

function billListHtml(sortedBills) {
  if (sortedBills.length === 0) {
    return "<p class='muted'>No bills yet</p>";
  }
  let html = "";
  for (let i = 0; i < sortedBills.length; i++) {
    const b = sortedBills[i];
    const status = billStatus(b);
    const paidNote = b.paidDate ? ` • Paid ${formatDateForDisplay(b.paidDate)}` : "";
    const payButton = !b.paid
      ? `<button class="primary" onclick="payBill(${b.id})">Pay Bill</button>`
      : "";
    const autoPayLabel = b.autoPayEnabled ? "Disable Auto Pay" : "Enable Auto Pay";

    html += `
      <div class="list-item">
        <div class="line">
          <strong>${b.name}</strong>
          <strong>-$${b.amount.toFixed(2)}</strong>
        </div>
        <div class="line">
          <small class="muted">Due ${formatDateForDisplay(b.dueDate)}${paidNote}</small>
          <small class="bill-status ${status.toLowerCase()}">${billStatusLabel(status)}</small>
        </div>
        <div class="actions">
          ${payButton}
          <button class="ghost" onclick="toggleBillAutoPay(${b.id})">${autoPayLabel}</button>
        </div>
      </div>
    `;
  }
  return html;
}

function bindBillForm() {
  const form = document.getElementById("billForm");
  form.onsubmit = (e) => {
    e.preventDefault();
    const amount = parseMoney(document.getElementById("billAmount").value);
    if (amount === null || amount <= 0) {
      setAppError("Enter valid bill amount");
      return;
    }
    const all = loadFromStorage(STORAGE_KEYS.bills, []);
    all.push({
      id: makeId(),
      userId: getCurrentUserId(),
      name: document.getElementById("billName").value.trim(),
      amount: amount,
      dueDate: document.getElementById("billDate").value,
      reminderEnabled: document.getElementById("billReminder").checked,
      autoPayEnabled: document.getElementById("billAutoPay").checked,
      paid: false,
      paidDate: null
    });
    saveToStorage(STORAGE_KEYS.bills, all);
    clearAppError();
    render();
  };
}

function payBill(billId) {
  const userId = getCurrentUserId();
  const allBills = loadFromStorage(STORAGE_KEYS.bills, []);

  let bill = null;
  for (let i = 0; i < allBills.length; i++) {
    if (allBills[i].id === billId && allBills[i].userId === userId) {
      bill = allBills[i];
      break;
    }
  }
  if (!bill) {
    setAppError("Bill not found");
    return;
  }
  if (bill.paid) {
    setAppError("Bill is already paid");
    return;
  }

  const today = getTodayIso();
  bill.paid = true;
  bill.paidDate = today;
  saveToStorage(STORAGE_KEYS.bills, allBills);

  const allTx = loadFromStorage(STORAGE_KEYS.transactions, []);
  allTx.push({
    id: makeId(),
    userId: userId,
    amount: Math.abs(Number(bill.amount || 0)),
    type: "EXPENSE",
    merchant: `Bill Payment: ${bill.name}`,
    date: today,
    category: "BILLS_AND_UTILITIES",
    notes: `Manual bill payment #${bill.id}`
  });
  saveToStorage(STORAGE_KEYS.transactions, allTx);

  clearAppError();
  render();
  showTab("bills", true);
}

function toggleBillAutoPay(billId) {
  const userId = getCurrentUserId();
  const allBills = loadFromStorage(STORAGE_KEYS.bills, []);

  let bill = null;
  for (let i = 0; i < allBills.length; i++) {
    if (allBills[i].id === billId && allBills[i].userId === userId) {
      bill = allBills[i];
      break;
    }
  }
  if (!bill) {
    setAppError("Bill not found");
    return;
  }

  bill.autoPayEnabled = !bill.autoPayEnabled;
  saveToStorage(STORAGE_KEYS.bills, allBills);
  clearAppError();
  render();
  showTab("bills", true);
}
