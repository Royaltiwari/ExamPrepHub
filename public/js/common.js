/* =====================================================
   EXAM PREP HUB - COMMON JAVASCRIPT
   Saare pages ke liye common functions
   ===================================================== */

/* =====================================================
   1. API HELPERS
   ===================================================== */

const API = {
  async get(url) {
    const r = await fetch(url, { credentials: "include" });
    return r.json();
  },

  async post(url, data) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data)
    });
    return r.json();
  },

  async put(url, data) {
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data)
    });
    return r.json();
  },

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
   8. DEBOUNCE
   ===================================================== */

function debounce(fn, delay = 400) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* =====================================================
   9. PASSWORD SHOW/HIDE TOGGLE
   Show (blue) → Hide (red) button
   ===================================================== */

function setupPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    // Skip if already has toggle
    if (input.dataset.hasToggle === "true") return;
    input.dataset.hasToggle = "true";

    // Wrapper
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.display = "block";
    wrapper.style.width = "100%";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    // Button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Show";
    btn.style.position = "absolute";
    btn.style.right = "8px";
    btn.style.top = "50%";
    btn.style.transform = "translateY(-50%)";
    btn.style.background = "#2563eb";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "11px";
    btn.style.fontWeight = "800";
    btn.style.padding = "6px 12px";
    btn.style.borderRadius = "6px";
    btn.style.textTransform = "uppercase";
    btn.style.letterSpacing = "0.5px";
    btn.style.zIndex = "2";
    btn.style.transition = "all 0.2s";
    btn.style.minWidth = "60px";

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-50%) scale(1.05)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(-50%) scale(1)";
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "Hide";
        btn.style.background = "#dc2626";
      } else {
        input.type = "password";
        btn.textContent = "Show";
        btn.style.background = "#2563eb";
      }
    });

    wrapper.appendChild(btn);

    // Input padding
    input.style.paddingRight = "80px";
  });
}

// Expose globally for dynamic content
window.setupPasswordToggles = setupPasswordToggles;

/* =====================================================
   10. INIT - On DOM Ready
   ===================================================== */

function initCommon() {
  bindLogoutButton();
  setupPasswordToggles();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCommon);
} else {
  initCommon();
}

/* =====================================================
   11. MUTATION OBSERVER - Auto-apply on new password fields
   ===================================================== */

if (window.MutationObserver) {
  const observer = new MutationObserver(() => {
    setupPasswordToggles();
  });

  document.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}