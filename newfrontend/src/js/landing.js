document.addEventListener('DOMContentLoaded', () => {

    // ---------- LOGIN WITH PARTICLE BURST ----------
    const loginButton = document.querySelector(".btn-outline-light");
    const ctaButton = document.querySelector(".cta-button");

    function handleLoginClick() {
        const particlesContainer = document.getElementById('particles');
        if (particlesContainer) {
            for (let i = 0; i < 30; i++) {
                const p = document.createElement('div');
                p.className = 'particle burst';
                p.style.left = '50%';
                p.style.top = '50%';

                // random direction + distance
                const angle = Math.random() * 2 * Math.PI;
                const distance = 60 + Math.random() * 60; // px spread
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;

                // assign variables for animation
                p.style.setProperty('--x', `${x}px`);
                p.style.setProperty('--y', `${y}px`);
                p.style.setProperty('--dur', `${0.6 + Math.random() * 0.4}s`);

                particlesContainer.appendChild(p);
                setTimeout(() => p.remove(), 1000);
            }
        }

        // Navigate after animation
        setTimeout(() => {
            window.location.href = "/home";
        }, 1000);
    }

    loginButton?.addEventListener('click', handleLoginClick);
    ctaButton?.addEventListener('click', handleLoginClick);

    // ---------- PARTICLES BACKGROUND ----------
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

    // ---------- ANIMATION HELPERS ----------
    const style = document.createElement('style');
    style.textContent = `
        .particle.burst {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #3b82f6;
            pointer-events: none;
            transform: translate(-50%, -50%);
            animation: burstAnim var(--dur, 0.8s) forwards;
        }

        @keyframes burstAnim {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(0.2); }
        }
    `;
    document.head.appendChild(style);
});
