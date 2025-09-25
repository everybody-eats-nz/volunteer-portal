# Everybody Eats Admin Documentation

This is the administrator documentation site for the Everybody Eats Volunteer Portal, built with [Astro Starlight](https://starlight.astro.build/).

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
docs/
├── public/             # Static assets
├── src/
│   ├── assets/        # Images and other assets
│   ├── content/       # Documentation content
│   │   └── docs/      # Markdown/MDX files
│   └── styles/        # Custom CSS styles
├── astro.config.mjs   # Astro configuration
└── package.json
```

## ✏️ Writing Documentation

### Adding New Pages

1. Create a new `.md` or `.mdx` file in `src/content/docs/`
2. Add frontmatter with title and description:
   ```yaml
   ---
   title: Page Title
   description: Page description for SEO
   ---
   ```
3. Add the page to the sidebar in `astro.config.mjs`

### Content Organization

- **Overview**: Getting started and basic concepts
- **User Management**: Volunteer and admin user features
- **Shift Management**: Scheduling and volunteer coordination
- **Location Management**: Multi-location restaurant features
- **Reports & Analytics**: Metrics and performance data
- **Troubleshooting**: Problem solving and user support
- **Reference**: Technical details and API documentation

### Components Available

Starlight provides built-in components:

```mdx
import { Card, CardGrid } from '@astrojs/starlight/components';

<Card title="Feature Name" icon="star">
  Feature description here
</Card>
```

### Custom Styling

Status indicators and custom components are defined in `src/styles/custom.css`:

```html
<div class="status-indicator">
  <span class="status-dot green"></span>
  <span>Active feature</span>
</div>
```

## 🎨 Customization

### Branding
- Update site title and description in `astro.config.mjs`
- Replace logo in `src/assets/logo.png`
- Modify colors and styling in `src/styles/custom.css`

### Navigation
Edit the sidebar structure in `astro.config.mjs` under `starlight.sidebar`.

## 🚢 Deployment

### Build for Production
```bash
npm run build
```

The built site will be in the `dist/` directory.

### Deploy Options
- **Netlify**: Connect your Git repository and deploy automatically
- **Vercel**: Import project and deploy with zero configuration
- **GitHub Pages**: Use GitHub Actions to build and deploy
- **Traditional Hosting**: Upload `dist/` contents to your web server

### Environment Variables
No environment variables are required for the documentation site.

## 📋 Content Guidelines

### Writing Style
- Use clear, concise language
- Include step-by-step instructions for complex tasks
- Add screenshots and examples where helpful
- Use consistent terminology throughout

### Status Indicators
- 🟢 **Green**: Active/working features
- 🟡 **Yellow**: Pending/requires attention
- 🔴 **Red**: Critical/needs immediate action  
- 🔵 **Blue**: Information/tips

### Code Examples
Include relevant code snippets and configuration examples where applicable.

## 🧞 Commands

All commands are run from the docs directory:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 🤝 Contributing

1. Create new documentation pages as needed
2. Update existing content to reflect system changes
3. Test all links and ensure accuracy
4. Follow established content structure and style

## 📞 Support

For questions about the documentation system or content updates, contact the development team.

---

Built with ❤️ using [Astro Starlight](https://starlight.astro.build/)
