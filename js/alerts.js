function alertEntries(transactions, budgets, bills) {
  const alerts = [];
  const month = new Date().toISOString().slice(0, 7);
  const monthTx = monthTransactions(transactions, month);
  const monthSums = sums(monthTx);

  if (monthSums.balance < 0) {
    alerts.push({
      id: "overdraft-negative-balance",
      text: "Overdraft alert: Your balance is below $0."
    });
  }

  const rows = budgetRows(monthTx, budgets);
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    if (b.remaining < 0) {
      alerts.push({
        id: `budget-exceeded-${b.category}`,
        text: `Budget exceeded for ${b.category}`
      });
    } else if (b.remaining <= b.monthlyLimit * 0.1) {
      alerts.push({
        id: `budget-warning-${b.category}`,
        text: `Budget almost reached for ${b.category}`
      });
    }
  }

  const today = getTodayIso();
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];
    const status = billStatus(bill, today);
    if (status === "LATE") {
      alerts.push({
        id: `bill-late-${bill.id}`,
        text: `Late bill: ${bill.name}`
      });
      continue;
    }
    const due = String(bill.dueDate || "");
    const isUpcoming = !bill.paid && bill.reminderEnabled && due >= today && due <= inThreeDays;
    if (isUpcoming) {
      alerts.push({
        id: `bill-upcoming-${bill.id}`,
        text: `Upcoming bill: ${bill.name}`
      });
    }
  }

  return alerts;
}

function seenMap() {
  return loadFromStorage(STORAGE_KEYS.alertsSeen, {});
}

function unseenAlerts(entries) {
  const seen = seenMap();
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    if (!seen[entries[i].id]) {
      out.push(entries[i]);
    }
  }
  return out;
}

function alertsHtml(entries, mode) {
  const seen = seenMap();
  const list = mode === "home" ? unseenAlerts(entries) : entries;

  if (list.length === 0) {
    const empty = mode === "home" ? "No active alerts right now" : "No alerts right now";
    return `<p class='muted'>${empty}</p>`;
  }

  let html = "";
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let actionsHtml = "";
    let statusHtml = "";

    if (mode === "home") {
      actionsHtml = `
        <div class="actions">
          <button class="ghost" onclick="markAlertSeenOnly('${a.id}')">Mark Seen</button>
        </div>
      `;
    } else {
      const isSeen = !!seen[a.id];
      const cls = isSeen ? "green" : "red";
      const statusLabel = isSeen ? "Seen" : "Unseen";
      statusHtml = `<small class="${cls}">${statusLabel}</small>`;

      const buttonLabel = isSeen ? "Mark Unseen" : "Mark Seen";
      const newValue = isSeen ? "false" : "true";
      actionsHtml = `
        <div class="actions">
          <button class="ghost" onclick="setAlertSeen('${a.id}', ${newValue})">${buttonLabel}</button>
        </div>
      `;
    }

    html += `
      <div class="list-item">
        <div class="line">
          <strong>${a.text}</strong>
          ${statusHtml}
        </div>
        ${actionsHtml}
      </div>
    `;
  }
  return html;
}

function renderAlertsTab(entries) {
  const target = document.getElementById("screenAlerts");
  target.innerHTML = `
    <h2>Alerts</h2>
    <p class="muted">Review alerts and mark them as seen</p>
    <div class="card">${alertsHtml(entries, "alerts")}</div>
  `;
}

function setAlertSeen(alertId, isSeen) {
  const seen = seenMap();
  if (isSeen) {
    seen[alertId] = true;
  } else {
    delete seen[alertId];
  }
  saveToStorage(STORAGE_KEYS.alertsSeen, seen);
  render();
  showTab(selectedTab, true);
}

function markAlertSeenOnly(alertId) {
  setAlertSeen(alertId, true);
}
