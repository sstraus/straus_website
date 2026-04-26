---
title: Finicky - Take Control of Your URLs
date: 2025-02-13
tags: [macos, tools, productivity, automation]
---

# Finicky - Take Control of Your URLs

Every link you click goes somewhere. But where? On macOS, the answer is usually "whatever your default browser is." Finicky changes that.

[Finicky](https://github.com/johnste/finicky) is a URL router for macOS. It intercepts every link before it opens and lets you decide—programmatically—what happens next.

## Why You Need This

- Work links in your work browser, personal in personal
- Strip tracking parameters automatically
- Open Zoom links directly in the Zoom app
- Bypass paywalls with alternative frontends
- Clean up Microsoft SafeLinks mess

Let me walk through my actual configuration.

## Basic Setup

First, define your browsers:

```javascript
const work = {
  name: "Microsoft Edge",
};

const personal = {
  name: "Safari",
};

export default {
  defaultBrowser: "Safari",
  // ...
};
```

Safari is my default. Edge is for work. Simple foundation.

## Stripping Tracking Parameters

Every marketing link is polluted with tracking garbage. This rewrite rule cleans them:

```javascript
rewrite: [{
  match: () => true, // Apply to ALL URLs
  url: ({ url }) => {
    const removeKeysStartingWith = ["utm_", "uta_"];
    const removeKeys = ["fbclid", "gclid"];

    const search = url.search
      .split("&")
      .map((parameter) => parameter.split("="))
      .filter(([key]) => !removeKeysStartingWith.some(
        (startingWith) => key.startsWith(startingWith)
      ))
      .filter(([key]) => !removeKeys.some(
        (removeKey) => key === removeKey
      ));

    return {
      ...url,
      search: search.map((parameter) => parameter.join("=")).join("&"),
    };
  },
}]
```

Before: `example.com/page?utm_source=twitter&utm_campaign=launch&fbclid=abc123`
After: `example.com/page`

Every click, automatically cleaned.

## Decoding Microsoft SafeLinks

Microsoft wraps URLs in "SafeLinks" that are impossible to read. This extracts the actual URL:

```javascript
{
  match: /statics\.teams\.cdn\.office\.net\/evergreen-assets\/safelinks\/.*url=(https%3A%2F%2F(?:[a-zA-Z]+\.)zoom\.us.*)&locale=.*/,
  url: ({ url }) => {
    const match = url.search.match(/url=([^&]*)/);
    if (match && match[1]) {
      const decodedUrl = decodeURIComponent(match[1]);
      // Parse and return clean URL components
      // ...
    }
    return { ...url };
  },
}
```

Zoom links wrapped in Teams SafeLinks now work properly.

## Opening Zoom in the Zoom App

Web Zoom is terrible. The app is better. This converts web URLs to app URLs:

```javascript
{
  match: ({ url }) => url.host.includes("zoom.us") && url.pathname.includes("/j/"),
  url({ url }) {
    try {
      var pass = '&pwd=' + url.search.match(/pwd=(\w*)/)[1];
    } catch {
      var pass = ""
    }
    var conf = 'confno=' + url.pathname.match(/\/j\/(\d+)/)[1];
    return {
      search: conf + pass,
      pathname: '/join',
      protocol: "zoommtg"  // This triggers the Zoom app
    }
  }
}
```

Click a Zoom link → Zoom app opens directly. No browser detour.

## Bypassing Medium Paywalls

Medium's paywall is annoying. Freedium provides the same content without it:

```javascript
{
  match: /medium.com/,
  url: ({ url }) => {
    return {
      pathname: "/" + url.host + "/" + url.pathname,
      host: "freedium.cfd"
    }
  }
}
```

Every Medium link redirects to Freedium automatically.

## Privacy-Respecting TikTok

TikTok tracking is aggressive. ProxiTok provides a privacy-respecting frontend:

```javascript
{
  match: ({ url }) =>
    (url.host.endsWith("tiktok.com") && url.pathname.startsWith('/@')) ||
    url.host.endsWith("vm.tiktok.com"),
  url: ({ url }) => {
    const selectRandomTikTokProxy = () => {
      const TIKTOK_PROXIES = [
        "proxitok.pabloferreiro.es",
        "tok.habedieeh.re",
        "tt.vern.cc",
        // ... more instances
      ]
      return TIKTOK_PROXIES[Math.floor(Math.random() * TIKTOK_PROXIES.length)]
    }
    return {
      protocol: "https",
      host: selectRandomTikTokProxy(),
      pathname: url.pathname.startsWith('/@') ? url.pathname : `/@placeholder/video${url.pathname}`
    }
  }
}
```

Random proxy selection distributes load and improves reliability.

## Browser Handlers

After URL rewriting, handlers decide which browser opens the link:

```javascript
handlers: [
  {
    // Teams links open in Teams
    match: /^https?:\/\/teams\.microsoft\.com\/l\/meetup\-join\/.*$/,
    browser: "Microsoft Teams"
  },
  {
    // Zoom links open in Zoom app
    match: /zoom\.us\/join/,
    browser: "us.zoom.xos"
  },
  {
    // Work sites go to Edge
    match: [
      /lansweeper/,
      /app\.datadoghq\.eu/,
      /lattice(hq)?\.com/,
      /honeycomb\.io/,
      /powerbi\.com/,
      /office\.com/,
      /miro\.com/,
      /clickup\.com/
    ],
    browser: work
  },
  {
    // Links FROM Outlook always open in work browser
    match: ({ opener }) => opener.bundleId === "com.microsoft.Outlook",
    browser: work
  },
]
```

The `opener` context is powerful—you can route based on *which app* is opening the link, not just the URL itself.

## Installation

```bash
brew install --cask finicky
```

Create `~/.finicky.js` with your configuration. Finicky loads it automatically.

## The Philosophy

URLs are data. Finicky lets you transform that data before it becomes action. Strip tracking, fix broken links, route to the right place, bypass annoyances.

Once configured, it's invisible. Links just work—the way they should.
