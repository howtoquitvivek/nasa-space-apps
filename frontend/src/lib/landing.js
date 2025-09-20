export default function initLanding() {
  // THEME TOGGLE
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");

  // LOGIN NAVIGATION
  const loginButton = document.querySelector(".btn-outline-light");
  loginButton?.addEventListener("click", () => {
    window.location.href = "/home";
  });

  // PARTICLES
  const container = document.getElementById("particles");
  if (container) {
    const count = 50;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = Math.random() * 100 + "%";
      p.style.top = Math.random() * 100 + "%";
      p.style.animationDelay = Math.random() * 6 + "s";
      p.style.animationDuration = Math.random() * 3 + 3 + "s";
      container.appendChild(p);
    }
  }
}
