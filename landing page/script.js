document.addEventListener("DOMContentLoaded", () => {
  // ===== THEME TOGGLE =====
  const themeToggle = document.getElementById("themeToggle")
  const themeIcon = document.getElementById("themeIcon")

  // Load saved theme
  const savedTheme = localStorage.getItem("theme") || "light"
  setTheme(savedTheme)

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.body.getAttribute("data-theme") || "light"
    const newTheme = currentTheme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
  })

  function setTheme(theme) {
    document.body.setAttribute("data-theme", theme)
    if (theme === "dark") {
      themeIcon.className = "fas fa-sun"
    } else {
      themeIcon.className = "fas fa-moon"
    }
  }

  // ===== LOGIN NAVIGATION =====
  const loginButton = document.querySelector(".btn-outline-light")
  if (loginButton) {
    loginButton.addEventListener("click", () => {
      window.location.href = "login.html"
    })
  }

  // ===== FLOATING PARTICLES =====
  createFloatingParticles()

  function createFloatingParticles() {
    const particlesContainer = document.getElementById("particles")
    if (!particlesContainer) return

    const numberOfParticles = 50

    for (let i = 0; i < numberOfParticles; i++) {
      const particle = document.createElement("div")
      particle.className = "particle"
      particle.style.left = Math.random() * 100 + "%"
      particle.style.top = Math.random() * 100 + "%"
      particle.style.animationDelay = Math.random() * 6 + "s"
      particle.style.animationDuration = Math.random() * 3 + 3 + "s"
      particlesContainer.appendChild(particle)
    }
  }
})
