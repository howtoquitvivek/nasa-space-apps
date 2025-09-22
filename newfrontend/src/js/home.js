// Enhanced Dashboard JavaScript for Anveshak Projects
class AnveshakDashboard {
    constructor() {
        this.particleCount = 30;
        this.currentSection = 'dashboard';
        this.init();
    }

    init() {
        this.createParticles();
        this.bindEvents();
        this.startAnimations();
        this.initializeAccessibility();
    }

    createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        for (let i = 0; i < this.particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 8 + 's';
            particle.style.animationDuration = (6 + Math.random() * 4) + 's';
            container.appendChild(particle);
        }
    }

    bindEvents() {
        // Modal controls
        const startProjectBtn = document.getElementById('start-new-project-btn');
        const modalContainer = document.getElementById('project-modal-container');
        const closeModalBtn = document.getElementById('close-modal-btn');

        if (startProjectBtn) startProjectBtn.addEventListener('click', () => this.openModal());
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closeModal());
        if (modalContainer) {
            modalContainer.addEventListener('click', (e) => {
                if (e.target === modalContainer) this.closeModal();
            });
        }

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Project & dataset card interactions
        document.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('mouseenter', () => this.onProjectHover(card));
            card.addEventListener('mouseleave', () => this.onProjectLeave(card));
        });

        document.querySelectorAll('.dataset-card').forEach(card => {
            card.addEventListener('mouseenter', () => this.onDatasetHover(card));
            card.addEventListener('mouseleave', () => this.onDatasetLeave(card));
        });

        // Scroll & keyboard events
        window.addEventListener('scroll', () => this.handleScroll());
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        window.addEventListener('resize', () => this.handleResize());

        // User profile interactions
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) userProfile.addEventListener('click', () => this.showUserMenu());
    }

    openModal() {
        const modal = document.getElementById('project-modal-container');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                const firstDatasetBtn = modal.querySelector('.dataset-btn');
                if (firstDatasetBtn) firstDatasetBtn.focus();
            }, 100);
        }
    }

    closeModal() {
        const modal = document.getElementById('project-modal-container');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            const startBtn = document.getElementById('start-new-project-btn');
            if (startBtn) startBtn.focus();
        }
    }

    handleNavigation(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        if (section === this.currentSection) return;

        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentSection = section;

        this.animateSectionTransition();
    }

    animateSectionTransition() {
        const sections = document.querySelectorAll('.section');
        sections.forEach((section, index) => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(20px)';
            setTimeout(() => {
                section.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                section.style.opacity = '1';
                section.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    onProjectHover(card) {
        const icon = card.querySelector('.project-icon');
        if (icon) icon.style.transform = 'scale(1.1) rotate(5deg)';
        card.style.boxShadow = 'var(--shadow-xl), var(--glow-primary)';
    }

    onProjectLeave(card) {
        const icon = card.querySelector('.project-icon');
        if (icon) icon.style.transform = 'scale(1) rotate(0deg)';
        card.style.boxShadow = '';
    }

    onDatasetHover(card) {
        const icon = card.querySelector('.dataset-icon');
        if (icon) icon.style.transform = 'scale(1.15) rotate(10deg)';
        card.style.animation = 'cosmicPulse 2s ease-in-out infinite';
    }

    onDatasetLeave(card) {
        const icon = card.querySelector('.dataset-icon');
        if (icon) icon.style.transform = 'scale(1) rotate(0deg)';
        card.style.animation = '';
    }

    handleScroll() {
        const scrolled = window.pageYOffset;
        document.querySelectorAll('.particle').forEach((particle, index) => {
            const speed = scrolled * (0.1 + index * 0.01);
            particle.style.transform = `translateY(${speed}px)`;
        });

        const watermark = document.querySelector('.nasa-watermark');
        if (watermark) watermark.style.transform = `translate(-50%, -50%) translateY(${scrolled * 0.3}px)`;

        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.opacity = scrolled > 100 ? '0.9' : '1';
    }

    handleKeyboard(e) {
        if (e.altKey) {
            switch(e.key) {
                case 'n': e.preventDefault(); this.openModal(); break;
                case 'd': e.preventDefault(); document.querySelector('[data-section="dashboard"]')?.click(); break;
                case 'p': e.preventDefault(); document.querySelector('[data-section="projects"]')?.click(); break;
                case 'w': e.preventDefault(); document.querySelector('[data-section="workspace"]')?.click(); break;
            }
        }
        if (e.key === 'Escape') this.closeModal();
        if (e.key === 'Enter' && e.target.classList.contains('project-card')) {
            const link = e.target.querySelector('.project-link');
            if (link) window.location.href = link.href;
        }
    }

    handleResize() {
        const newParticleCount = window.innerWidth < 768 ? 15 : 30;
        if (newParticleCount !== this.particleCount) {
            this.particleCount = newParticleCount;
            this.regenerateParticles();
        }
    }

    showUserMenu() {
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            userProfile.style.transform = 'scale(1.05)';
            setTimeout(() => { userProfile.style.transform = 'scale(1)'; }, 200);
        }
    }

    startAnimations() {
        const sections = document.querySelectorAll('.section');
        sections.forEach((section, index) => {
            setTimeout(() => {
                section.style.opacity = '0';
                section.style.transform = 'translateY(30px)';
                section.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
                requestAnimationFrame(() => {
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                });
            }, index * 150);
        });

        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach((link, index) => {
            setTimeout(() => {
                link.style.opacity = '0';
                link.style.transform = 'translateX(-20px)';
                link.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                requestAnimationFrame(() => {
                    link.style.opacity = '1';
                    link.style.transform = 'translateX(0)';
                });
            }, index * 100);
        });

        const brandContainer = document.querySelector('.brand-container');
        if (brandContainer) {
            brandContainer.style.opacity = '0';
            brandContainer.style.transform = 'scale(0.8)';
            setTimeout(() => {
                brandContainer.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
                brandContainer.style.opacity = '1';
                brandContainer.style.transform = 'scale(1)';
            }, 200);
        }
    }

    regenerateParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        container.innerHTML = '';
        this.createParticles();
    }

    monitorPerformance() {
        let frameCount = 0;
        let startTime = performance.now();
        const checkFrameRate = () => {
            frameCount++;
            const currentTime = performance.now();
            if (currentTime - startTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - startTime));
                if (fps < 30) {
                    this.particleCount = Math.max(10, this.particleCount - 5);
                    this.regenerateParticles();
                    console.warn(`Low FPS detected (${fps}), reducing particles to ${this.particleCount}`);
                }
                frameCount = 0;
                startTime = currentTime;
            }
            requestAnimationFrame(checkFrameRate);
        };
        requestAnimationFrame(checkFrameRate);
    }

    addParticleInteractions() {
        document.addEventListener('mousemove', (e) => {
            const cursor = { x: e.clientX, y: e.clientY };
            const particles = document.querySelectorAll('.particle');
            particles.forEach(particle => {
                const rect = particle.getBoundingClientRect();
                const particleCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                const distance = Math.sqrt(Math.pow(cursor.x - particleCenter.x, 2) + Math.pow(cursor.y - particleCenter.y, 2));
                if (distance < 80) {
                    particle.style.transform = `scale(${1.5 - distance / 100}) translateY(${-distance / 10}px)`;
                    particle.style.opacity = `${1 - distance / 200}`;
                } else {
                    particle.style.transform = '';
                    particle.style.opacity = '';
                }
            });
        });

        document.addEventListener('click', (e) => {
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(96, 165, 250, 0.4) 0%, transparent 70%);
                pointer-events: none;
                transform: translate(-50%, -50%);
                animation: rippleEffect 0.8s ease-out forwards;
                z-index: 1500;
                left: ${e.clientX}px;
                top: ${e.clientY}px;
                width: 0;
                height: 0;
            `;
            document.body.appendChild(ripple);
            setTimeout(() => { if (document.body.contains(ripple)) document.body.removeChild(ripple); }, 800);
        });
    }

    loadUserPreferences() {
        const savedTheme = localStorage.getItem('anveshak-theme');
        if (savedTheme) document.body.setAttribute('data-theme', savedTheme);

        const reducedMotion = localStorage.getItem('anveshak-reduced-motion');
        if (reducedMotion === 'true') document.body.classList.add('reduced-motion');
    }

    saveUserPreferences() {
        const theme = document.body.getAttribute('data-theme') || 'space';
        localStorage.setItem('anveshak-theme', theme);
        const reducedMotion = document.body.classList.contains('reduced-motion');
        localStorage.setItem('anveshak-reduced-motion', reducedMotion);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new AnveshakDashboard();
    setTimeout(() => {
        dashboard.addParticleInteractions();
        dashboard.monitorPerformance();
        dashboard.loadUserPreferences();
    }, 1000);

    setInterval(() => { dashboard.regenerateParticles(); }, 45000);
});
