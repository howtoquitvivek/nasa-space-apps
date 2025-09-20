<script>
    import { onMount } from "svelte";
    import "$lib/styles/landing.css";
    import initLanding from "$lib/landing.js";

    onMount(() => {
        initLanding();
    });
</script>

<!-- NASA Watermark -->
<div class="nasa-watermark">NASA</div>

<!-- Floating Particles -->
<div class="particles-container" id="particles"></div>

<!-- Header -->
<header class="navbar navbar-expand-lg">
    <div class="container-fluid px-4">
        <div class="navbar-brand d-flex align-items-center">
            <div class="brand-icon">
                <i class="fas fa-rocket"></i>
            </div>
            <div class="ms-3">
                <h1 class="brand-title mb-0">Anveshak</h1>
                <p class="brand-subtitle mb-0">NASA Space Explorer</p>
            </div>
        </div>

        <div class="d-flex align-items-center gap-3">
            <button class="btn btn-outline-light">Login</button>
            <div class="nasa-badge">NASA Space Apps  2025</div>
        </div>
    </div>
</header>

<!-- Main Content -->
<main class="main-content">
    <div class="container">
        <div class="text-center">
            <div class="discovery-badge mb-4">Huge Datasets at your fingertips. With AI.</div>

            <h2 class="hero-title mb-4">
                Explore Massive <span class="nasa-highlight">SPACE</span> Image Datasets
            </h2>

            <p class="hero-description mb-5">
                Navigate billions of pixels from Mars HiRISE, Earth Landsat, and Hubble Space Telescope imagery.
                Discover patterns with AI-powered search and collaborate in real-time with scientists worldwide.
            </p>

            <!-- Feature Cards -->
            <div class="row g-4 mb-5">
                <div class="col-lg-4 col-md-6">
                    <div class="feature-card">
                        <div class="feature-icon"><i class="fas fa-search"></i></div>
                        <h3 class="feature-title">AI-Powered Discovery</h3>
                        <p class="feature-description">Find visually similar features across massive datasets in seconds</p>
                    </div>
                </div>
                <div class="col-lg-4 col-md-6">
                    <div class="feature-card">
                        <div class="feature-icon"><i class="fas fa-users"></i></div>
                        <h3 class="feature-title">Real-Time Collaboration</h3>
                        <p class="feature-description">Share discoveries with live cursors and synchronized annotations</p>
                    </div>
                </div>
                <div class="col-lg-4 col-md-6">
                    <div class="feature-card">
                        <div class="feature-icon"><i class="fas fa-bolt"></i></div>
                        <h3 class="feature-title">High-Performance Viewing</h3>
                        <p class="feature-description">Smooth navigation of multi-gigabyte scientific imagery</p>
                    </div>
                </div>
            </div>

            <button class="btn cta-button">Start Exploring <i class="fas fa-arrow-right ms-2"></i></button>
        </div>
    </div>
</main>

<footer>
    <p>© 2025 Map Viewer. All Rights Reserved.</p>
</footer>

