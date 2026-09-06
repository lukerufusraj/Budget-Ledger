// ============================================================
// 1. FIREBASE SETUP
// Paste the config object from your Firebase project here.
// (Firebase Console > Project Settings > General > Your apps > Web app)
// This is safe to have in public client-side code — access is
// controlled by the Firestore security rules, not by hiding this object.
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBI0m8O3bDeVAVlQXEJ3O_V09gMRpb8wAU",
  authDomain: "ledger-lg.firebaseapp.com",
  projectId: "ledger-lg",
  storageBucket: "ledger-lg.firebasestorage.app",
  messagingSenderId: "778704215550",
  appId: "1:778704215550:web:ef90cba7adaea750b6f4af"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================
// 2. CATEGORIES
// ============================================================
const CATEGORIES = {
  expense: ["Rent", "Parents", "Groceries", "Travel", "Loan", "Subscriptions", "Bills", "Eat-out", "Shopping", "Leisure", "Other"],
  income: ["Salary", "Freelance", "Gift", "Other income"]
};

// ============================================================
// 3. DOM REFERENCES
// ============================================================
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const signoutBtn = document.getElementById("signout-btn");

const entryForm = document.getElementById("entry-form");
const entryType = document.getElementById("entry-type");
const entryDesc = document.getElementById("entry-desc");
const entryCategory = document.getElementById("entry-category");
const entryAmount = document.getElementById("entry-amount");
const entryDate = document.getElementById("entry-date");
const entrySubmitBtn = document.getElementById("entry-submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
let editingId = null;

const ledgerBody = document.getElementById("ledger-body");
const emptyState = document.getElementById("empty-state");
const balanceAmount = document.getElementById("balance-amount");
const incomeAmount = document.getElementById("income-amount");
const expenseAmount = document.getElementById("expense-amount");
const categoryBreakdown = document.getElementById("category-breakdown");

let unsubscribeTransactions = null;
let allTransactions = [];
let unsubscribeRecurring = null;
let currentTransactions = [];
let currentRecurring = [];

// ============================================================
// 4. AUTH
// ============================================================
authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  signIn();
});

signupBtn.addEventListener("click", () => signUp());
signoutBtn.addEventListener("click", () => auth.signOut());

function signIn() {
  clearError();
  auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
    .catch((err) => showError(err.message));
}

function signUp() {
  clearError();
  if (!emailInput.value || !passwordInput.value) {
    showError("Enter an email and password first.");
    return;
  }
  auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
    .catch((err) => showError(err.message));
}

function showError(msg) {
  authError.textContent = msg;
  authError.hidden = false;
}
function clearError() {
  authError.hidden = true;
}

auth.onAuthStateChanged((user) => {
  if (user) {
    authScreen.hidden = true;
    appScreen.hidden = false;
    subscribeToTransactions(user.uid);
    subscribeToRecurring(user.uid);
  } else {
    appScreen.hidden = true;
    authScreen.hidden = false;
    if (unsubscribeTransactions) unsubscribeTransactions();
    if (unsubscribeRecurring) unsubscribeRecurring();
    currentTransactions = [];
    currentRecurring = [];
    editingId = null;
    cancelEdit();
  }
});

// ============================================================
// 5. CATEGORY DROPDOWN (updates when type changes)
// ============================================================
function refreshCategoryOptions() {
  const list = CATEGORIES[entryType.value];
  entryCategory.innerHTML = list.map((c) => `<option value="${c}">${c}</option>`).join("");
}
entryType.addEventListener("change", refreshCategoryOptions);
refreshCategoryOptions();
entryDate.valueAsDate = new Date();

// ============================================================
// 6. FIRESTORE: ADD / DELETE / LISTEN
// Data lives at: users/{uid}/transactions/{transactionId}
// ============================================================
entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const data = {
    type: entryType.value,
    description: entryDesc.value.trim(),
    category: entryCategory.value,
    amount: parseFloat(entryAmount.value),
    date: entryDate.value
  };

  if (editingId) {
    db.collection("users").doc(user.uid).collection("transactions").doc(editingId).update(data);
    cancelEdit();
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    db.collection("users").doc(user.uid).collection("transactions").add(data);
    entryDesc.value = "";
    entryAmount.value = "";
  }
});

