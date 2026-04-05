---
title: "I Built Claude's Computer Use Before Claude Did. Then I Forgot to Tell Anyone."
date: 2026-04-05
tags: [ai, claude-code, mcp, macos, automation, agents]
---

# I Built Claude's Computer Use Before Claude Did. Then I Forgot to Tell Anyone.

Every AI lab is racing to ship "agentic computer use" right now. Anthropic introduced it, then refined it. The narrative is that AI driving your desktop is a new frontier.

It is not new for me. I have been using it for months. I built the thing myself, in Go, because I needed it to ship other software. It is called MCPMacControl, it is on GitHub under MIT, and the story of why it exists is more interesting than the tool itself.

## The problem nobody talks about

When I started building TUICommander, I hit a wall that every desktop developer knows. Testing a TUI application is hard. Testing a native macOS app is harder. The web has Playwright, Cypress, Puppeteer, and a decade of mature tooling. The desktop has nothing comparable. You either write brittle AppleScript, pay for commercial QA tools built for the enterprise treadmill, or you test by hand at 11 PM before a release and pray.

I tried testing by hand. It does not scale. Every time I changed a keybinding in tuicommander, I had to manually walk through 20 flows. Ask me how many times I shipped a bug because I skipped a flow I thought was unrelated.

So I built an MCP server that gives Claude actual eyes and hands on my Mac. Not in a browser. On the whole machine. Screen Recording permission, Accessibility permission, signed and notarized .app bundle, the full thing. I wanted Claude to be able to open tuicommander, drive it, read the screen, and tell me what broke. That is what it does now.

## Why the token bill does not explode

Everyone who tries Anthropic's computer use out of the box has the same complaint. It works, but the token consumption is brutal. A twenty-minute QA session can burn through a serious chunk of the monthly budget. The reason is straightforward: screenshots are huge, and vision models charge by the pixel.

I ran into this wall early and decided the only sane approach was to be aggressive about what gets sent to the model. MCPMacControl defaults screenshots to WebP lossy format at quality 25. That is not a typo. Twenty-five. Claude reads UI elements, menus, and text perfectly fine at that quality, and the files are an order of magnitude smaller than PNG. For small glyphs or icons you can bump it to 50 per call. You rarely need more.

Then there is region capture. Instead of screenshotting the whole 5K display every time, take a screenshot of the 400x300 region where the action is happening. Coordinates are preserved. Clicks still land where they should. The image shrinks dramatically and so does the token cost. Screenshots are also scaled to window point dimensions rather than native pixels, which means Retina displays do not quietly quadruple your bill.

None of these choices is clever. They are just the decisions you make when you are the one paying the bill and watching the counter go up in real time.

## The safety layer I care about most

Giving an AI mouse and keyboard control of the machine you are currently sitting at is genuinely unnerving the first time. A misfired keystroke at the wrong moment can type a prompt into your bank tab. A misplaced click can nuke a file. I was not willing to use something without knowing exactly when it was acting.

So every automated action gets three signals. A menu bar icon that lights up. A native popover describing the current operation. And, the one I insisted on, an orange border flash around the entire screen, plus a sound the instant before input is sent. You cannot miss it. If I see the flash and I did not expect it, I can yank my hands off the keyboard before anything lands.

There is also a less visible safety check. Before any keystroke goes out, the tool verifies that the target app is actually focused. If Claude asks to type into Xcode but Slack grabbed focus half a second ago, the input is blocked. This sounds obvious until you realize that almost no automation framework does it.

## The annoying macOS detail that shaped the architecture

One thing I learned the hard way: macOS grants Screen Recording and Accessibility permissions per application, not per binary. If you run a plain Go binary from iTerm, macOS attributes the permission to iTerm itself, not to your binary. Rebuild the binary, permissions evaporate. Switch terminals, grant them again. There is no entry in System Settings for your tool because, as far as macOS is concerned, your tool does not exist.

The only way out is to wrap the binary in a signed .app bundle. Then macOS gives it its own identity, permissions persist across updates, and users can actually manage them. That is why MCPMacControl is shipped as `/Applications/MCPMacControl.app` rather than as a binary in `/usr/local/bin`. It still talks stdio like any MCP server. The bundle is purely a permissions trick.

I wish someone had told me this before I spent a weekend debugging disappearing permissions.


Repo: [github.com/sstraus/McpMacControl](https://github.com/sstraus/McpMacControl)
