# Star Support - AI-Powered Documentation Assistant

This documentation site now includes an AI-powered chat assistant called "Star Support" based on the [star-support-demo](https://github.com/agoodway/star-support-demo) project.

## Features

- 🤖 AI-powered chat interface for documentation questions
- 📚 RAG (Retrieval-Augmented Generation) using documentation content
- 💬 Persistent conversation history
- 📱 Mobile-responsive design
- 🎨 Customizable appearance
- 🔗 Source citations with links to relevant documentation

## Setup Instructions

### 1. Environment Variables

Copy the example environment file and configure your API keys:

```bash
cp .env.example .env.local
```

Add your Anthropic API key to `.env.local`:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
STAR_SUPPORT_MODEL=claude-3-haiku-20240307
STAR_SUPPORT_AUTH_KEY=optional_auth_key_for_api_security
STAR_SUPPORT_GENERATE_SUMMARIES=false
STAR_SUPPORT_SAVE_INDEX=false
```

### 2. Development

To run the documentation site with the AI assistant:

```bash
npm run dev
```

This will:

1. Build the chat widget (`npm run build:widget`)
2. Start the Astro development server with the widget integrated

### 3. Production Build

```bash
npm run build
npm run preview
```

## How It Works

### Architecture

1. **Widget** (`/widget/`): Standalone TypeScript chat widget
2. **API Route** (`/src/pages/api/star-support/chat.ts`): Handles AI conversations
3. **Indexing System** (`/src/lib/docs-index.ts`): Processes documentation for RAG
4. **Integration**: Widget is loaded and configured in `astro.config.mjs`

### Documentation Indexing

The system automatically indexes all markdown files in `/src/content/docs/`:

- Extracts frontmatter (title, description)
- Cleans up markdown content
- Optionally generates AI summaries
- Creates searchable index for relevant document retrieval

### AI Conversation Flow

1. User submits question
2. System searches for relevant documentation
3. AI receives context and generates response
4. Response includes source citations
5. Conversation history is maintained

## Configuration Options

### Widget Configuration

The widget can be customized in `astro.config.mjs`:

```javascript
new window.StarSupport.default({
  apiEndpoint: "/api/star-support/chat",
  welcomeMessage: "Hi! How can I help you with the documentation today?",
  botName: "Docs Assistant",
  topicContext: "Volunteer Portal documentation",
  primaryColor: "#0066cc",
  position: "bottom-right",
  suggestedQuestions: [
    "How do I manage volunteers?",
    "How do shift signups work?",
    // ... more questions
  ],
});
```

### API Configuration

Environment variables for the API:

- `ANTHROPIC_API_KEY`: Required - Your Anthropic API key
- `STAR_SUPPORT_MODEL`: AI model to use (default: gpt-4o-mini)
- `STAR_SUPPORT_AUTH_KEY`: Optional API authentication
- `STAR_SUPPORT_GENERATE_SUMMARIES`: Generate AI summaries for docs
- `STAR_SUPPORT_SAVE_INDEX`: Save index to file for faster startup

## Customization

### Styling

The widget appearance can be customized by:

1. Modifying the widget configuration colors
2. Editing `/widget/src/star-support.ts` styles
3. Rebuilding with `npm run build:widget`

### Questions & Responses

- **Suggested Questions**: Edit the `suggestedQuestions` array
- **Welcome Message**: Change `welcomeMessage` in configuration
- **System Prompts**: Modify prompts in `/src/pages/api/star-support/chat.ts`

### Documentation Sources

The system automatically indexes:

- All `.md` and `.mdx` files in `/src/content/docs/`
- Frontmatter metadata (title, description)
- Cleaned markdown content

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically

### Other Platforms

Ensure your deployment:

1. Builds the widget (`npm run build:widget`)
2. Has Node.js runtime for API routes
3. Sets required environment variables

## Troubleshooting

### Widget Not Appearing

1. Check browser console for errors
2. Verify `/star-support.min.js` is accessible
3. Ensure script is loading after DOM ready

### API Errors

1. Verify `ANTHROPIC_API_KEY` is set correctly
2. Check API route logs for detailed errors
3. Test API endpoint directly: `POST /api/star-support/chat`

### Documentation Not Indexed

1. Check that documents are in `/src/content/docs/`
2. Verify markdown files have proper frontmatter
3. Look for indexing errors in server logs

## Development

### Widget Development

```bash
cd widget
npm run dev  # Watch mode for development
```

### Adding New Features

1. Modify widget in `/widget/src/star-support.ts`
2. Update API in `/src/pages/api/star-support/chat.ts`
3. Rebuild and test: `npm run build:widget`

## Credits

Based on the [star-support-demo](https://github.com/agoodway/star-support-demo) by [agoodway](https://github.com/agoodway).

## Support

If you encounter issues:

1. Check this README for common solutions
2. Review browser console and server logs
3. Verify all environment variables are set
4. Test with a fresh `.env.local` from `.env.example`
