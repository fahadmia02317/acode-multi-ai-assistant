# Meldrix Multi-AI Assistant

**A production-ready multi-provider AI plugin for the [Acode](https://acode.app) Android code editor.**

Supports **OpenRouter**, **Google Gemini**, **Anthropic Claude**, **OpenAI**, and **Codex/Kie.ai** — all toggleable from a single in-app settings interface.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔀 **Multi-Provider** | Switch between OpenRouter, Gemini, Claude, OpenAI & Codex seamlessly |
| 📦 **Dynamic Models** | Choose from 15+ models (Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o Mini, etc.) |
| ⚙️ **Settings UI** | In-app settings dialog to manage API keys, models, system prompts, and temperature |
| 🪄 **Code Generation** | Select code → AI completes or continues it |
| 📖 **Explain Code** | Select code → AI explains what it does |
| 🔧 **Refactor Code** | Select code → AI refactors with your custom instructions |
| 💬 **Quick Prompt** | Ask the AI anything — not just code |
| 🔑 **Secure Storage** | API keys stored in Acode's localStorage (never transmitted elsewhere) |
| 🛡️ **Error Handling** | Graceful handling of network errors, rate limits, auth failures, and timeouts |

---

## 📦 Supported Providers & Models

### OpenRouter
- `google/gemini-2.0-flash-001`
- `google/gemini-2.5-flash`
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4o-mini`
- `meta-llama/llama-3.3-70b-instruct`
- `deepseek/deepseek-chat`

### Google Gemini
- `gemini-2.5-flash`
- `gemini-2.0-flash`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

### Anthropic Claude
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`
- `claude-3-haiku-20240307`

### OpenAI
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4-turbo`
- `o1-mini`

### Codex / Kie.ai
- `codex-1`
- `kie-code`

---

## 🚀 Installation (Local ZIP Method)

### Step 1: Prepare the Plugin ZIP

1. Create a new folder named `com.meldrix.aiassistant`
2. Place these three files inside the folder:
   ```
   com.meldrix.aiassistant/
   ├── plugin.json
   ├── main.js
   └── readme.md
   ```
3. **IMPORTANT**: Select all files inside the folder (not the folder itself) and create a ZIP archive:
   - On Android: Use a file manager like **Solid Explorer** or **ZArchiver**
   - Long-press the three files → Compress → ZIP
   - Name it anything, e.g., `meldrix-ai-v1.0.0.zip`

> ⚠️ **Critical**: The ZIP must contain `plugin.json` at the root level, NOT inside a subfolder. When you open the ZIP, you should see `plugin.json`, `main.js`, and `readme.md` directly — not a folder.

### Step 2: Install in Acode

1. Open **Acode** on your Android device
2. Tap the **hamburger menu (☰)** in the top-left corner
3. Go to **Settings** (gear icon)
4. Scroll down and tap **Plugins**
5. Tap the **Local** tab (or **+** button, depending on version)
6. Tap **Install from ZIP** or browse to select your ZIP file
7. Navigate to where you saved `meldrix-ai-v1.0.0.zip` and select it
8. Acode will install the plugin — you should see a success toast

### Step 3: Configure API Keys

1. After installation, open the **Command Palette** (search icon or swipe from top)
2. Type **"Meldrix"** or **"AI"** to find the plugin commands
3. Tap **"Meldrix AI: Settings"**
4. Select your desired provider (e.g., OpenRouter)
5. Tap **"Set API Key"** and paste your key
6. Choose a model and optionally customize the system prompt

### Step 4: Use the Plugin

- **AI Action**: Select some code in the editor → open Command Palette → "Meldrix AI: Action" → choose Generate / Explain / Refactor
- **Quick Prompt**: Command Palette → "Meldrix AI: Quick Prompt" → type any question
- The plugin also adds a quick-tool button (🤖) if your Acode version supports it

---

## 🔑 Getting API Keys

| Provider | Sign Up URL | Free Tier |
|---|---|---|
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | ✅ Free models available |
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com) | ✅ Free tier with rate limits |
| **Anthropic Claude** | [console.anthropic.com](https://console.anthropic.com) | ⚠️ Paid only |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | ⚠️ Paid only |
| **Codex / Kie.ai** | [kie.ai](https://kie.ai) | Check website |

> 💡 **Recommended for beginners**: Use OpenRouter with their free models — no payment required.

---

## 🛠️ Manual Verification (Optional)

To verify the ZIP is structured correctly before installing:

```bash
unzip -l meldrix-ai-v1.0.0.zip
```

Expected output:
```
  Length      Date    Time    Name
---------  ---------- -----   ----
      350  2026-09-12 11:00   plugin.json
    18400  2026-09-12 11:00   main.js
     5200  2026-09-12 11:00   readme.md
---------                     -------
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| Plugin not appearing | Ensure ZIP has files at root level, not inside a folder |
| "Authentication error" | Verify API key is correct and has not expired |
| "Rate limit" | Wait 30-60 seconds, or switch to another provider |
| "Network error" | Check internet connection; try WiFi instead of mobile data |
| "No active editor" | Open a file in Acode first before using the plugin |
| Empty response | Try a different model; some free models have content restrictions |

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

**Made with ❤️ by Meldrix**
