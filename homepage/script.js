// Simplified Research Dashboard JavaScript

document.addEventListener("DOMContentLoaded", () => {
  // Theme toggle functionality
  const themeToggle = document.getElementById("themeToggle")
  const themeIcon = document.getElementById("themeIcon")
  const body = document.body

  // Load saved theme or default to light
  const savedTheme = localStorage.getItem("theme") || "light"
  setTheme(savedTheme)

  // Theme toggle event listener
  themeToggle?.addEventListener("click", () => {
    const currentTheme = body.getAttribute("data-theme") || "light"
    const newTheme = currentTheme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
  })

  // Set theme function
  function setTheme(theme) {
    body.setAttribute("data-theme", theme)
    if (themeIcon) {
      themeIcon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon"
    }
  }

  const navLinks = document.querySelectorAll(".sidebar .nav-link")
  const sidebarToggle = document.getElementById("sidebarToggle")
  const sidebar = document.getElementById("sidebar")

  // Handle navigation clicks
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault()
      navLinks.forEach((l) => l.classList.remove("active"))
      this.classList.add("active")
    })
  })

  // Mobile sidebar toggle
  sidebarToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("show")
  })

  const uploadArea = document.getElementById("uploadArea")
  const fileInput = document.getElementById("fileInput")

  uploadArea?.addEventListener("click", () => {
    fileInput?.click()
  })

  fileInput?.addEventListener("change", function () {
    if (this.files.length > 0) {
      uploadArea.innerHTML = `
        <i class="fas fa-check-circle text-success" style="font-size: 2rem;"></i>
        <p class="mt-2">Files uploaded successfully!</p>
      `
      setTimeout(() => {
        location.reload()
      }, 2000)
    }
  })

  // Simple button actions
  document.getElementById("saveBtn")?.addEventListener("click", function () {
    this.innerHTML = '<i class="fas fa-check"></i> Saved!'
    setTimeout(() => {
      this.innerHTML = '<i class="fas fa-save"></i> Save'
    }, 2000)
  })

  document.getElementById("shareBtn")?.addEventListener("click", function () {
    this.innerHTML = '<i class="fas fa-check"></i> Shared!'
    setTimeout(() => {
      this.innerHTML = '<i class="fas fa-share"></i> Share'
    }, 2000)
  })

  // Close sidebar on outside click (mobile)
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768 && sidebar) {
      if (!sidebar.contains(e.target) && !sidebarToggle?.contains(e.target)) {
        sidebar.classList.remove("show")
      }
    }
  })
})
