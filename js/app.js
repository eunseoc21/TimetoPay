let selectedTab = "home";
let pendingNavigation = null;

let lastRenderedTab = null;

function render() {
  const authScreen = document.getElementById("authScreen");
  const appScreen = document.getElementById("appScreen");
  const bottomNav = document.getElementById("bottomNav");
  const loggedIn = getCurrentUserId() > 0;

  if (loggedIn) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    bottomNav.classList.remove("hidden");
  } else {
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    bottomNav.classList.add("hidden");
    applyTheme("light");
    return;
  }

  const me = getCurrentUser();
  if (me) applyTheme(me.theme || "light");

  processAutomaticBillsForUser(me.id);

  const data = getCurrentUserData();

  const transactions = data.transactions.slice();
  transactions.sort((a, b) => {
    if (b.date !== a.date) return String(b.date).localeCompare(String(a.date));
    return Number(b.id) - Number(a.id);
  });

  const month = new Date().toISOString().slice(0, 7);
  const monthTx = monthTransactions(transactions, month);
  const monthSums = sums(monthTx);

  const optOut = me && me.notificationsOptOut === true;
  const allAlerts = optOut ? [] : alertEntries(transactions, data.budgets, data.bills);
  const alertsThatNeedAttention = optOut ? [] : unseenAlerts(allAlerts);

  const isTabSwitch = lastRenderedTab !== selectedTab;

  if (selectedTab === "home") renderHome(monthSums, monthTx, data, allAlerts, isTabSwitch);
  else if (selectedTab === "transactions") renderTransactions(transactions);
  else if (selectedTab === "budgets") renderBudgets(data.budgets, monthTx);
  else if (selectedTab === "bills") renderBills(data.bills);
  else if (selectedTab === "alerts") renderAlertsTab(allAlerts);
  else if (selectedTab === "reports") renderReports(transactions);
  else if (selectedTab === "profile") renderProfileTab();

  lastRenderedTab = selectedTab;
  showTab(selectedTab);

  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) {
    if (selectedTab === "home") {
      profileBtn.classList.remove("hidden");
    } else {
      profileBtn.classList.add("hidden");
    }
  }

  const homeDot = document.querySelector('#bottomNav button[data-tab="home"] .dot');
  const alertsDot = document.querySelector('#bottomNav button[data-tab="alerts"] .dot');
  const shouldBlink = alertsThatNeedAttention.length > 0;
  if (homeDot) homeDot.classList.toggle("alert-blink", shouldBlink);
  if (alertsDot) alertsDot.classList.toggle("alert-blink", shouldBlink);
}

function renderHome(monthSums, monthTx, data, allAlerts, animateBars) {
  const activePlans = data.savingsPlans.filter((p) => p.active);

  const openBills = data.bills.filter((b) => !b.paid);
  openBills.sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));

  const negativeBalance = monthSums.balance < 0;
  const balanceCardClass = "card " + (negativeBalance ? "danger-card" : "blue");
  const balanceFontPx = balanceFontSize(monthSums.balance);

  document.getElementById("screenHome").innerHTML = `
    <div class="home-compact">
      <div class="home-intro">
        <div class="home-intro-inner">
          <h2>Welcome back</h2>
          <p class="muted">Here is your financial overview</p>
        </div>
      </div>

      <div class="${balanceCardClass}">
        <h3>Current balance</h3>
        <div class="big" style="font-size:${balanceFontPx}">$${formatMoney(monthSums.balance)}</div>
      </div>

      <div class="row">
        <div class="card stat"><h3>Income</h3><strong class="green">$${monthSums.income.toFixed(2)}</strong></div>
        <div class="card stat"><h3>Expenses</h3><strong class="red">$${monthSums.expense.toFixed(2)}</strong></div>
      </div>

      <div class="card">
        <h3>Budget progress</h3>
        <div class="mini-scroll">${homeBudgetRowsHtml(monthTx, data.budgets)}</div>
      </div>

      <div class="card alerts-card">
        <h3>Alerts</h3>
        <div class="spacer"></div>
        <div class="mini-scroll">${alertsHtml(allAlerts, "home")}</div>
      </div>

      <div class="row bottom-panels">
        <div class="card">
          <h3>Upcoming bills</h3>
          <div class="mini-scroll small">${homeUpcomingBillsHtml(openBills)}</div>
        </div>

        <div class="card">
          <h3>Savings goals</h3>
          <div class="mini-scroll small">${homeSavingsGoalsHtml(activePlans, data.transactions, animateBars)}</div>
        </div>
      </div>
    </div>
  `;
}

function balanceFontSize(value) {
  const text = formatMoney(value);
  if (text.length >= 16) return "34px";
  if (text.length >= 14) return "40px";
  if (text.length >= 12) return "46px";
  return "52px";
}

