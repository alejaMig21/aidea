# Inferred layers: telegram (blind: no README, docs, markdown or git history)

Evidence read: `pyproject.toml`, `config.example.toml`, the tree of `src/` and `tests/`, `domain/events.py` and `domain/models.py` (class names), `termgram_mcp/policy.py`, 70 test names (config loader, download bandwidth, resume, formatting), and the code graph of the project (packages, entry points, hot spots). About 12 reads. Status: O = observed in code, I = inferred, U = unknown (asked).

## Architecture

- **termgram (container, Python 3.11, Textual UI)** [O: pyproject, `src/termgram/__main__.py` entry point, `ui/screens/{login,main}.py`]. A terminal Telegram client.
  - **ui** (screens login and main; widgets sidebar, thread, downloads panel, notification rules panel, profile and public-info panels, settings panel, translation panel, poll, inline and reply keyboards, status bar) [O].
  - **domain** (chats, messages, auth, bots, polls, notifications and rules, translation, search query, link router; an `EventBus` with typed events such as MessageReceived, ConnectionStateChanged, DownloadProgress) [O: `domain/`, `bus.py`, `events.py`]. Event-driven core between UI and services [I].
  - **tg ports and adapters** (`tg/ports.py`, a Telethon adapter and a TDLib adapter chosen by `[telegram] backend`) [O: `config/schema`, tests `test_backend_*`]. Hexagonal style: the domain does not know the Telegram library [I, high].
  - **downloads engine** (queue, bandwidth limiter, resume offset, cache eviction, window scheduler) [O].
  - **storage** (SQLite: connection, migrations, repositories for downloads, folder gates, notification rules and the outgoing queue) [O: `storage/`; "SQLite" is I from `db.connect`, medium].
  - **config** (TOML loader with precedence explicit path, env var, platform default; a writer that keeps comments for the Settings tab) [O: tests, `tomlkit`].
- **termgram_mcp (container, optional)** [O: `termgram_mcp/`, `mcp` extra]. An MCP server with read tools and write tools; a write to a chat outside an allowlist is refused until a second call with `confirm=true`; it runs on the TDLib backend with its own session name [O: `policy.py`, tests `test_mcp_section_*`].
- **External systems:** Telegram (MTProto through Telethon, or TDLib), DeepL (`translation_deepl.py`, optional, off without a key) [O].
- Relations: ui -> domain via events and services; domain -> tg ports; tg adapters -> Telegram; domain -> storage; downloads -> tg and storage; termgram_mcp -> the same domain and tg layers [I, from the import graph clusters].

## Requirements (functional)

1. As a user, I log in to my Telegram account, including by QR code. [O: `ui/screens/login.py`, `ui/qr.py`, `qrcode` dependency; tests `test_login_screen`.] Criteria: missing credentials fail with an actionable message [O: `test_missing_required_credentials_fails`].
2. As a user, I browse my chats and folders and read a conversation with day separators (Today, Yesterday, a date). [O: sidebar, thread, `test_formatting` separators, `Folder` model.]
3. As a user, I send, edit and delete messages, and a message written offline is queued and sent when the connection returns, with upload progress. [O: events MessageQueued, MessageEdited, MessageDeleted, UploadProgress; `outgoing_queue_repo`.]
4. As a user, I download media with a limit on concurrent downloads, a bandwidth cap, time windows, resume after interruption, and automatic cache eviction. [O: `downloads/`, tests for bandwidth, window hours, resume offset.] Criteria: a zero limit means unlimited; a missing part file resumes from zero [O: tests].
5. As a user, I use bots: inline keyboards, reply keyboards and bot deep links. [O: widgets, `bot_links.py`, `BotDeepLink`.]
6. As a user, I vote on and follow polls. [O: `polls.py`, `PollUpdated`.]
7. As a user, I get notifications with per-chat rules and an option to hide the message preview. [O: `notification_rules*`, config tests `test_notifications_*`.]
8. As a user, I translate messages with DeepL when I configure a key. [O: `translation_deepl.py`, tests `test_translation_*`.]
9. As a user, I search messages. [O: `search_query.py`, `ChatSearch`, `SearchPage`.]
10. As a user, I change settings inside the app and my config file keeps its comments. [O: settings panel, `tomlkit`.]
11. As a user on a flaky or filtered network, I stay connected: automatic reconnect with backoff, a connection indicator, and options for IPv6 and obfuscated connections. [O: `[connection]` in the example config, `test_use_ipv6_*`, `test_use_obfuscated_*`.]
12. As someone who automates with an AI assistant, I let it read my chats and, with confirmation or an allowlist, write to them. [O: `termgram_mcp`.] Purpose ("so that") [I].
- Non-functional: credentials never leak between tests and layers [O: `test_credential_isolation`]; errors tell the person what to do [O]; a TUI-only install must not pull the MCP SDK or TDLib (optional extras) [O: pyproject comments].

## Business

- **Value proposition (I, medium):** use Telegram fully from a terminal, light and keyboard-driven, and let AI assistants act on your Telegram safely.
- **Customer segments (I, low):** people who live in a terminal; people on networks that filter Telegram (the IPv6 and obfuscation options exist for that); people who automate with AI agents (the MCP server).
- **Channels (I, low):** a Python package and a local executable built with PyInstaller (`packaging/`, `pyinstaller` extra).
- **Revenue and costs (U):** MIT licence, no billing or plans in the code; nothing shows a revenue model.
- **Questions for the person:** Is this for personal use or for others? Is it meant to be published? Who is the first user you picture?
