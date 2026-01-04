---
title: My macOS Developer Toolkit
date: 2025-07-20
tags: [macos, tools, homebrew, productivity, development]
---

# My macOS Developer Toolkit

After years of refining my setup, here's the Homebrew collection that powers my daily workflow. These aren't just installed, they're tools I actually use.

## Terminal Power-Ups

The default terminal experience on macOS is... functional. These tools make it exceptional.

**fzf** — Fuzzy finder that changes everything. Ctrl+R for history search, Ctrl+T for file finding. Once you use it, you can't go back.

**bat** — `cat` with syntax highlighting and line numbers. I aliased `cat` to `bat` years ago and forgot `cat` existed.

**ripgrep** — Grep but fast. Respects `.gitignore`, searches recursively by default. Essential for large codebases.

**zoxide** — Smart `cd` that learns your habits. Type `z proj` and it jumps to `/Users/me/projects/my-project`. Magical.

**btop** — System monitor that looks like it belongs in a sci-fi movie. CPU, memory, network, disks—all beautifully rendered.

**powerlevel10k** — Zsh theme that shows git status, execution time, and context without being slow. The configuration wizard is brilliant.

**iterm2** — Terminal emulator that makes the default Terminal.app feel prehistoric. Split panes, search, profiles, triggers. Worth the switch.

**tmux** — Terminal multiplexer. Persistent sessions that survive disconnects. Essential for remote work and long-running processes.

**less** — The pager. Sounds boring until you need to navigate a 10MB log file. Faster than any editor for read-only exploration.

## Development Essentials

I work across multiple languages. Here's what actually matters.

**Go** — My primary language now. Fast compilation, single binary deployment, great tooling. The simplicity is underrated.

**Rust** — For when I need performance and safety guarantees. Steep learning curve but worth it for systems work.

**Python** with **pyenv** — Multiple Python versions without conflicts. Essential when different projects need different versions.

**Node** with **nvm** — Same story for JavaScript. Version switching should be painless.

**Zig** — The new kid. Using it for cross-compilation—it makes building C dependencies for other platforms trivial.

**bun** — JavaScript runtime that's absurdly fast. Package installs in seconds, scripts run instantly. Replaced npm for most tasks.

**staticcheck** — Go static analyzer. Catches bugs, suggests improvements, enforces idioms. Run it before every commit.

**vscode** — My primary editor. With the right extensions, it handles everything. Remote development, debugging, git integration—all solid.

## Git & Version Control

Git is non-negotiable. These tools make it pleasant.

**lazygit** — Terminal UI for git that's faster than any GUI. Staging hunks, interactive rebase, conflict resolution—all keyboard-driven.

**gh** — GitHub CLI. Create PRs, review code, manage issues without leaving the terminal. `gh pr create` is muscle memory.

**git-crypt** — Transparent encryption for sensitive files in repos. Secrets stay encrypted for everyone except authorized keys.

**tig** — Interactive git log viewer. Better than `git log` for exploring history.

## Container & Cloud

**colima** — Docker runtime on macOS without Docker Desktop. Lighter, faster, free. Uses Lima under the hood.

**lazydocker** — Like lazygit but for Docker. Container logs, stats, exec—all in a TUI.

**k9s** — Kubernetes dashboard in the terminal. Navigate clusters, view logs, exec into pods. Faster than any web UI.

**awscli** — AWS from the command line. Combined with profiles and `aws-vault`, it handles multi-account setups cleanly.

**terraform** — Infrastructure as code. Version-controlled cloud resources. No clicking around consoles.

## Database Tools

**duckdb** — In-process SQL database that's incredibly fast for analytics. Query Parquet files, CSVs, JSON directly. Game-changer for data work.

**postgresql** (libpq) — The postgres client library. `psql` for quick queries, but mostly used by applications.

**redis** — In-memory data store. Caching, queues, pub/sub. Simple and reliable.

**dbeaver-community** — When I need a GUI for databases. Supports everything: Postgres, MySQL, SQLite, DuckDB, MongoDB.

## AI/ML Tools

Running AI locally is no longer a novelty—it's practical.

**ollama** — Local LLM runner. Download models, run them locally, expose an API. Privacy-preserving AI.

**aider** — AI coding assistant in the terminal. Understands your codebase, makes edits, commits changes. Like having a pair programmer.

**huggingface-cli** — Download and manage models from Hugging Face. Essential for ML work.

## Security & Privacy

Security isn't optional. These tools make it manageable.

**gnupg** — GPG encryption. Sign commits, encrypt files, manage keys. The foundation of trust.

**pass** — Password manager built on GPG. Simple, unix-philosophy, works everywhere. Syncs via git.

**YubiKey tools** (ykman) — Hardware key management. 2FA, GPG keys, SSH authentication. Physical security matters.

**nmap** — Network scanner. Know what's on your network. Essential for security audits.

