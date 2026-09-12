/**
 * Meldrix Multi-AI Assistant - Acode Plugin
 * Supports: OpenRouter, Google Gemini, Anthropic Claude, OpenAI, Codex/Kie.ai
 * Version: 1.0.0
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
    this.config = this.loadConfig();
  }

  // ─── Config / Persistence ───────────────────────────────────

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

  // ─── Toast Feedback ─────────────────────────────────────────

  toast(msg, isError = false) {
    if (typeof window !== "undefined" && window.toast) {
      window.toast(msg, isError ? "error" : "info", isError ? 4000 : 2500);
    } else {
      console.log(`[MeldrixAI] ${isError ? "ERROR: " : ""}${msg}`);
    }
  }

  // ─── API Calling Engine ─────────────────────────────────────

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

    // Build request
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
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
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
          const detail =
            errData?.error?.message ||
            errData?.message ||
            errData?.error?.code ||
            "";
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

  // ─── Core Actions ───────────────────────────────────────────

  async generateCode(prompt, editor) {
    this.toast("Generating code...");
    try {
      const result = await this.callAI([
        { role: "user", content: prompt }
      ]);
      const code = this.extractCodeBlock(result);
      if (editor) {
        editor.insert(code);
        this.toast("Code inserted!");
      }
      return code;
    } catch (e) {
      this.toast(e.message, true);
      return null;
    }
  }

  async explainCode(code, editor) {
    this.toast("Analyzing code...");
    try {
      const result = await this.callAI([
        {
          role: "user",
          content: `Please explain the following code in detail. Describe what it does, its architecture, and any notable patterns or potential issues:\n\n\`\`\`\n${code}\n\`\`\``
        }
      ]);
      this.showResultDialog("Code Explanation", result);
      return result;
    } catch (e) {
      this.toast(e.message, true);
      return null;
    }
  }

  async refactorCode(code, instruction, editor) {
    this.toast("Refactoring code...");
    try {
      const result = await this.callAI([
        {
          role: "user",
          content: `Refactor the following code${instruction ? ` with these instructions: ${instruction}` : " to improve readability, performance, and maintainability"}. Return only the refactored code in a code block:\n\n\`\`\`\n${code}\n\`\`\``
        }
      ]);
      const refactored = this.extractCodeBlock(result);
      if (editor) {
        this.showConfirmDialog(
          "Accept Refactored Code?",
          `The AI suggests the following changes. Replace the selected code?\n\nPreview:\n\`\`\`\n${refactored.substring(0, 500)}${refactored.length > 500 ? "..." : ""}\n\`\`\``,
          () => {
            editor.insert(refactored);
            this.toast("Code replaced!");
          }
        );
      }
      return refactored;
    } catch (e) {
      this.toast(e.message, true);
      return null;
    }
  }

  async quickPrompt(prompt, editor) {
    this.toast("Asking AI...");
    try {
      const result = await this.callAI([
        { role: "user", content: prompt }
      ]);
      this.showResultDialog("AI Response", result);
      return result;
    } catch (e) {
      this.toast(e.message, true);
      return null;
    }
  }

  async completeFromSelection(editor) {
    if (!editor) {
      this.toast("No active editor found.", true);
      return;
    }
    const selection = editor.getSelection();
    const code = selection
      ? editor.session.getTextRange(selection)
      : "";

    if (!code || code.trim().length === 0) {
      this.toast("Select some code first, or use Quick Prompt for freeform questions.", true);
      return;
    }

    const action = await this.showActionPicker();
    if (!action) return;

    switch (action) {
      case "generate":
        await this.generateCode(
          `Continue or complete the following code. Return only the continuation, do not repeat the input:\n\n\`\`\`\n${code}\n\`\`\``,
          editor
        );
        break;
      case "explain":
        await this.explainCode(code, editor);
        break;
      case "refactor":
        const instruction = await this.showPromptDialog(
          "Refactor Instruction (optional)",
          "Enter specific refactoring instructions, or leave blank for general improvement:"
        );
        await this.refactorCode(code, instruction, editor);
        break;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────

  extractCodeBlock(text) {
    const match = text.match(/```[\w]*\n([\s\S]*?)```/);
    if (match) return match[1].trim();
    // If no code block markers, return text as-is (might be pure code)
    return text.trim();
  }

  // ─── UI Dialogs (using Acode APIs) ──────────────────────────

  showActionPicker() {
    return new Promise((resolve) => {
      if (typeof acode !== "undefined" && acode.select) {
        acode.select(
          "Choose Action",
          [
            { text: "🪄 Generate / Complete Code", value: "generate" },
            { text: "📖 Explain Code", value: "explain" },
            { text: "🔧 Refactor Code", value: "refactor" }
          ],
          false
        ).then(resolve).catch(() => resolve(null));
      } else {
        // Fallback: use prompt
        const choice = prompt(
          "Choose action:\n1. Generate/Complete\n2. Explain\n3. Refactor\n\nEnter number:"
        );
        if (choice === "1") resolve("generate");
        else if (choice === "2") resolve("explain");
        else if (choice === "3") resolve("refactor");
        else resolve(null);
      }
    });
  }

  showPromptDialog(title, message, defaultValue = "") {
    return new Promise((resolve) => {
      if (typeof acode !== "undefined" && acode.prompt) {
        acode.prompt(title, message, defaultValue).then(resolve).catch(() => resolve(null));
      } else {
        const val = prompt(`${title}\n${message}`, defaultValue);
        resolve(val);
      }
    });
  }

  showConfirmDialog(title, message, onConfirm) {
    if (typeof acode !== "undefined" && acode.confirm) {
      acode.confirm(title, message).then((ok) => {
        if (ok) onConfirm();
      }).catch(() => {});
    } else {
      if (confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    }
  }

  showResultDialog(title, content) {
    if (typeof acode !== "undefined" && acode.alert) {
      // Truncate very long content for the dialog
      const displayContent =
        content.length > 3000
          ? content.substring(0, 3000) + "\n\n[... content truncated ...]"
          : content;
      acode.alert(title, displayContent).catch(() => {});
    } else {
      alert(`${title}\n\n${content}`);
    }
  }

  showQuickPromptDialog(editor) {
    this.showPromptDialog(
      "Quick AI Prompt",
      "Ask the AI assistant anything:"
    ).then((prompt) => {
      if (prompt && prompt.trim()) {
        this.quickPrompt(prompt.trim(), editor);
      }
    });
  }

  // ─── Settings Page ──────────────────────────────────────────

  async showSettings() {
    const providerKeys = Object.keys(this.providers);
    const currentProvider = this.config.activeProvider || "openrouter";

    // Step 1: Choose provider
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
      const list = providerKeys
        .map((k, i) => `${i + 1}. ${this.providers[k].name}${k === currentProvider ? " (active)" : ""}`)
        .join("\n");
      const choice = prompt(`Select provider:\n${list}\nEnter number:`);
      const idx = parseInt(choice) - 1;
      provider = providerKeys[idx] || null;
    }

    if (!provider) return;

    // Step 2: Show provider sub-menu
    const subAction = await this.showProviderSubMenu(provider);
    if (!subAction) return;

    switch (subAction) {
      case "set_key":
        await this.handleSetApiKey(provider);
        break;
      case "select_model":
        await this.handleSelectModel(provider);
        break;
      case "set_active":
        this.config.activeProvider = provider;
        this.config.activeModel = this.providers[provider].defaultModel;
        this.saveConfig();
        this.toast(`${this.providers[provider].name} set as active provider.`);
        break;
      case "system_prompt":
        await this.handleSystemPrompt();
        break;
      case "temperature":
        await this.handleTemperature();
        break;
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
      {
        text: `🔑 Set API Key ${hasKey ? "✓" : "(required)"}`,
        value: "set_key"
      },
      {
        text: `📦 Select Model (current: ${this.config.activeModel || "default"})`,
        value: "select_model"
      },
      {
        text: `✅ Set as Active Provider ${isActive ? "← current" : ""}`,
        value: "set_active"
      },
      {
        text: "📝 Edit System Prompt",
        value: "system_prompt"
      },
      {
        text: `🌡️ Temperature (current: ${this.config.temperature ?? 0.7})`,
        value: "temperature"
      },
      {
        text: "🗑️ Clear All API Keys",
        value: "clear_keys"
      }
    ];

    return new Promise((resolve) => {
      if (typeof acode !== "undefined" && acode.select) {
        acode.select(`${provName} Settings`, options, false)
          .then(resolve)
          .catch(() => resolve(null));
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
    const masked = currentKey
      ? `Current: ${currentKey.substring(0, 6)}...${currentKey.substring(currentKey.length - 4)}`
      : "No key set";

    const newKey = await this.showPromptDialog(
      `API Key for ${this.providers[provider].name}`,
      `${masked}\n\nEnter API key:`,
      ""
    );

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
      model = await acode.select(
        "Select Model",
        models.map((m) => ({
          text: `${m} ${m === currentModel ? "✅" : ""}`,
          value: m
        })),
        false
      );
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
    const newPrompt = await this.showPromptDialog(
      "System Prompt",
      "Set the AI's behavior/personality. Leave blank for default.",
      currentPrompt
    );
    if (newPrompt !== null) {
      this.config.systemPrompt = newPrompt.trim() || this.loadConfig().systemPrompt;
      this.saveConfig();
      this.toast("System prompt saved.");
    }
  }

  async handleTemperature() {
    const currentTemp = this.config.temperature ?? 0.7;
    const newTemp = await this.showPromptDialog(
      "Temperature",
      "Set creativity level (0.0 = deterministic, 1.0 = creative):",
      String(currentTemp)
    );
    if (newTemp !== null && !isNaN(parseFloat(newTemp))) {
      const temp = Math.max(0, Math.min(2, parseFloat(newTemp)));
      this.config.temperature = temp;
      this.saveConfig();
      this.toast(`Temperature set to ${temp}.`);
    }
  }

  // ─── Command Registration ───────────────────────────────────

  registerCommands() {
    if (typeof acode === "undefined" || !acode.registerCommand) {
      console.warn("[MeldrixAI] acode.registerCommand not available");
      return;
    }

    const editor = () => {
      try {
        return acode.getEditor ? acode.getEditor() : null;
      } catch (_) {
        return null;
      }
    };

    acode.registerCommand("meldrix.ai.action", async () => {
      const ed = editor();
      if (!ed) {
        this.toast("Open a file first.", true);
        return;
      }
      await this.completeFromSelection(ed);
    });

    acode.registerCommand("meldrix.ai.quickPrompt", () => {
      const ed = editor();
      this.showQuickPromptDialog(ed);
    });

    acode.registerCommand("meldrix.ai.settings", () => {
      this.showSettings();
    });

    // Add to quick tools / floating icon if supported
    if (acode.addQuickTool) {
      acode.addQuickTool("meldrix.ai.action", "🤖", "Multi-AI Assistant");
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  async init() {
    // Wait for acode to be ready
    const waitForAcode = () => {
      return new Promise((resolve) => {
        if (typeof acode !== "undefined") {
          resolve();
          return;
        }
        const interval = setInterval(() => {
          if (typeof acode !== "undefined") {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        // Timeout after 10s
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000);
      });
    };

    await waitForAcode();
    this.registerCommands();
    this.toast("Meldrix Multi-AI Assistant ready. Select code & run 'AI Action' from palette.");
    console.log("[MeldrixAI] Plugin initialized v1.0.0");
  }

  async destroy() {
    // Unregister commands if possible
    try {
      if (typeof acode !== "undefined") {
        if (acode.unregisterCommand) {
          acode.unregisterCommand("meldrix.ai.action");
          acode.unregisterCommand("meldrix.ai.quickPrompt");
          acode.unregisterCommand("meldrix.ai.settings");
        }
        if (acode.removeQuickTool) {
          acode.removeQuickTool("meldrix.ai.action");
        }
      }
    } catch (_) { /* best-effort cleanup */ }
    console.log("[MeldrixAI] Plugin destroyed.");
  }
}

// ─── Acode Plugin Entry Point ─────────────────────────────────

if (typeof acode !== "undefined" && acode.setPluginInit) {
  acode.setPluginInit(
    "com.meldrix.aiassistant",
    async () => {
      if (!window.__meldrixAI) {
        window.__meldrixAI = new MeldrixAI();
      }
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
  // Standalone / testing fallback
  console.warn("[MeldrixAI] acode plugin API not detected. Running in standalone mode.");
  window.__meldrixAI = new MeldrixAI();
}
