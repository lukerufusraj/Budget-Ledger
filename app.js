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
  expense: ["Rent", "Groceries", "Transport", "Bills", "Health", "Shopping", "Leisure", "Other"],
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

const ledgerBody = document.getElementById("ledger-body");
const emptyState = document.getElementById("empty-state");
const balanceAmount = document.getElementById("balance-amount");
const incomeAmount = document.getElementById("income-amount");
const expenseAmount = document.getElementById("expense-amount");
const categoryBreakdown = document.getElementById("category-breakdown");

let unsubscribeTransactions = null;

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
  } else {
    appScreen.hidden = true;
    authScreen.hidden = false;
    if (unsubscribeTransactions) unsubscribeTransactions();
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

  db.collection("users").doc(user.uid).collection("transactions").add({
    type: entryType.value,
    description: entryDesc.value.trim(),
    category: entryCategory.value,
    amount: parseFloat(entryAmount.value),
    date: entryDate.value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  entryDesc.value = "";
  entryAmount.value = "";
});

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
      const transactions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderLedger(transactions);
      renderSummary(transactions);
    });
}

// ============================================================
// 7. RENDERING
// ============================================================
function renderLedger(transactions) {
  ledgerBody.innerHTML = "";
  emptyState.hidden = transactions.length > 0;

  transactions.forEach((t) => {
    const row = document.createElement("tr");
    const sign = t.type === "income" ? "+" : "−";
    const amountClass = t.type === "income" ? "amount-income" : "amount-expense";

    row.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td><span class="category-pill">${escapeHtml(t.category)}</span></td>
      <td class="amount-cell ${amountClass}">${sign}€${t.amount.toFixed(2)}</td>
      <td><button class="delete-btn" aria-label="Delete entry">Delete</button></td>
    `;
    row.querySelector(".delete-btn").addEventListener("click", () => deleteTransaction(t.id));
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