**lynis** — Security auditing for unix systems. Finds misconfigurations, suggests hardening.

**lulu** — macOS firewall that asks before apps connect out. See what's phoning home. Surprisingly educational.

## Media & Graphics

Automation for media tasks saves hours.

**ffmpeg** — Swiss army knife for video/audio. Convert formats, extract audio, resize video, create GIFs. Learn the basics—it pays off.

**imagemagick** — Image manipulation from CLI. Batch resize, convert, watermark. Scriptable image processing.

**upscayl** — AI image upscaling. Actually works for improving low-res images.

## macOS Enhancements

Making macOS behave the way I want.

**amethyst** — Tiling window manager. Windows snap to grid automatically. No more manual resizing.

**alt-tab** — Windows-style alt-tab. Shows all windows, not just apps. Should be default behavior.

**stats** — Menu bar system monitor. CPU, memory, network, battery—always visible.

**maccy** — Clipboard manager. History of everything you've copied. Searchable, keyboard-driven.

**Quick Look plugins** — Preview code, markdown, JSON, CSV without opening apps. Small quality-of-life wins.

**finicky** — URL router. Slack links open in Slack, GitHub in Firefox, everything else in Chrome. Control where links go.

## Hidden Gems

Tools that don't fit categories but earn their place.

**hyperfine** — Benchmarking tool. Compare command execution times with statistical rigor. "Is this actually faster?" now has an answer.

**asciinema** — Record terminal sessions. Share them as text-based recordings that can be copied from. Better than video for tutorials.

**hurl** — HTTP testing in plain text files. Define requests, assert responses, chain them together. API testing that's version-controllable.

**tldr** — Simplified man pages. Real examples instead of exhaustive documentation. `tldr tar` shows what you actually need.

**trash-cli** — Move to trash instead of `rm`. Recoverable deletions. Saved me more than once.

**gping** — Ping with a graph. Watch latency over time visually. Perfect for debugging network issues.

**httping** — Like ping but for HTTP endpoints. Measure web server latency, catch intermittent issues.

## The Philosophy

400+ packages installed, but I use maybe 60 daily. The rest are dependencies or experiments.

The pattern: replace slow defaults with fast alternatives, automate repetitive tasks, stay in the terminal when possible. Every tool here earned its place by saving time or reducing friction.

Your toolkit will differ—that's the point. Optimize for your workflow, not someone else's recommendations.

## The Full List

For completeness, here's everything else installed that didn't get commentary above:

**Languages & Runtimes**: deno, php, dotnet, openjdk, lua, luajit, ruby

**Build Tools**: cmake, autoconf, automake, libtool, make, maven, gradle, protobuf, goreleaser

**Version Managers**: virtualenv, poetry, pipx, composer

**More Git Tools**: git-lfs, git-extras, git-filter-repo, git-quick-stats, ghorg

**Container Tools**: docker-buildx, docker-compose, minikube, kind, kdash, qemu, lima

**Cloud Tools**: azure-cli, aws-vault, fastlane, cloudflared, rclone, scrcpy

**Database Clients**: mysql, sqlite, mongodb drivers, tokyo-cabinet, lmdb

**Terminal Tools**: tmate, broot, tree, duf, procs, glances, bmon, most, entr, watch, terminal-notifier

**Network Tools**: speedtest-cli, iperf3, dnslookup, wget, curl, aria2, httrack, lynx, browsh, ncftp, telnet, swaks, unbound, ldns, knot

**Code Quality**: golangci-lint, cloc, tokei, ctags, yara

**Document Tools**: pandoc, tidy-html5, diff-so-fancy, dos2unix, ttyrec, ttygif

**Media Tools**: ffmpeg@7, ghostscript, exiftool, giflib

**Security Tools**: openssh, openssl, libfido2, clamav, rkhunter, bettercap, net-snmp

**AI Tools**: codex, opencode, aiac, liblinear, ta-lib

**Mobile Dev**: android-platform-tools, ideviceinstaller, ios-webkit-debug-proxy, ipatool

**macOS Apps**: slack, discord, telegram, microsoft-teams, whatsapp, obsidian, postman, deepl, spotify, grammarly, espanso, shottr, mimestream, inkscape, pinta, calibre, iina, vlc, keka, balenaetcher, onyx, grandperspective, appcleaner, knockknock, gpg-suite, wireshark, openlens, db-browser-for-sqlite, android-studio, ollamac, chatgpt, mindmac, mqtt-explorer, requestly, imageoptim, orcaslicer, openscad, monitorcontrol, notunes

**Quick Look Plugins**: qlcolorcode, qlmarkdown, qlstephen, qlvideo, quicklook-csv, quicklook-json, qlprettypatch, webpquicklook

**Misc**: ask-cli, wrk, mincom, picocom, putty, mutt, z3, qrencode, task, newsboat, buku, navi, ddgr
