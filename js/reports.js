let reportMonth = new Date().toISOString().slice(0, 7);

function monthKeyOffset(ym, offset) {
  const parts = String(ym || "").split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return ym;
  const d = new Date(year, month - 1 + offset, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(ym) {
  const parts = String(ym || "").split("-");
  if (parts.length !== 2) return ym;
  return parts[1] + "/" + parts[0];
}

function sixMonthSeries(transactions, endYm) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    months.push(monthKeyOffset(endYm, -i));
  }
  const series = [];
  for (let i = 0; i < months.length; i++) {
    const ym = months[i];
    const tx = monthTransactions(transactions, ym);
    const s = sums(tx);
    series.push({
      ym: ym,
      income: s.income,
      expense: s.expense,
      net: s.income - s.expense
    });
  }
  return series;
}

function reportData(transactions, ym) {
  const tx = monthTransactions(transactions, ym);
  const s = sums(tx);

  const categoryMap = {};
  for (let i = 0; i < tx.length; i++) {
    const t = tx[i];
    if (t.type === "REFUND") {
      categoryMap[t.category] = (categoryMap[t.category] || 0) - t.amount;
      continue;
    }
    if (isIncomeType(t.type)) continue;
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  }

  return {
    ym: ym,
    income: s.income,
    expense: s.expense,
    net: s.income - s.expense,
    txCount: tx.length,
    categoryMap: categoryMap
  };
}

function categoryBarsHtml(categoryMap) {
  const entries = [];
  const keys = Object.keys(categoryMap);
  for (let i = 0; i < keys.length; i++) {
    const value = Math.max(0, categoryMap[keys[i]]);
    if (value > 0) entries.push([keys[i], value]);
  }
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 6);

  if (top.length === 0) {
    return "<p class='muted'>No category spending for selected month.</p>";
  }
  const maxValue = top[0][1] || 1;
  let html = "";
  for (let i = 0; i < top.length; i++) {
    const cat = top[i][0];
    const val = top[i][1];
    const widthPct = (val / maxValue) * 100;
    html += `
      <div class="chart-row">
        <div class="chart-label">${cat.replaceAll("_", " ")}</div>
        <div class="chart-track"><div class="chart-fill" style="width:${widthPct}%"></div></div>
        <div class="chart-value">$${formatMoney(val)}</div>
      </div>
    `;
  }
  return html;
}

function trendSvg(series) {
  const width = 320;
  const height = 120;
  const pad = 14;

  let maxValue = 1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].income > maxValue) maxValue = series[i].income;
    if (series[i].expense > maxValue) maxValue = series[i].expense;
  }

  const step = (width - pad * 2) / Math.max(1, series.length - 1);
  function yFor(value) {
    return (height - pad) - ((value / maxValue) * (height - pad * 2));
  }

  let incomePoints = "";
  let expensePoints = "";
  let labels = "";
  for (let i = 0; i < series.length; i++) {
    const x = pad + i * step;
    incomePoints += `${x},${yFor(series[i].income)} `;
    expensePoints += `${x},${yFor(series[i].expense)} `;
    const shortLabel = monthLabel(series[i].ym).slice(0, 2);
    labels += `<text x="${x}" y="${height - 2}" text-anchor="middle" class="chart-axis-label">${shortLabel}</text>`;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="trend-svg" aria-label="Income and expense trend">
      <polyline points="${incomePoints.trim()}" class="trend-line income"></polyline>
      <polyline points="${expensePoints.trim()}" class="trend-line expense"></polyline>
      ${labels}
    </svg>
  `;
}

function insightItems(report, series) {
  let topCategoryName = null;
  let topCategoryValue = -1;
  const keys = Object.keys(report.categoryMap);
  for (let i = 0; i < keys.length; i++) {
    const v = Math.max(0, report.categoryMap[keys[i]]);
    if (v > topCategoryValue) {
      topCategoryName = keys[i];
      topCategoryValue = v;
    }
  }
  const topLabel = topCategoryName ? topCategoryName.replaceAll("_", " ") : "N/A";

  const spendingRate = report.income > 0 ? (report.expense / report.income) * 100 : 0;

  let netSum = 0;
  for (let i = 0; i < series.length; i++) {
    netSum += series[i].net;
  }
  const avgNet = netSum / Math.max(1, series.length);
  const avgWord = avgNet >= 0 ? "Average surplus" : "Average deficit";

  return [
    `Top spend category: ${topLabel}`,
    `Spending rate: ${spendingRate.toFixed(1)}% of income`,
    `${avgWord} over 6 months: $${formatMoney(Math.abs(avgNet))}`
  ];
}

function renderReports(transactions) {
  const target = document.getElementById("screenReports");
  const r = reportData(transactions, reportMonth);
  const trend = sixMonthSeries(transactions, reportMonth);
  const insights = insightItems(r, trend);

  target.innerHTML = `
    <h2>Reports</h2>
    <p class="muted">Generate visual analytics and monthly summaries</p>

    <div class="form">
      <label>Month</label><input id="reportMonth" type="month" value="${reportMonth}" />
      <label>Report type</label><input value="Monthly summary" readonly />
      <button id="reportBtn" class="primary" type="button">Generate Report</button>
    </div>

    <div class="row">
      <div class="card stat-tile"><h3>Income</h3><strong class="green">$${formatMoney(r.income)}</strong></div>
      <div class="card stat-tile"><h3>Expenses</h3><strong class="red">$${formatMoney(r.expense)}</strong></div>
      <div class="card stat-tile"><h3>Net</h3><strong class="${r.net >= 0 ? "green" : "red"}">$${formatMoney(r.net)}</strong></div>
    </div>

    <div class="card">
      <h3>6-Month Trend</h3>
      <p class="muted">Green = income, red = expenses</p>
      ${trendSvg(trend)}
    </div>

    <div class="card">
      <h3>Spending by Category (${monthLabel(reportMonth)})</h3>
      <div class="chart-bars">${categoryBarsHtml(r.categoryMap)}</div>
    </div>

    <div class="card">
      <h3>Insights</h3>
      <div class="insight-list">
        ${insights.map((i) => `<p>• ${i}</p>`).join("")}
      </div>
    </div>

    <button id="exportBtn" class="ghost" type="button">Export / Download</button>
  `;

  document.getElementById("reportBtn").onclick = () => {
    reportMonth = document.getElementById("reportMonth").value;
    render();
  };
  document.getElementById("exportBtn").onclick = () => exportCsv(r);
}

function exportCsv(r) {
  const rows = [
    ["TimeToPay Monthly Report"],
    ["Month", r.ym],
    ["Income", r.income],
    ["Expenses", r.expense],
    [""],
    ["Category", "Amount"]
  ];
  const keys = Object.keys(r.categoryMap);
  for (let i = 0; i < keys.length; i++) {
    rows.push([keys[i], r.categoryMap[keys[i]]]);
  }

  const csvLines = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    csvLines.push(cells.join(","));
  }
  const csv = csvLines.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timetopay-report-${r.ym}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
