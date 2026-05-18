function passwordChecks(password) {
  const value = String(password || "");
  return {
    length: value.length >= 10,
    number: /\d/.test(value),
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    special: /[^A-Za-z0-9]/.test(value)
  };
}

function isPasswordValid(password) {
  const c = passwordChecks(password);
  return c.length && c.number && c.uppercase && c.lowercase && c.special;
}

function renderPasswordRules(targetId, password) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const c = passwordChecks(password);
  const rows = [
    { ok: c.length, text: "At least 10 characters" },
    { ok: c.number, text: "Contains a number" },
    { ok: c.uppercase, text: "Contains an uppercase letter" },
    { ok: c.lowercase, text: "Contains a lowercase letter" },
    { ok: c.special, text: "Contains a special character" }
  ];
  let html = "";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cls = row.ok ? "password-rule ok" : "password-rule";
    const mark = row.ok ? "✓" : "○";
    html += `<div class="${cls}">${mark} ${row.text}</div>`;
  }
  target.innerHTML = html;
}

function signInOrCreate(email, password) {
  const users = getAllUsers();
  let user = null;
  for (let i = 0; i < users.length; i++) {
    if (users[i].email.toLowerCase() === email.toLowerCase()) {
      user = users[i];
      break;
    }
  }

  if (user === null) {
    user = {
      id: makeId(),
      email: email,
      password: password,
      firstName: "",
      lastName: "",
      theme: "light",
      notificationsOptOut: false
    };
    users.push(user);
    saveAllUsers(users);
  } else if (user.password !== password) {
    throw new Error("Invalid password");
  }

  localStorage.setItem(STORAGE_KEYS.currentUserId, String(user.id));
  applyTheme(user.theme || "light");
}

function bindAuthForm() {
  const authForm = document.getElementById("authForm");
  const passwordInput = document.getElementById("password");
  const errorBox = document.getElementById("authError");

  authForm.onsubmit = (e) => {
    e.preventDefault();
    try {
      const rawPassword = passwordInput.value;
      if (!isPasswordValid(rawPassword)) {
        throw new Error(
          "Password must be at least 10 characters and include uppercase, lowercase, number, and special character"
        );
      }
      const email = document.getElementById("email").value.trim();
      signInOrCreate(email, rawPassword);
      errorBox.textContent = "";
      render();
    } catch (err) {
      errorBox.textContent = err.message;
    }
  };

  passwordInput.addEventListener("input", (e) => {
    renderPasswordRules("passwordRules", e.target.value);
  });
  renderPasswordRules("passwordRules", passwordInput.value);
}
