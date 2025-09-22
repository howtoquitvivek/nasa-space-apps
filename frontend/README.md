# Frontend Project

A modern frontend project built with Vite and Bootstrap, organized with a route-based structure.

## Project Structure

```
/newfrontend
│
├── /public                 # Static assets (images, fonts, etc.)
│
├── /src
│   ├── /routes             # Each route/page has its own folder
│   │   ├── /home
│   │   │   ├── index.html  # HTML for Home page
│   │   │   ├── main.js     # JavaScript specific to Home page
│   │   │   └── custom.css  # Optional CSS per page if needed
│   │   │
│   │   ├── /about
│   │   │   ├── index.html
│   │   │   ├── main.js
│   │   │   └── custom.css
│   │   │
│   │   └── ...             # Other routes/pages
│   │
│   ├── /css                # Global CSS if needed (Bootstrap overrides)
│   ├── /js                 # Shared JavaScript utilities or libraries
│   └── index.html          # Optional root landing or redirect page
│
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies and scripts
└── README.md
```

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Development Server**
   ```bash
   npm run dev
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Preview Production Build**
   ```bash
   npm run preview
   ```

## Features

- ⚡ **Vite** - Fast build tool and dev server
- 🎨 **Bootstrap 5** - Modern CSS framework
- 📁 **Route-based Structure** - Each page has its own folder
- 🔧 **Modular JavaScript** - ES6 modules with shared utilities
- 🎯 **Hot Module Replacement** - Fast development workflow

## Adding New Routes

1. Create a new folder in `src/routes/` with your route name
2. Add `index.html`, `main.js`, and `custom.css` files
3. Update `vite.config.js` to include the new route in build input
4. Link to your new route from other pages

## Technologies Used

- **Vite** - Build tool
- **Bootstrap 5** - CSS framework
- **Vanilla JavaScript** - ES6 modules
- **HTML5** - Semantic markup
- **CSS3** - Modern styling

