/**
 * Meldrix Multi-AI Assistant - Acode Plugin
 * Supports: OpenRouter, Google Gemini, Anthropic Claude, OpenAI, Codex/Kie.ai
 * Version: 2.0.0 (Cline-style UI)
 */

class MeldrixAI {
  constructor() {
    this.providers = {
      openrouter: {
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        models: [
          "google/gemini-2.0-flash-001",
          "google/gemini-2.5-flash",
          "anthropic/claude-3.5-sonnet",
          "openai/gpt-4o-mini",
          "meta-llama/llama-3.3-70b-instruct",
          "deepseek/deepseek-chat"
        ],
        defaultModel: "google/gemini-2.0-flash-001",
        headers: (key) => ({
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "HTTP-Referer": "https://acode.app",
          "X-Title": "Meldrix AI Assistant"
        }),
        buildBody: (model, messages, opts) => ({
          model,
          messages,
          max_tokens: opts.maxTokens || 4096,
          temperature: opts.temperature ?? 0.7,
          stream: opts.stream || false
        }),
        extractContent: (data) => data?.choices?.[0]?.message?.content || ""
      },
      gemini: {
        name: "Google Gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/",
        models: [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-pro",
          "gemini-1.5-flash"
        ],
        defaultModel: "gemini-2.5-flash",
        getUrl: (model, key) =>
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        headers: () => ({ "Content-Type": "application/json" }),
        buildBody: (model, messages, opts) => {
          const contents = [];
          let systemInstruction = null;
          for (const msg of messages) {
            if (msg.role === "system") {
              systemInstruction = { parts: [{ text: msg.content }] };
            } else {
              const role = msg.role === "assistant" ? "model" : "user";
              contents.push({ role, parts: [{ text: msg.content }] });
            }
          }
          const body = {
            contents,
            generationConfig: {
              maxOutputTokens: opts.maxTokens || 4096,
              temperature: opts.temperature ?? 0.7
            }
          };
          if (systemInstruction) {
            body.systemInstruction = systemInstruction;
          }
          return body;
        },
        extractContent: (data) =>
          data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
      },
      claude: {
        name: "Anthropic Claude",
        baseUrl: "https://api.anthropic.com/v1/messages",
        models: [
          "claude-3-5-sonnet-20241022",
          "claude-3-opus-20240229",
          "claude-3-haiku-20240307"
        ],
        defaultModel: "claude-3-5-sonnet-20241022",
        headers: (key) => ({
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        }),
        buildBody: (model, messages, opts) => {
          let systemMsg = "";
          const chatMessages = [];
          for (const msg of messages) {
            if (msg.role === "system") {
              systemMsg += msg.content + "\n";
            } else {
              chatMessages.push(msg);
            }
          }
          return {
            model,
            messages: chatMessages,
            system: systemMsg.trim() || undefined,
            max_tokens: opts.maxTokens || 4096,
            temperature: opts.temperature ?? 0.7
          };
        },
        extractContent: (data) =>
          data?.content?.[0]?.text || ""
      },
      openai: {
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1/chat/completions",
        models: [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "o1-mini"
        ],
        defaultModel: "gpt-4o-mini",
        headers: (key) => ({
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        }),
        buildBody: (model, messages, opts) => ({
          model,
          messages,
          max_tokens: opts.maxTokens || 4096,
          temperature: opts.temperature ?? 0.7
        }),
        extractContent: (data) => data?.choices?.[0]?.message?.content || ""
      },
      codex: {
        name: "Codex / Kie.ai",
        baseUrl: "https://kie.ai/api/chat/completions",
        models: [
          "codex-1",
          "kie-code"
        ],
        defaultModel: "codex-1",
        headers: (key) => ({
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        }),
        buildBody: (model, messages, opts) => ({
          model,
          messages,
          max_tokens: opts.maxTokens || 4096,
          temperature: opts.temperature ?? 0.3
        }),
        extractContent: (data) => data?.choices?.[0]?.message?.content || ""
      }
    };

    this.STORAGE_KEY = "meldrix_ai_config";
    this.CHAT_HISTORY_KEY = "meldrix_ai_chat_history";
    this.config = this.loadConfig();
    this.chatHistory = this.loadChatHistory();
    this.panelVisible = false;
    this.isStreaming = false;
  }

