/* =====================================================
   EXAM PREP HUB - COMMON JAVASCRIPT
   Saare pages ke liye common functions
   ===================================================== */

/* =====================================================
   1. API HELPERS
   ===================================================== */

const API = {
  // GET request
  async get(url) {
    const r = await fetch(url, { credentials: "include" });
    return r.json();
  },

  // POST request
  async post(url, data) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data)
    });
    return r.json();
  },

  // PUT request
  async put(url, data) {
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data)
    });
    return r.json();
  },

  // DELETE request
  async del(url, data) {
    const r = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined
    });
    return r.json();
  }
};

/* =====================================================
   2. SECURITY - HTML ESCAPE
   ===================================================== */

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =====================================================
   3. AUTH HELPERS
   ===================================================== */

async function loadCurrentUser() {
  try {
    const data = await API.get("/api/auth/me");
    if (!data.success || !data.user) return null;
    return data.user;
  } catch (e) {
    return null;
  }
}

async function requireLogin() {
  const user = await loadCurrentUser();
  if (!user) {
    window.location.href = "/login.html";
    return null;
  }
  return user;
}

async function logout() {
  try {
    const data = await API.post("/api/auth/logout", {});
    if (data.success) {
      window.location.href = "/login.html";
    } else {
      showAlert(data.message || "Logout failed", "error");
    }
  } catch (e) {
    window.location.href = "/login.html";
  }
}

function bindLogoutButton() {
  const btn = document.getElementById("logoutBtn");
  if (btn) btn.addEventListener("click", logout);
}

/* =====================================================
   4. UI HELPERS
   ===================================================== */

function showAlert(message, type = "info", duration = 3000) {
  // Purane alert hatao
  document.querySelectorAll(".alert-floating").forEach(el => el.remove());

  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };

  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-floating`;
  alert.style.position = "fixed";
  alert.style.top = "80px";
  alert.style.right = "20px";
  alert.style.zIndex = "9999";
  alert.style.minWidth = "260px";
  alert.style.maxWidth = "400px";
  alert.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
  alert.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${escapeHtml(message)}</span>`;

  document.body.appendChild(alert);

  setTimeout(() => {
    alert.style.transition = "opacity 0.3s, transform 0.3s";
    alert.style.opacity = "0";
    alert.style.transform = "translateX(20px)";
    setTimeout(() => alert.remove(), 300);
  }, duration);
}

function showLoader(element, text = "Loading...") {
  element.innerHTML = `<div class="loading-box"><span class="spinner spinner-dark"></span> ${escapeHtml(text)}</div>`;
}

function showError(element, text = "Something went wrong") {
  element.innerHTML = `<div class="message-box error">${escapeHtml(text)}</div>`;
}

function showEmpty(element, text = "No data found") {
  element.innerHTML = `<div class="empty-text">${escapeHtml(text)}</div>`;
}

/* =====================================================
   5. DATE HELPERS
   ===================================================== */

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* =====================================================
   6. YOUTUBE HELPER
   ===================================================== */

function getYouTubeId(url) {
  if (!url) return "";
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  return match ? match[1] : "";
}

/* =====================================================
   7. QUERY PARAMS
   ===================================================== */

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/* =====================================================
   8. DEBOUNCE (search ke liye)
   ===================================================== */

function debounce(fn, delay = 400) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* =====================================================
   9. INIT - Auto logout button bind
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
  bindLogoutButton();
});