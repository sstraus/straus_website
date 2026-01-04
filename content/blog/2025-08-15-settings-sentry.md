---
title: SettingsSentry - Never Lose Your macOS Settings Again
date: 2025-08-15
tags: [macos, tools, backup, open-source]
---

# SettingsSentry - Never Lose Your macOS Settings Again

If you've ever reinstalled macOS or migrated to a new Mac, you know the pain: hours spent reconfiguring apps, losing custom settings, trying to remember how you had things set up.

I built [SettingsSentry](https://github.com/sstraus/SettingsSentry) to solve this.

## The Problem with Existing Tools

Mackup was the go-to solution for years, but it has issues:

- **Symlink risks** - Can overwrite settings unexpectedly
- **macOS Sonoma compatibility** - Breaks with recent macOS versions
- **No versioning** - One backup, no history

## What SettingsSentry Does Different

SettingsSentry takes a simpler, safer approach:

- **Copy, don't symlink** - Your original files stay untouched
- **Versioned backups** - Timestamped directories (YYYYMMDD-HHMMSS)
- **Dry-run mode** - Preview before executing
- **Encryption** - AES-256-GCM for sensitive configs
- **iCloud integration** - Backups sync automatically

## How It Works

Define what to back up in simple `.cfg` files:

```ini
[Settings]
name = VSCode
files = ${HOME}/Library/Application Support/Code/User/settings.json
        ${HOME}/Library/Application Support/Code/User/keybindings.json
```

Then run:

```bash
# Backup
settingssentry backup

# Restore on new machine
settingssentry restore

# Preview first
settingssentry backup --dry-run
```

## My Use Case

I run it automatically at reboot via cron. Every time my Mac restarts, my settings are backed up to iCloud. When I got a new MacBook, restoration took 5 minutes instead of 5 hours.

## Key Features

| Feature | Benefit |
|---------|---------|
| Versioned backups | Roll back to any point |
| Encryption | Safe for sensitive configs |
| Environment variables | `${HOME}`, `${APP_NAME}` expansion |
| Pre/post commands | Run scripts before/after operations |
| ZIP archives | Compressed, portable backups |

## Get Started

```bash
git clone https://github.com/sstraus/SettingsSentry
cd SettingsSentry
./settingssentry backup
```

Check the [GitHub repo](https://github.com/sstraus/SettingsSentry) for full documentation and example configs.
