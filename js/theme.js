/**
 * Weather App Pro – Theme Manager
 * Single source of truth for dark/light theme.
 * Uses `body.dark` class exclusively.
 */
(function () {
  const STORAGE_KEY = "weatherAppTheme";
  const toggleBtn = document.getElementById("themeToggle");

  /* ── Apply saved theme immediately (before paint) ── */
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "dark") {
    document.body.classList.add("dark");
  }

  /* ── Update button icon to match current theme ── */
  function syncIcon() {
    const isDark = document.body.classList.contains("dark");
    if (toggleBtn) {
      toggleBtn.innerHTML = isDark
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
      toggleBtn.setAttribute(
        "aria-label",
        isDark ? "Switch to Light Mode" : "Switch to Dark Mode"
      );
    }
  }

  /* ── Toggle handler ── */
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");
      localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
      syncIcon();
    });
  }

  window.addEventListener("DOMContentLoaded", syncIcon);
})();
