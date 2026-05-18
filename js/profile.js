function renderProfileTab() {
  const target = document.getElementById("screenProfile");
  const me = getCurrentUser();
  if (!me) {
    target.innerHTML = "<p class='muted'>Sign in to view profile.</p>";
    return;
  }

  target.innerHTML = `
    <h2>Profile Settings</h2>
    <p class="muted">Update your account settings</p>
    <form id="profileForm" class="form card">
      <label>First name</label><input id="profileFirstName" value="${me.firstName || ""}" />
      <label>Last name</label><input id="profileLastName" value="${me.lastName || ""}" />
      <label>Email</label><input id="profileEmail" type="email" value="${me.email || ""}" />

      <label>Theme</label>
      <select id="profileTheme">
        <option value="light" ${me.theme === "light" ? "selected" : ""}>Light</option>
        <option value="dark" ${me.theme === "dark" ? "selected" : ""}>Dark</option>
      </select>

      <label>
        <input id="profileNotificationsOptOut" type="checkbox" style="width:auto;" ${me.notificationsOptOut ? "checked" : ""} />
        Opt out of notifications
      </label>

      <label>Current password</label>
      <input id="profileCurrentPassword" type="password" placeholder="Required only to change password" />
      <label>New password</label>
      <input id="profileNewPassword" type="password" placeholder="Leave blank to keep same password" />
      <div id="profilePasswordRules" class="password-rules hidden"></div>

      <button class="primary" type="submit">Save Profile</button>
      <button class="ghost" type="button" id="backToHomeFromProfileBtn">Back to Home</button>
      <button class="ghost" type="button" id="profileLogoutBtn">Logout</button>
    </form>
    <div id="profileError" class="error"></div>
  `;

  const newPasswordInput = document.getElementById("profileNewPassword");
  const rulesBox = document.getElementById("profilePasswordRules");
  function syncProfileRules() {
    const value = newPasswordInput.value;
    if (value) {
      rulesBox.classList.remove("hidden");
      renderPasswordRules("profilePasswordRules", value);
    } else {
      rulesBox.classList.add("hidden");
    }
  }
  newPasswordInput.addEventListener("input", syncProfileRules);
  syncProfileRules();

  document.getElementById("profileForm").onsubmit = (e) => {
    e.preventDefault();
    saveProfileChanges(me);
  };
  document.getElementById("backToHomeFromProfileBtn").onclick = () => showTab("home", true);
  document.getElementById("profileLogoutBtn").onclick = () => logoutCurrentUser();
}

function saveProfileChanges(me) {
  const errBox = document.getElementById("profileError");
  errBox.textContent = "";

  const email = document.getElementById("profileEmail").value.trim();
  const firstName = document.getElementById("profileFirstName").value.trim();
  const lastName = document.getElementById("profileLastName").value.trim();
  const theme = document.getElementById("profileTheme").value;
  const notificationsOptOut = document.getElementById("profileNotificationsOptOut").checked;
  const currentPassword = document.getElementById("profileCurrentPassword").value;
  const newPassword = document.getElementById("profileNewPassword").value;

  if (!email) {
    errBox.textContent = "Email is required";
    return;
  }

  const users = getAllUsers();
  for (let i = 0; i < users.length; i++) {
    if (users[i].id !== me.id && users[i].email.toLowerCase() === email.toLowerCase()) {
      errBox.textContent = "That email is already used by another profile";
      return;
    }
  }

  if (newPassword) {
    if (!currentPassword) {
      errBox.textContent = "Enter current password to change password";
      return;
    }
    if (currentPassword !== me.password) {
      errBox.textContent = "Current password is incorrect";
      return;
    }
    if (!isPasswordValid(newPassword)) {
      errBox.textContent =
        "Password must be at least 10 characters and include uppercase, lowercase, number, and special character";
      return;
    }
  }

  let target = null;
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === me.id) {
      target = users[i];
      break;
    }
  }
  if (!target) {
    errBox.textContent = "Could not find user";
    return;
  }
  target.firstName = firstName;
  target.lastName = lastName;
  target.email = email;
  target.theme = theme;
  target.notificationsOptOut = notificationsOptOut;
  if (newPassword) target.password = newPassword;

  saveAllUsers(users);
  applyTheme(theme);
  render();
  showTab("profile", true);
}

function logoutCurrentUser() {
  if (isEditingPageActive()) {
    openLeaveWarning(() => logoutCurrentUser());
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.currentUserId);
  render();
}
