import { marked } from "marked";

interface StarSupportConfig {
  apiEndpoint?: string;
  welcomeMessage?: string;
  botName?: string;
  topicContext?: string;
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  position?: "bottom-right" | "bottom-left";
  authKey?: string;
  suggestedQuestions?: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  sources?: Array<{ title: string; url: string; slug: string }>;
}

class StarSupport {
  private config: StarSupportConfig;
  private container: HTMLElement | null = null;
  private chatContainer: HTMLElement | null = null;
  private messages: ChatMessage[] = [];
  private isOpen = false;
  private isLoading = false;
  private conversationId: string = "";

  constructor(config: StarSupportConfig = {}) {
    this.config = {
      apiEndpoint: "/api/star-support/chat",
      welcomeMessage: "Hi! How can I help you with the documentation today?",
      botName: "Docs Assistant",
      topicContext: "documentation",
      primaryColor: "#0066cc",
      backgroundColor: "#ffffff",
      textColor: "#333333",
      position: "bottom-right",
      suggestedQuestions: [
        "How do I manage volunteers?",
        "How do shift signups work?",
        "What are the admin permissions?",
        "How do I view reports?",
      ],
      ...config,
    };

    this.conversationId = this.generateId();
    this.init();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private init(): void {
    if (typeof window === "undefined") return;

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.createWidget());
    } else {
      this.createWidget();
    }
  }

  private createWidget(): void {
    // Create main container
    this.container = document.createElement("div");
    this.container.id = "star-support-widget";
    this.container.className = `star-support-container ${this.config.position}`;

    // Add styles
    this.addStyles();

    // Create widget HTML
    this.container.innerHTML = `
      <div class="star-support-toggle" data-testid="star-support-toggle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
        </svg>
      </div>
      
      <div class="star-support-chat" data-testid="star-support-chat" style="display: none;">
        <div class="star-support-header">
          <div class="star-support-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            ${this.config.botName}
          </div>
          <button class="star-support-close" data-testid="star-support-close" aria-label="Close chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="star-support-messages" data-testid="star-support-messages">
          <div class="star-support-message assistant">
            <div class="star-support-message-content">${
              this.config.welcomeMessage
            }</div>
          </div>
          ${this.createSuggestedQuestions()}
        </div>
        
        <div class="star-support-input-area">
          <div class="star-support-input-container">
            <input 
              type="text" 
              class="star-support-input" 
              data-testid="star-support-input"
              placeholder="Ask a question..." 
              maxlength="500"
            >
            <button class="star-support-send" data-testid="star-support-send" aria-label="Send message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    this.setupEventListeners();

    // Add to DOM
    document.body.appendChild(this.container);
    this.chatContainer = this.container.querySelector(".star-support-chat");
  }

  private createSuggestedQuestions(): string {
    if (
      !this.config.suggestedQuestions ||
      this.config.suggestedQuestions.length === 0
    ) {
      return "";
    }

    const questions = this.config.suggestedQuestions
      .map(
        (question) =>
          `<button class="star-support-suggestion" data-question="${this.escapeHtml(
            question
          )}">${this.escapeHtml(question)}</button>`
      )
      .join("");

    return `<div class="star-support-suggestions">${questions}</div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private renderMarkdown(text: string): string {
    // Configure marked for better rendering
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    // Render markdown to HTML
    const html = marked.parse(text) as string;

    // Return HTML as-is (links open in same tab)
    return html;
  }

  private setupEventListeners(): void {
    if (!this.container) return;

    // Toggle button
    const toggle = this.container.querySelector(".star-support-toggle");
    toggle?.addEventListener("click", () => this.toggleChat());

    // Close button
    const closeBtn = this.container.querySelector(".star-support-close");
    closeBtn?.addEventListener("click", () => this.closeChat());

    // Input and send
    const input = this.container.querySelector(
      ".star-support-input"
    ) as HTMLInputElement;
    const sendBtn = this.container.querySelector(".star-support-send");

    input?.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage(input.value.trim());
      }
    });

    sendBtn?.addEventListener("click", () => {
      const value = input?.value?.trim();
      if (value) {
        this.sendMessage(value);
      }
    });

    // Suggested questions
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("star-support-suggestion")) {
        const question = target.getAttribute("data-question");
        if (question) {
          this.sendMessage(question);
        }
      }
    });
  }

  private addStyles(): void {
    const styleId = "star-support-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .star-support-container {
        position: fixed;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }

      .star-support-container.bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .star-support-container.bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .star-support-toggle {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, ${this.config.primaryColor}, #0052a3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 8px 32px rgba(0, 102, 204, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: white;
        border: 2px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
      }

      .star-support-toggle:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 12px 40px rgba(0, 102, 204, 0.4), 0 4px 16px rgba(0, 0, 0, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
      }

      .star-support-toggle:active {
        transform: translateY(0) scale(1.02);
        transition: all 0.1s ease;
      }

      .star-support-chat {
        position: absolute;
        bottom: 84px;
        right: 0;
        width: 440px;
        max-width: calc(100vw - 40px);
        height: 600px;
        max-height: calc(100vh - 120px);
        background: ${this.config.backgroundColor};
        border-radius: 20px;
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.15),
          0 8px 24px rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        backdrop-filter: blur(20px);
        animation: chatSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes chatSlideIn {
        0% {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .star-support-container.bottom-left .star-support-chat {
        left: 0;
        right: auto;
      }

      .star-support-header {
        background: linear-gradient(135deg, ${this.config.primaryColor}, #0052a3);
        color: white;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: 20px 20px 0 0;
        position: relative;
        overflow: hidden;
      }

      .star-support-header::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
        pointer-events: none;
      }

      .star-support-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        font-size: 16px;
        position: relative;
        z-index: 1;
      }

      .star-support-title svg {
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
      }

      .star-support-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        cursor: pointer;
        padding: 8px;
        border-radius: 10px;
        opacity: 0.9;
        transition: all 0.2s ease;
        position: relative;
        z-index: 1;
        backdrop-filter: blur(10px);
      }

      .star-support-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }

      .star-support-close:active {
        transform: scale(0.95);
      }

      .star-support-messages {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        background: linear-gradient(to bottom, rgba(248, 250, 252, 0.5), rgba(241, 245, 249, 0.3));
      }

      .star-support-messages::-webkit-scrollbar {
        width: 6px;
      }

      .star-support-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .star-support-messages::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 3px;
      }

      .star-support-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.2);
      }

      .star-support-message {
        max-width: 80%;
        word-wrap: break-word;
      }

      .star-support-message.user {
        align-self: flex-end;
      }

      .star-support-message.assistant {
        align-self: flex-start;
      }

      .star-support-message-content {
        padding: 16px 20px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.95);
        color: ${this.config.textColor} !important;
        line-height: 1.6;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06);
        border: 1px solid rgba(0, 0, 0, 0.04);
        backdrop-filter: blur(10px);
        position: relative;
      }

      .star-support-message.assistant .star-support-message-content::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0, 102, 204, 0.1), transparent);
      }

      .star-support-message-content h2 {
        font-size: 1.2em;
        font-weight: 600;
        margin: 0.5em 0;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content h3 {
        font-size: 1.1em;
        font-weight: 600;
        margin: 0.5em 0;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content h4 {
        font-size: 1em;
        font-weight: 600;
        margin: 0.5em 0;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content p {
        margin: 0.5em 0;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content ul,
      .star-support-message-content ol {
        margin: 0.5em 0;
        padding-left: 1.5em;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content li {
        margin: 0.25em 0;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content code {
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9em;
      }

      .star-support-message-content pre {
        background: rgba(0, 0, 0, 0.05);
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 0.5em 0;
      }

      .star-support-message-content pre code {
        background: none;
        padding: 0;
      }

      .star-support-message-content a {
        color: ${this.config.primaryColor};
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
      }

      .star-support-message-content a:hover {
        border-bottom-color: ${this.config.primaryColor};
      }

      .star-support-message-content strong {
        font-weight: 600;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content em {
        font-style: italic;
        color: ${this.config.textColor} !important;
      }

      .star-support-message-content * {
        color: inherit !important;
      }

      .star-support-message.user .star-support-message-content {
        background: linear-gradient(135deg, ${this.config.primaryColor}, #0052a3);
        color: white;
        box-shadow: 0 4px 20px rgba(0, 102, 204, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .star-support-message.user .star-support-message-content::before {
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      }

      .star-support-message.user .star-support-message-content code {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      .star-support-suggestions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }

      .star-support-suggestion {
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(0, 102, 204, 0.2);
        border-radius: 12px;
        padding: 12px 16px;
        text-align: left;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 14px;
        color: ${this.config.textColor};
        backdrop-filter: blur(10px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }

      .star-support-suggestion:hover {
        border-color: ${this.config.primaryColor};
        background: rgba(0, 102, 204, 0.08);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 102, 204, 0.15);
      }

      .star-support-suggestion:active {
        transform: translateY(0);
        transition: all 0.1s ease;
      }

      .star-support-input-area {
        border-top: 1px solid rgba(0, 0, 0, 0.06);
        padding: 20px 24px;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
      }

      .star-support-input-container {
        display: flex;
        gap: 12px;
        align-items: flex-end;
      }

      .star-support-input {
        flex: 1;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 24px;
        padding: 12px 18px;
        font-size: 14px;
        outline: none;
        resize: none;
        max-height: 80px;
        background: rgba(255, 255, 255, 0.9);
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
        color: ${this.config.textColor} !important;
      }

      .star-support-input:focus {
        border-color: ${this.config.primaryColor};
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        background: rgba(255, 255, 255, 1);
      }

      .star-support-input::placeholder {
        color: rgba(0, 0, 0, 0.4);
      }

      .star-support-send {
        background: linear-gradient(135deg, ${this.config.primaryColor}, #0052a3);
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 12px rgba(0, 102, 204, 0.3);
        flex-shrink: 0;
      }

      .star-support-send:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(0, 102, 204, 0.4);
      }

      .star-support-send:active {
        transform: scale(0.95);
      }

      .star-support-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .star-support-sources {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        font-size: 12px;
        color: #666;
      }

      .star-support-source {
        display: inline-block;
        background: rgba(0, 102, 204, 0.08);
        padding: 4px 8px;
        border-radius: 6px;
        margin: 4px 4px 0 0;
        text-decoration: none;
        color: ${this.config.primaryColor};
        transition: all 0.2s;
        font-weight: 500;
      }

      .star-support-source:hover {
        background: rgba(0, 102, 204, 0.15);
        transform: translateY(-1px);
      }

      .star-support-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #666;
        font-style: italic;
      }

      .star-support-loader {
        width: 16px;
        height: 16px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid ${this.config.primaryColor};
        border-radius: 50%;
        animation: star-support-spin 1s linear infinite;
      }

      @keyframes star-support-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (max-width: 480px) {
        .star-support-chat {
          width: calc(100vw - 40px);
          height: calc(100vh - 120px);
          bottom: 80px;
          left: 20px !important;
          right: 20px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private toggleChat(): void {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  private openChat(): void {
    if (!this.chatContainer) return;

    this.chatContainer.style.display = "flex";
    this.isOpen = true;

    // Focus input
    const input = this.chatContainer.querySelector(
      ".star-support-input"
    ) as HTMLInputElement;
    setTimeout(() => input?.focus(), 100);
  }

  private closeChat(): void {
    if (!this.chatContainer) return;

    this.chatContainer.style.display = "none";
    this.isOpen = false;
  }

  private async sendMessage(content: string): Promise<void> {
    if (!content.trim() || this.isLoading) return;

    const input = this.container?.querySelector(
      ".star-support-input"
    ) as HTMLInputElement;
    if (input) {
      input.value = "";
    }

    // Add user message
    this.addMessage({ role: "user", content, timestamp: Date.now() });

    // Remove suggestions after first message
    const suggestions = this.container?.querySelector(
      ".star-support-suggestions"
    );
    if (suggestions) {
      suggestions.remove();
    }

    this.isLoading = true;
    this.showLoading();

    try {
      const response = await this.callAPI(content);
      this.hideLoading();

      if (response.message) {
        this.addMessage({
          role: "assistant",
          content: response.message,
          sources: response.sources,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      this.hideLoading();
      console.error("Chat error:", error);
      this.addMessage({
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now(),
      });
    }

    this.isLoading = false;
  }

  private async callAPI(message: string): Promise<any> {
    const messages = [
      ...this.messages,
      { role: "user" as const, content: message },
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-conversation-id": this.conversationId,
    };

    if (this.config.authKey) {
      headers["x-auth-key"] = this.config.authKey;
    }

    const response = await fetch(this.config.apiEndpoint!, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  private addMessage(message: ChatMessage): void {
    this.messages.push(message);

    const messagesContainer = this.container?.querySelector(
      ".star-support-messages"
    );
    if (!messagesContainer) return;

    const messageElement = document.createElement("div");
    messageElement.className = `star-support-message ${message.role}`;

    let sourcesHtml = "";
    if (message.sources && message.sources.length > 0) {
      const sourceLinks = message.sources
        .map(
          (source) =>
            `<a href="${source.url}" class="star-support-source">${source.title}</a>`
        )
        .join("");
      sourcesHtml = `<div class="star-support-sources">Sources: ${sourceLinks}</div>`;
    }

    // Render markdown for assistant messages, escape HTML for user messages
    const content =
      message.role === "assistant"
        ? this.renderMarkdown(message.content)
        : this.escapeHtml(message.content);

    messageElement.innerHTML = `
      <div class="star-support-message-content">${content}</div>
      ${sourcesHtml}
    `;

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private showLoading(): void {
    const messagesContainer = this.container?.querySelector(
      ".star-support-messages"
    );
    if (!messagesContainer) return;

    const loadingElement = document.createElement("div");
    loadingElement.className = "star-support-message assistant";
    loadingElement.innerHTML = `
      <div class="star-support-message-content star-support-loading">
        <div class="star-support-loader"></div>
        Thinking...
      </div>
    `;

    messagesContainer.appendChild(loadingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private hideLoading(): void {
    const loadingElement = this.container?.querySelector(
      ".star-support-loading"
    );
    if (loadingElement) {
      loadingElement.closest(".star-support-message")?.remove();
    }
  }

  // Public API
  public open(): void {
    this.openChat();
  }

  public close(): void {
    this.closeChat();
  }

  public destroy(): void {
    this.container?.remove();
    const styles = document.getElementById("star-support-styles");
    styles?.remove();
  }
}

// Web Component wrapper
class StarSupportElement extends HTMLElement {
  private widget: StarSupport | null = null;

  connectedCallback() {
    const config: StarSupportConfig = {
      apiEndpoint: this.getAttribute("api-endpoint") || undefined,
      welcomeMessage: this.getAttribute("welcome-message") || undefined,
      botName: this.getAttribute("bot-name") || undefined,
      topicContext: this.getAttribute("topic-context") || undefined,
      primaryColor: this.getAttribute("primary-color") || undefined,
      backgroundColor: this.getAttribute("background-color") || undefined,
      textColor: this.getAttribute("text-color") || undefined,
      position: (this.getAttribute("position") as any) || undefined,
      authKey: this.getAttribute("auth-key") || undefined,
      suggestedQuestions:
        this.getAttribute("suggested-questions")?.split("|") || undefined,
    };

    // Remove undefined values
    Object.keys(config).forEach((key) => {
      if (config[key as keyof StarSupportConfig] === undefined) {
        delete config[key as keyof StarSupportConfig];
      }
    });

    this.widget = new StarSupport(config);
  }

  disconnectedCallback() {
    this.widget?.destroy();
  }
}

// Register web component
if (typeof window !== "undefined" && !customElements.get("star-support")) {
  customElements.define("star-support", StarSupportElement);
}

// Export for use as ES module
export default StarSupport;

// Global namespace for script tag usage
if (typeof window !== "undefined") {
  (window as any).StarSupport = StarSupport;
}