function startEdit(t) {
  editingId = t.id;
  entryType.value = t.type;
  refreshCategoryOptions();
  entryDesc.value = t.description || "";
  entryCategory.value = t.category;
  entryAmount.value = t.amount;
  entryDate.value = t.date;
  entrySubmitBtn.textContent = "Update entry";
  cancelEditBtn.hidden = false;
  entryForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelEdit() {
  editingId = null;
  entryForm.reset();
  entryDate.valueAsDate = new Date();
  refreshCategoryOptions();
  entrySubmitBtn.textContent = "Add entry";
  cancelEditBtn.hidden = true;
}

cancelEditBtn.addEventListener("click", cancelEdit);

function deleteTransaction(id) {
  const user = auth.currentUser;
  if (!user) return;
  db.collection("users").doc(user.uid).collection("transactions").doc(id).delete();
}

function subscribeToTransactions(uid) {
  if (unsubscribeTransactions) unsubscribeTransactions();

  unsubscribeTransactions = db
    .collection("users").doc(uid).collection("transactions")
    .orderBy("date", "desc")
    .onSnapshot((snapshot) => {
      currentTransactions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderLedger(currentTransactions);
      renderSummary(currentTransactions);
      applyRecurringForThisMonth(uid);
      if (!viewEnvelope.hidden) renderEnvelopeView();
    });
}

// ============================================================
// 7. RENDERING
// ============================================================
function renderLedger(transactions) {
  ledgerBody.innerHTML = "";
  emptyState.hidden = transactions.length > 0;
document.addEventListener("click", () => {
  document.querySelectorAll(".row-menu-dropdown").forEach((d) => { d.hidden = true; });
});
  transactions.forEach((t) => {
    const row = document.createElement("tr");
    const sign = t.type === "income" ? "+" : "−";
    const amountClass = t.type === "income" ? "amount-income" : "amount-expense";

    row.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>${t.description ? escapeHtml(t.description) : '<span style="opacity:0.5;">—</span>'}</td>
      <td><span class="category-pill">${escapeHtml(t.category)}</span></td>
      <td class="amount-cell ${amountClass}">${sign}€${t.amount.toFixed(2)}</td>
                  <td class="row-menu">
        <button class="kebab-btn" aria-label="Row options">⋮</button>
        <div class="row-menu-dropdown" hidden>
          <button class="edit-option">Edit</button>
          <button class="delete-option">Delete</button>
        </div>
      </td>
    `;

    const kebabBtn = row.querySelector(".kebab-btn");
    const dropdown = row.querySelector(".row-menu-dropdown");

    kebabBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".row-menu-dropdown").forEach((d) => { if (d !== dropdown) d.hidden = true; });
      dropdown.hidden = !dropdown.hidden;
    });

    row.querySelector(".edit-option").addEventListener("click", () => {
      dropdown.hidden = true;
      startEdit(t);
    });
    row.querySelector(".delete-option").addEventListener("click", () => {
      dropdown.hidden = true;
      deleteTransaction(t.id);
    });
    ledgerBody.appendChild(row);
  });
}

function renderSummary(transactions) {
  let income = 0, expense = 0;
  const byCategory = {};

  transactions.forEach((t) => {
    if (t.type === "income") {
      income += t.amount;
    } else {
      expense += t.amount;
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    }
  });

  const balance = income - expense;
  balanceAmount.textContent = `€${balance.toFixed(2)}`;
  balanceAmount.style.color = balance < 0 ? "var(--rust)" : "var(--ink)";
  incomeAmount.textContent = `€${income.toFixed(2)}`;
  expenseAmount.textContent = `€${expense.toFixed(2)}`;

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  categoryBreakdown.innerHTML = sorted.length
    ? sorted.map(([cat, amt]) => `
        <div class="tape-cat-row"><span>${escapeHtml(cat)}</span><span>€${amt.toFixed(2)}</span></div>
      `).join("")
    : `<p class="tape-cat-row" style="justify-content:flex-start; opacity:0.6;">No expenses yet</p>`;
}

// ============================================================
// 8. HELPERS
// ============================================================
function formatDate(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
// ============================================================
// 9. RECURRING TEMPLATES
// ============================================================
const recurringForm = document.getElementById("recurring-form");
const recurringType = document.getElementById("recurring-type");
const recurringDesc = document.getElementById("recurring-desc");
const recurringCategory = document.getElementById("recurring-category");
const recurringAmount = document.getElementById("recurring-amount");
const recurringList = document.getElementById("recurring-list");

function refreshRecurringCategoryOptions() {
  recurringCategory.innerHTML = CATEGORIES[recurringType.value].map((c) => `<option value="${c}">${c}</option>`).join("");
}
recurringType.addEventListener("change", refreshRecurringCategoryOptions);
refreshRecurringCategoryOptions();

recurringForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  db.collection("users").doc(user.uid).collection("recurring").add({
    type: recurringType.value,
    description: recurringDesc.value.trim(),
    category: recurringCategory.value,
    amount: parseFloat(recurringAmount.value)
  });

  recurringDesc.value = "";
  recurringAmount.value = "";
});

function deleteRecurringTemplate(id) {
  const user = auth.currentUser;
  if (!user) return;
  db.collection("users").doc(user.uid).collection("recurring").doc(id).delete();
}

function renderRecurringList(templates) {
  recurringList.innerHTML = templates.length
    ? templates.map((r) => `
        <li>
          <span>${r.description ? escapeHtml(r.description) : escapeHtml(r.category)} — €${r.amount.toFixed(2)} (${r.type})</span>
          <button class="delete-btn" data-id="${r.id}">Remove</button>
        </li>
      `).join("")
    : `<li style="opacity:0.6;">No recurring items yet.</li>`;

  recurringList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecurringTemplate(btn.dataset.id));
  });
}

function subscribeToRecurring(uid) {
  if (unsubscribeRecurring) unsubscribeRecurring();
  unsubscribeRecurring = db.collection("users").doc(uid).collection("recurring")
    .onSnapshot((snapshot) => {
      currentRecurring = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderRecurringList(currentRecurring);
      applyRecurringForThisMonth(uid);
    });
}

function applyRecurringForThisMonth(uid) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const todayStr = new Date().toISOString().slice(0, 10);

  currentRecurring.forEach((template) => {
    const alreadyAdded = currentTransactions.some(
      (t) => t.recurringId === template.id && t.date.startsWith(thisMonth)
    );
    if (!alreadyAdded) {
      db.collection("users").doc(uid).collection("transactions").add({
        type: template.type,
        description: template.description,
        category: template.category,
        amount: template.amount,
        date: todayStr,
        recurringId: template.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  });
}
// ============================================================
// TAB SWITCHING
// ============================================================
const tabButtons = document.querySelectorAll(".tab-btn");
const viewLedger = document.getElementById("view-ledger");
const viewEnvelope = document.getElementById("view-envelope");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const showEnvelope = btn.dataset.view === "envelope";
    viewLedger.hidden = showEnvelope;
    viewEnvelope.hidden = !showEnvelope;
    if (showEnvelope) renderEnvelopeView();
  });
});

// ============================================================
// MONTHLY ENVELOPE (salary-to-salary period tracking)
// ============================================================
let categoryChart = null;
let historyChart = null;

function computeEnvelopePeriods(transactions) {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const salaryDates = [...new Set(
    sorted.filter((t) => t.type === "income" && t.category === "Salary").map((t) => t.date)
  )].sort();

  if (salaryDates.length === 0) return [];

  const todayStr = new Date().toISOString().slice(0, 10);

  return salaryDates.map((start, i) => {
    const end = salaryDates[i + 1] || null;
    const periodTx = sorted.filter((t) => t.date >= start && (end === null || t.date < end));
    const income = periodTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const byCategory = {};
    periodTx.filter((t) => t.type === "expense").forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    return { start, end: end || todayStr, ongoing: end === null, income, expense, byCategory };
  });
}

function renderEnvelopeView() {
  const periods = computeEnvelopePeriods(currentTransactions);
  const rangeEl = document.getElementById("envelope-range");
  const incomeEl = document.getElementById("envelope-income");
  const spentEl = document.getElementById("envelope-spent");
  const remainingEl = document.getElementById("envelope-remaining");

  if (periods.length === 0) {
    rangeEl.textContent = 'Log an entry with category "Salary" to start tracking';
    incomeEl.textContent = "€0.00";
    spentEl.textContent = "€0.00";
    remainingEl.textContent = "€0.00";
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    if (historyChart) { historyChart.destroy(); historyChart = null; }
    return;
  }

  const current = periods[periods.length - 1];
  rangeEl.textContent = `${formatDate(current.start)} – ${current.ongoing ? "ongoing" : formatDate(current.end)}`;
  incomeEl.textContent = `€${current.income.toFixed(2)}`;
  spentEl.textContent = `€${current.expense.toFixed(2)}`;
  const remaining = current.income - current.expense;
  remainingEl.textContent = `€${remaining.toFixed(2)}`;
  remainingEl.style.color = remaining < 0 ? "#A13D2B" : "#4B7A52";

  const catEntries = Object.entries(current.byCategory).sort((a, b) => b[1] - a[1]);
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.getElementById("category-chart"), {
    type: "bar",
    data: {
      labels: catEntries.map((e) => e[0]),
      datasets: [{ label: "Spent (€)", data: catEntries.map((e) => e[1]), backgroundColor: "#A13D2B" }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  const recentPeriods = periods.slice(-6);
  if (historyChart) historyChart.destroy();
  historyChart = new Chart(document.getElementById("history-chart"), {
    type: "bar",
    data: {
      labels: recentPeriods.map((p) => formatDate(p.start)),
      datasets: [
        { label: "Income", data: recentPeriods.map((p) => p.income), backgroundColor: "#4B7A52" },
        { label: "Expense", data: recentPeriods.map((p) => p.expense), backgroundColor: "#A13D2B" }
      ]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}