  // ─── Config / Persistence ───────────────────────────

  loadConfig() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore corrupt data */ }
    return {
      activeProvider: "openrouter",
      activeModel: "google/gemini-2.0-flash-001",
      apiKeys: {},
      systemPrompt: "You are a helpful, expert software engineer assistant running inside the Acode code editor on Android. Provide concise, accurate, and production-ready code. When generating code, respond with only the code block unless the user asks for an explanation. Use modern best practices.",
      temperature: 0.7,
      maxTokens: 4096
    };
  }

  saveConfig() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      this.toast("Failed to save settings: " + e.message, true);
    }
  }

  getApiKey(provider) {
    return this.config.apiKeys?.[provider] || "";
  }

  setApiKey(provider, key) {
    if (!this.config.apiKeys) this.config.apiKeys = {};
    this.config.apiKeys[provider] = key;
    this.saveConfig();
  }

  loadChatHistory() {
    try {
      const raw = localStorage.getItem(this.CHAT_HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return [];
  }

  saveChatHistory() {
    try {
      localStorage.setItem(this.CHAT_HISTORY_KEY, JSON.stringify(this.chatHistory));
    } catch (e) { /* ignore */ }
  }

  addToChatHistory(role, content) {
    this.chatHistory.push({ role, content, timestamp: Date.now() });
    if (this.chatHistory.length > 50) this.chatHistory = this.chatHistory.slice(-50);
    this.saveChatHistory();
  }

  // ─── Toast Feedback ─────────────────────────────────

  toast(msg, isError = false) {
    if (typeof window !== "undefined" && window.toast) {
      window.toast(msg, isError ? "error" : "info", isError ? 4000 : 2500);
    } else {
      console.log(`[MeldrixAI] ${isError ? "ERROR: " : ""}${msg}`);
    }
  }

  // ─── API Calling Engine ─────────────────────────────

  async callAI(messages, options = {}) {
    const providerKey = options.provider || this.config.activeProvider;
    const provider = this.providers[providerKey];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerKey}`);
    }

    const apiKey = this.getApiKey(providerKey);
    if (!apiKey) {
      throw new Error(
        `No API key set for ${provider.name}. Open Settings to add your key.`
      );
    }

    const model = options.model || this.config.activeModel || provider.defaultModel;
    const opts = {
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
      stream: options.stream || false
    };

    const systemPrompt = this.config.systemPrompt;
    const fullMessages = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

    let url, fetchOptions;

    if (providerKey === "gemini") {
      url = provider.getUrl(model, apiKey);
      fetchOptions = {
        method: "POST",
        headers: provider.headers(),
        body: JSON.stringify(provider.buildBody(model, fullMessages, opts))
      };
    } else {
      url = provider.baseUrl;
      fetchOptions = {
        method: "POST",
        headers: provider.headers(apiKey),
        body: JSON.stringify(provider.buildBody(model, fullMessages, opts))
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    fetchOptions.signal = controller.signal;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errMsg = `${provider.name} returned ${response.status}`;
        if (response.status === 401 || response.status === 403) {
          errMsg = `Authentication error with ${provider.name}. Please check your API key in Settings.`;
        } else if (response.status === 429) {
          errMsg = `Rate limit hit on ${provider.name}. Please wait a moment and try again.`;
        } else if (response.status >= 500) {
          errMsg = `${provider.name} server error. The service may be temporarily unavailable.`;
        }
        try {
          const errData = JSON.parse(errorText);
          const detail = errData?.error?.message || errData?.message || errData?.error?.code || "";
          if (detail) errMsg += `: ${detail}`;
        } catch (_) { /* use raw error */ }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const content = provider.extractContent(data);
      if (!content) {
        throw new Error(`${provider.name} returned an empty response. Try another model.`);
      }
      return content;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out. Check your network connection.");
      }
      if (err.message && err.message.includes("Failed to fetch")) {
        throw new Error("Network error. Please check your internet connection.");
      }
      throw err;
    }
  }

  // ─── Streaming Call ─────────────────────────────────

  async callAIStream(messages, onChunk, options = {}) {
    const providerKey = options.provider || this.config.activeProvider;
    const provider = this.providers[providerKey];
    if (!provider) throw new Error(`Unknown provider: ${providerKey}`);

    const apiKey = this.getApiKey(providerKey);
    if (!apiKey) throw new Error(`No API key for ${provider.name}`);

    const model = options.model || this.config.activeModel || provider.defaultModel;
    const opts = {
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
      stream: true
    };

    const systemPrompt = this.config.systemPrompt;
    const fullMessages = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

    let url, fetchOptions;

    if (providerKey === "gemini") {
      url = provider.getUrl(model, apiKey);
      fetchOptions = {
        method: "POST",
        headers: provider.headers(),
        body: JSON.stringify(provider.buildBody(model, fullMessages, opts))
      };
    } else {
      url = provider.baseUrl;
      fetchOptions = {
        method: "POST",
        headers: provider.headers(apiKey),
        body: JSON.stringify(provider.buildBody(model, fullMessages, opts))
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    fetchOptions.signal = controller.signal;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errMsg = `${provider.name} error`;
        if (response.status === 401 || response.status === 403) {
          errMsg = `Authentication error with ${provider.name}. Check your API key.`;
        } else if (response.status === 429) {
          errMsg = `Rate limit hit on ${provider.name}. Wait and try again.`;
        }
        try {
          const errData = JSON.parse(errorText);
          errMsg += `: ${errData?.error?.message || ""}`;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.substring(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content ||
                            parsed?.choices?.[0]?.message?.content || "";
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } catch (_) {}
          }
        }
      }
      return fullText;
    } catch (err) {
      if (err.name === "AbortError") throw new Error("Request timed out.");
      if (err.message?.includes("Failed to fetch")) throw new Error("Network error.");
      throw err;
    }
  }

  // ─── Cline-Style Chat Panel UI ──────────────────────

  createChatPanel() {
    this.removeChatPanel();

    const panel = document.createElement("div");
    panel.id = "meldrix-chat-panel";
    panel.innerHTML = `
      <style>
        #meldrix-chat-panel {
          position: fixed; bottom: 0; right: 0; width: 380px; max-height: 520px;
          background: #1e1e2e; border-radius: 16px 16px 0 0;
          box-shadow: 0 -4px 24px rgba(0,0,0,0.5); z-index: 99999;
          display: flex; flex-direction: column; font-family: 'Segoe UI','Roboto',sans-serif;
          overflow: hidden; animation: meldrix-slide-up 0.3s ease-out;
        }
        @keyframes meldrix-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .meldrix-header {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          padding: 14px 16px; display: flex; align-items: center;
          justify-content: space-between; color: white; flex-shrink: 0;
        }
        .meldrix-header h3 {
          margin: 0; font-size: 15px; font-weight: 600;
          display: flex; align-items: center; gap: 8px;
        }
        .meldrix-header-actions { display: flex; gap: 8px; }
        .meldrix-header-btn {
          background: rgba(255,255,255,0.2); border: none; color: white;
          width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
          font-size: 14px; display: flex; align-items: center;
          justify-content: center; transition: background 0.2s;
        }
        .meldrix-header-btn:hover { background: rgba(255,255,255,0.3); }
        .meldrix-messages {
          flex: 1; overflow-y: auto; padding: 12px; display: flex;
          flex-direction: column; gap: 10px; max-height: 300px;
        }
        .meldrix-messages::-webkit-scrollbar { width: 6px; }
        .meldrix-messages::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2); border-radius: 3px;
        }
        .meldrix-msg {
          max-width: 85%; padding: 10px 14px; border-radius: 12px;
          font-size: 13px; line-height: 1.5; white-space: pre-wrap;
          word-wrap: break-word; animation: meldrix-fade-in 0.2s ease;
        }
        @keyframes meldrix-fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .meldrix-msg.user {
          background: #6366f1; color: white; align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        .meldrix-msg.assistant {
          background: #2d2d3d; color: #e0e0e0; align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        .meldrix-msg.system {
          background: transparent; color: #888; align-self: center;
          font-size: 11px; text-align: center; padding: 4px 12px;
        }
        .meldrix-input-area {
          border-top: 1px solid rgba(255,255,255,0.1); padding: 10px;
          display: flex; gap: 8px; align-items: flex-end;
          flex-shrink: 0; background: #181825;
        }
        .meldrix-input {
          flex: 1; background: #2d2d3d; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 10px 14px; color: #e0e0e0;
          font-size: 13px; outline: none; resize: none; font-family: inherit;
          min-height: 40px; max-height: 120px;
        }
        .meldrix-input:focus { border-color: #6366f1; }
        .meldrix-input::placeholder { color: #666; }
        .meldrix-send-btn {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none; color: white; width: 40px; height: 40px;
          border-radius: 10px; cursor: pointer; font-size: 18px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: transform 0.15s, opacity 0.15s;
        }
        .meldrix-send-btn:hover { transform: scale(1.05); }
        .meldrix-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .meldrix-status {
          font-size: 11px; color: #888; text-align: center;
          padding: 4px; flex-shrink: 0;
        }
        .meldrix-typing-dots span {
          animation: meldrix-bounce 1.4s infinite; display: inline-block;
          width: 6px; height: 6px; border-radius: 50%; background: #888;
          margin: 0 2px;
        }
        .meldrix-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .meldrix-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes meldrix-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .meldrix-provider-badge {
          font-size: 10px; background: rgba(255,255,255,0.15);
          padding: 2px 8px; border-radius: 10px; margin-left: 8px;
        }
      </style>
      <div class="meldrix-header">
        <h3>🤖 Meldrix AI <span class="meldrix-provider-badge" id="meldrix-provider-badge">OpenRouter</span></h3>
        <div class="meldrix-header-actions">
          <button class="meldrix-header-btn" id="meldrix-settings-btn" title="Settings">⚙️</button>
          <button class="meldrix-header-btn" id="meldrix-clear-btn" title="Clear Chat">️</button>
          <button class="meldrix-header-btn" id="meldrix-close-btn" title="Close"></button>
        </div>
      </div>
      <div class="meldrix-messages" id="meldrix-messages"></div>
      <div class="meldrix-status" id="meldrix-status"></div>
      <div class="meldrix-input-area">
        <textarea class="meldrix-input" id="meldrix-input" placeholder="Ask AI anything..." rows="1"></textarea>
        <button class="meldrix-send-btn" id="meldrix-send-btn" title="Send">➤</button>
      </div>
    `;

    document.body.appendChild(panel);

    const closeBtn = panel.querySelector("#meldrix-close-btn");
    const settingsBtn = panel.querySelector("#meldrix-settings-btn");
    const clearBtn = panel.querySelector("#meldrix-clear-btn");
    const sendBtn = panel.querySelector("#meldrix-send-btn");
    const input = panel.querySelector("#meldrix-input");
    const messagesArea = panel.querySelector("#meldrix-messages");
    const statusArea = panel.querySelector("#meldrix-status");

    closeBtn.addEventListener("click", () => this.hideChatPanel());
    settingsBtn.addEventListener("click", () => this.showSettings());
    clearBtn.addEventListener("click", () => {
      this.chatHistory = [];
      this.saveChatHistory();
      messagesArea.innerHTML = '';
      this.addSystemMessage("Chat cleared.");
    });

    sendBtn.addEventListener("click", () => this.sendChatMessage());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
    input.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });

    this.panel = panel;
    this.panelVisible = true;
    this.messagesArea = messagesArea;
    this.statusArea = statusArea;
    this.input = input;
    this.sendBtn = sendBtn;

    this.renderChatHistory();
    if (this.chatHistory.length === 0) {
      this.addSystemMessage("Meldrix AI Assistant ready! Ask me anything.");
    }
  }

  renderChatHistory() {
    if (!this.messagesArea) return;
    this.messagesArea.innerHTML = '';
    for (const msg of this.chatHistory) {
      this.appendMessageToUI(msg.role, msg.content);
    }
  }

  appendMessageToUI(role, content) {
    if (!this.messagesArea) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = `meldrix-msg ${role}`;
    msgDiv.textContent = content;
    this.messagesArea.appendChild(msgDiv);
    this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
  }

  addSystemMessage(text) {
    this.addToChatHistory("system", text);
    this.appendMessageToUI("system", text);
  }

  async sendChatMessage() {
    const text = this.input.value.trim();
    if (!text || this.isStreaming) return;

    this.input.value = "";
    this.input.style.height = "auto";

    this.addToChatHistory("user", text);
    this.appendMessageToUI("user", text);
    this.addSystemMessage("");

    this.showTypingIndicator();
    this.isStreaming = true;
    this.sendBtn.disabled = true;

    try {
      const messages = this.chatHistory
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));

      const fullResponse = await this.callAIStream(messages, (chunk) => {
        const msgs = this.messagesArea.querySelectorAll(".meldrix-msg.assistant");
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg) {
          lastMsg.textContent += chunk;
        }
      });

      this.addToChatHistory("assistant", fullResponse);
      this.appendMessageToUI("assistant", fullResponse);
    } catch (e) {
      this.addToChatHistory("assistant", `❌ Error: ${e.message}`);
      this.appendMessageToUI("assistant", `❌ Error: ${e.message}`);
      this.toast(e.message, true);
    } finally {
      this.removeTypingIndicator();
      this.isStreaming = false;
      this.sendBtn.disabled = false;
    }
  }

  showTypingIndicator() {
    if (!this.messagesArea) return;
    const indicator = document.createElement("div");
    indicator.className = "meldrix-msg assistant";
    indicator.id = "meldrix-typing";
    indicator.innerHTML = '<div class="meldrix-typing-dots"><span></span><span></span><span></span></div>';
    this.messagesArea.appendChild(indicator);
    this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
  }

  removeTypingIndicator() {
    const typing = document.getElementById("meldrix-typing");
    if (typing) typing.remove();
  }

  showChatPanel() {
    if (!this.panel) this.createChatPanel();
    if (this.panel) {
      this.panel.style.display = "flex";
      this.panelVisible = true;
    }
  }

  hideChatPanel() {
    if (this.panel) {
      this.panel.style.display = "none";
      this.panelVisible = false;
    }
  }

  toggleChatPanel() {
    if (this.panelVisible) {
      this.hideChatPanel();
    } else {
      this.showChatPanel();
    }
  }

  // ── Floating Button ───────────────────────────────

  createFloatingButton() {
    this.removeFloatingButton();

    const btn = document.createElement("button");
    btn.id = "meldrix-fab";
    btn.innerHTML = "🤖";
    btn.title = "Meldrix AI Assistant";
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px;
      border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none; color: white; font-size: 24px; cursor: pointer;
      box-shadow: 0 4px 16px rgba(99,102,241,0.4); z-index: 99998;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    `;
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.1)";
      btn.style.boxShadow = "0 6px 24px rgba(99,102,241,0.6)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 4px 16px rgba(99,102,241,0.4)";
    });
    btn.addEventListener("click", () => this.toggleChatPanel());

    document.body.appendChild(btn);
    this.fab = btn;
  }

  removeFloatingButton() {
    const existing = document.getElementById("meldrix-fab");
    if (existing) existing.remove();
  }

  removeChatPanel() {
    const existing = document.getElementById("meldrix-chat-panel");
    if (existing) existing.remove();
  }

  // ─── Settings ───────────────────────────────────────

  async showSettings() {
    const providerKeys = Object.keys(this.providers);
    const currentProvider = this.config.activeProvider || "openrouter";

    let provider;
    if (typeof acode !== "undefined" && acode.select) {
      provider = await acode.select(
        "Select AI Provider",
        providerKeys.map((k) => ({
          text: `${this.providers[k].name} ${k === currentProvider ? "✅" : ""}`,
          value: k
        })),
        false
      );
    } else {
      const list = providerKeys.map((k, i) => `${i + 1}. ${this.providers[k].name}${k === currentProvider ? " (active)" : ""}`).join("\n");
      const choice = prompt(`Select provider:\n${list}\nEnter number:`);
      const idx = parseInt(choice) - 1;
      provider = providerKeys[idx] || null;
    }
    if (!provider) return;

    const subAction = await this.showProviderSubMenu(provider);
    if (!subAction) return;

    switch (subAction) {
      case "set_key": await this.handleSetApiKey(provider); break;
      case "select_model": await this.handleSelectModel(provider); break;
      case "set_active":
        this.config.activeProvider = provider;
        this.config.activeModel = this.providers[provider].defaultModel;
        this.saveConfig();
        this.toast(`${this.providers[provider].name} set as active.`);
        const badge = document.getElementById("meldrix-provider-badge");
        if (badge) badge.textContent = this.providers[provider].name;
        break;
      case "system_prompt": await this.handleSystemPrompt(); break;
      case "temperature": await this.handleTemperature(); break;
      case "clear_keys":
        this.config.apiKeys = {};
        this.saveConfig();
        this.toast("All API keys cleared.");
        break;
    }
  }

  showProviderSubMenu(provider) {
    const provName = this.providers[provider].name;
    const hasKey = !!this.getApiKey(provider);
    const isActive = this.config.activeProvider === provider;
    const options = [
      { text: `🔑 Set API Key ${hasKey ? "✓" : "(required)"}`, value: "set_key" },
      { text: `📦 Select Model (current: ${this.config.activeModel || "default"})`, value: "select_model" },
      { text: `✅ Set as Active Provider ${isActive ? "← current" : ""}`, value: "set_active" },
      { text: "📝 Edit System Prompt", value: "system_prompt" },
      { text: `🌡️ Temperature (current: ${this.config.temperature ?? 0.7})`, value: "temperature" },
      { text: "🗑️ Clear All API Keys", value: "clear_keys" }
    ];

    return new Promise((resolve) => {
      if (typeof acode !== "undefined" && acode.select) {
        acode.select(`${provName} Settings`, options, false).then(resolve).catch(() => resolve(null));
      } else {
        const list = options.map((o, i) => `${i + 1}. ${o.text}`).join("\n");
        const choice = prompt(`${provName} Settings:\n${list}\nEnter number:`);
        const idx = parseInt(choice) - 1;
        resolve(options[idx]?.value || null);
      }
    });
  }

  async handleSetApiKey(provider) {
    const currentKey = this.getApiKey(provider);
    const masked = currentKey ? `Current: ${currentKey.substring(0, 6)}...${currentKey.substring(currentKey.length - 4)}` : "No key set";
    const newKey = await this.showPromptDialog(`API Key for ${this.providers[provider].name}`, `${masked}\n\nEnter API key:`, "");
    if (newKey !== null && newKey.trim()) {
      this.setApiKey(provider, newKey.trim());
      this.toast(`API key saved for ${this.providers[provider].name}.`);
    }
  }

  async handleSelectModel(provider) {
    const models = this.providers[provider].models;
    const currentModel = this.config.activeModel;
    let model;
    if (typeof acode !== "undefined" && acode.select) {
      model = await acode.select("Select Model", models.map((m) => ({ text: `${m} ${m === currentModel ? "✅" : ""}`, value: m })), false);
    } else {
      const list = models.map((m, i) => `${i + 1}. ${m}${m === currentModel ? " (active)" : ""}`).join("\n");
      const choice = prompt(`Select model:\n${list}\nEnter number:`);
      const idx = parseInt(choice) - 1;
      model = models[idx] || null;
    }
    if (model) {
      this.config.activeModel = model;
      this.config.activeProvider = provider;
      this.saveConfig();
      this.toast(`Model set to ${model}.`);
    }
  }

  async handleSystemPrompt() {
    const currentPrompt = this.config.systemPrompt || "";
    const newPrompt = await this.showPromptDialog("System Prompt", "Set the AI's behavior. Leave blank for default.", currentPrompt);
    if (newPrompt !== null) {
      this.config.systemPrompt = newPrompt.trim() || this.loadConfig().systemPrompt;
      this.saveConfig();
      this.toast("System prompt saved.");
    }
  }

  async handleTemperature() {
    const currentTemp = this.config.temperature ?? 0.7;
    const newTemp = await this.showPromptDialog("Temperature", "Set creativity (0.0 = deterministic, 1.0 = creative):", String(currentTemp));
    if (newTemp !== null && !isNaN(parseFloat(newTemp))) {
      const temp = Math.max(0, Math.min(2, parseFloat(newTemp)));
      this.config.temperature = temp;
      this.saveConfig();
      this.toast(`Temperature set to ${temp}.`);
    }
  }

  showPromptDialog(title, message, defaultValue = "") {
    return new Promise((resolve) => {
      if (typeof acode !== "undefined" && acode.prompt) {
        acode.prompt(title, message, defaultValue).then(resolve).catch(() => resolve(null));
      } else {
        resolve(prompt(`${title}\n${message}`, defaultValue));
      }
    });
  }

  // ─── Core Actions ─────────────────────────────────

  async generateCode(prompt, editor) {
    this.toast("Generating code...");
    try {
      const result = await this.callAI([{ role: "user", content: prompt }]);
      const code = this.extractCodeBlock(result);
      if (editor) { editor.insert(code); this.toast("Code inserted!"); }
      return code;
    } catch (e) { this.toast(e.message, true); return null; }
  }

  async explainCode(code, editor) {
    this.toast("Analyzing code...");
    try {
      const result = await this.callAI([{ role: "user", content: `Explain this code:\n\n\`\`\`\n${code}\n\`\`\`` }]);
      this.showResultDialog("Code Explanation", result);
      return result;
    } catch (e) { this.toast(e.message, true); return null; }
  }

  async refactorCode(code, instruction, editor) {
    this.toast("Refactoring...");
    try {
      const result = await this.callAI([{ role: "user", content: `Refactor:\n\n\`\`\`\n${code}\n\`\`\`` }]);
      const refactored = this.extractCodeBlock(result);
      if (editor) { editor.insert(refactored); this.toast("Code replaced!"); }
      return refactored;
    } catch (e) { this.toast(e.message, true); return null; }
  }

  async quickPrompt(prompt, editor) {
    this.toast("Asking AI...");
    try {
      const result = await this.callAI([{ role: "user", content: prompt }]);
      this.showResultDialog("AI Response", result);
      return result;
    } catch (e) { this.toast(e.message, true); return null; }
  }

  async completeFromSelection(editor) {
    if (!editor) { this.toast("Open a file first.", true); return; }
    const selection = editor.getSelection();
    const code = selection ? editor.session.getTextRange(selection) : "";
    if (!code || code.trim().length === 0) {
      this.toast("Select some code first.", true); return;
    }
    const action = await this.showActionPicker();
    if (!action) return;
    switch (action) {
      case "generate": await this.generateCode(`Continue: ${code}`, editor); break;
      case "explain": await this.explainCode(code, editor); break;
      case "refactor":
        const instruction = await this.showPromptDialog("Refactor Instruction", "Enter instructions (optional):");
        await this.refactorCode(code, instruction, editor);
        break;
    }
  }

  extractCodeBlock(text) {
    const match = text.match(/```[\w]*\n([\s\S]*?)```/);
    return match ? match[1].trim() : text.trim();
  }

  showActionPicker() {
    return new Promise((resolve) => {
      if (typeof acode !== "undefined" && acode.select) {
        acode.select("Choose Action", [
          { text: "🪄 Generate / Complete Code", value: "generate" },
          { text: "📖 Explain Code", value: "explain" },
          { text: "🔧 Refactor Code", value: "refactor" }
        ], false).then(resolve).catch(() => resolve(null));
      } else {
        const choice = prompt("Choose action:\n1. Generate/Complete\n2. Explain\n3. Refactor\nEnter number:");
        if (choice === "1") resolve("generate");
        else if (choice === "2") resolve("explain");
        else if (choice === "3") resolve("refactor");
        else resolve(null);
      }
    });
  }

  showResultDialog(title, content) {
    if (typeof acode !== "undefined" && acode.alert) {
      const displayContent = content.length > 3000 ? content.substring(0, 3000) + "\n\n[... truncated ...]" : content;
      acode.alert(title, displayContent).catch(() => {});
    } else {
      alert(`${title}\n\n${content}`);
    }
  }

  // ── Command Registration ───────────────────────────

  registerCommands() {
    if (typeof acode === "undefined" || !acode.registerCommand) return;

    const editor = () => {
      try { return acode.getEditor ? acode.getEditor() : null; } catch (_) { return null; }
    };

    acode.registerCommand("meldrix.ai.action", async () => {
      const ed = editor();
      if (!ed) { this.toast("Open a file first.", true); return; }
      await this.completeFromSelection(ed);
    });

    acode.registerCommand("meldrix.ai.quickPrompt", () => {
      const ed = editor();
      this.showQuickPromptDialog(ed);
    });

    acode.registerCommand("meldrix.ai.settings", () => this.showSettings());
    acode.registerCommand("meldrix.ai.togglePanel", () => this.toggleChatPanel());

    if (acode.addQuickTool) {
      acode.addQuickTool("meldrix.ai.action", "🤖", "Multi-AI Assistant");
    }
  }

  showQuickPromptDialog(editor) {
    this.showPromptDialog("Quick AI Prompt", "Ask the AI assistant anything:").then((prompt) => {
      if (prompt && prompt.trim()) this.quickPrompt(prompt.trim(), editor);
    });
  }

  // ─── Lifecycle ──────────────────────────────────────

  async init() {
    const waitForAcode = () => {
      return new Promise((resolve) => {
        if (typeof acode !== "undefined") { resolve(); return; }
        const interval = setInterval(() => { if (typeof acode !== "undefined") { clearInterval(interval); resolve(); } }, 100);
        setTimeout(() => { clearInterval(interval); resolve(); }, 10000);
      });
    };

    await waitForAcode();
    this.registerCommands();

    if (typeof document !== "undefined") {
      this.createFloatingButton();
      this.showChatPanel();
    }

    this.toast("🤖 Meldrix AI v2.0 ready! Tap the floating button to chat.");
    console.log("[MeldrixAI] Plugin initialized v2.0.0 with Cline-style UI");
  }

  async destroy() {
    try {
      if (typeof acode !== "undefined") {
        if (acode.unregisterCommand) {
          acode.unregisterCommand("meldrix.ai.action");
          acode.unregisterCommand("meldrix.ai.quickPrompt");
          acode.unregisterCommand("meldrix.ai.settings");
          acode.unregisterCommand("meldrix.ai.togglePanel");
        }
        if (acode.removeQuickTool) acode.removeQuickTool("meldrix.ai.action");
      }
    } catch (_) {}
    this.removeChatPanel();
    this.removeFloatingButton();
    console.log("[MeldrixAI] Plugin destroyed.");
  }
}

// ── Acode Plugin Entry Point ─────────────────────────

if (typeof acode !== "undefined" && acode.setPluginInit) {
  acode.setPluginInit(
    "com.meldrix.aiassistant",
    async () => {
      if (!window.__meldrixAI) window.__meldrixAI = new MeldrixAI();
      await window.__meldrixAI.init();
    },
    async () => {
      if (window.__meldrixAI) {
        await window.__meldrixAI.destroy();
        window.__meldrixAI = null;
      }
    }
  );
} else {
  console.warn("[MeldrixAI] acode plugin API not detected. Running standalone.");
  window.__meldrixAI = new MeldrixAI();
}