function homeBudgetRowsHtml(monthTx, budgets) {
  const rows = budgetRows(monthTx, budgets);
  if (rows.length === 0) {
    return "<p class='muted'>No budgets yet</p>";
  }
  let html = "";
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    const percent = Math.min(100, (b.used / (b.monthlyLimit || 1)) * 100);
    html += `
      <div class="spacer"></div>
      <div>${b.category.replaceAll("_", " ")}</div>
      <div class="progress"><div style="width:${percent}%"></div></div>
      <small>$${b.used.toFixed(2)} / $${b.monthlyLimit.toFixed(2)}</small>
    `;
  }
  return html;
}

function homeSavingsGoalsHtml(activePlans, transactions, animate) {
  if (activePlans.length === 0) {
    return "<p class='muted'>Set up a savings plan in the Budget tab</p>";
  }
  let html = "";
  for (let i = 0; i < activePlans.length; i++) {
    const plan = activePlans[i];
    const balance = savingsPlanBalance(transactions, plan.id, false);
    const target = Number(plan.targetAmount || 0);
    const progress = target > 0 ? Math.min(100, (Math.max(0, balance) / target) * 100) : 0;
    const reached = target > 0 && balance >= target;
    const completeClass = reached ? " complete" : "";
    const animateClass = animate ? " animate" : "";

    let line;
    if (target > 0) {
      line = `<small>$${balance.toFixed(2)} / $${target.toFixed(2)}${reached ? " — Goal reached!" : ""}</small>`;
    } else {
      line = `<small class="muted">No goal target set</small>`;
    }

    html += `
      <div class="home-savings-row">
        <strong>${plan.description || "(no description)"}</strong>
        <div class="savings-bar${completeClass}${animateClass}" style="--fill-target:${progress}%"><div></div></div>
        ${line}
      </div>
    `;
  }
  return html;
}

function homeUpcomingBillsHtml(openBills) {
  if (openBills.length === 0) {
    return "<p class='muted'>None</p>";
  }
  let html = "";
  for (let i = 0; i < openBills.length; i++) {
    const b = openBills[i];
    html += `
      <div class="list-item">
        <div class="line"><strong>${b.name}</strong><strong>$${b.amount.toFixed(2)}</strong></div>
        <small class="muted">Due ${formatDateForDisplay(b.dueDate)} • ${billStatusLabel(billStatus(b))}</small>
      </div>
    `;
  }
  return html;
}

function showTab(tab, force) {
  if (!force && isEditingPageActive() && tab !== "transactions") {
    openLeaveWarning(() => showTab(tab, true));
    return;
  }
  const tabChanged = selectedTab !== tab;
  selectedTab = tab;

  const screensByTab = {
    home: "screenHome",
    transactions: "screenTransactions",
    budgets: "screenBudgets",
    bills: "screenBills",
    alerts: "screenAlerts",
    reports: "screenReports",
    profile: "screenProfile"
  };

  const ids = Object.values(screensByTab);
  for (let i = 0; i < ids.length; i++) {
    document.getElementById(ids[i]).classList.add("hidden");
  }
  document.getElementById(screensByTab[tab]).classList.remove("hidden");

  const navButtons = document.querySelectorAll("#bottomNav button");
  navButtons.forEach((btn) => {
    if (btn.dataset.tab === tab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) {
    if (tab === "home") {
      profileBtn.classList.remove("hidden");
    } else {
      profileBtn.classList.add("hidden");
    }
  }

  if (tabChanged) {
    render();
  }
}

function isEditingPageActive() {
  return selectedTab === "transactions" && transactionMode === "edit";
}

function openLeaveWarning(onContinue) {
  pendingNavigation = onContinue;
  document.getElementById("leaveWarningModal").classList.remove("hidden");
}

function closeLeaveWarning() {
  pendingNavigation = null;
  document.getElementById("leaveWarningModal").classList.add("hidden");
}

function initApp() {
  bindAuthForm();

  document.getElementById("profileBtn").onclick = () => showTab("profile", true);

  document.querySelectorAll("#bottomNav button").forEach((btn) => {
    btn.onclick = () => showTab(btn.dataset.tab);
  });

  document.getElementById("resetDemoBtn").onclick = () => resetDemo();
  document.getElementById("demoIncomeBtn").onclick = () => addDemoTransaction("INCOME");
  document.getElementById("demoExpenseBtn").onclick = () => addDemoTransaction("EXPENSE");
  document.getElementById("demoRefundBtn").onclick = () => addDemoTransaction("REFUND");
  document.getElementById("demoBudgetsBtn").onclick = () => addDemoBudgets();
  document.getElementById("demoBillsBtn").onclick = () => addDemoBills();

  document.getElementById("stayEditingBtn").onclick = () => closeLeaveWarning();
  document.getElementById("cancelAndLeaveBtn").onclick = () => {
    transactionMode = "history";
    editingTransactionId = null;
    render();
    const go = pendingNavigation;
    closeLeaveWarning();
    if (go) go();
  };

  render();
}

initApp();
