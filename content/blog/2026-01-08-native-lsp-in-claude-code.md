# Native LSP in Claude Code: The End of Serena and Workarounds

In December 2025, Anthropic released native LSP support in Claude Code (v2.0.74). If you develop in Go, this changes everything. Serena MCP? Not needed anymore. Manual gopls commands in CLAUDE.md? Optional. Here's what changed and how to set it up.

## The Problem I Had

Claude Code navigates code with `grep`, `Glob`, and file reading. It works. But when you need to:

- Find **all** references to a function (not just text matches)
- See who implements an interface
- Jump to a definition in an external dependency

...grep becomes noisy. False positives, partial matches, comments that confuse things.

Until recently, I had two solutions: Serena MCP or teaching Claude the gopls commands in CLAUDE.md. Now there's a third way. Official and cleaner.

## Three Solutions Compared

### 1. Native LSP Plugin (Recommended)

Since Claude Code 2.0.74, Anthropic supports [LSP plugins](https://code.claude.com/docs/en/discover-plugins) that expose native tools to the agent.

**Setup:**
```bash
# Add the LSP marketplace
/plugin marketplace add anthropics/claude-plugins-official

# Install the gopls plugin
/plugin install gopls-lsp@claude-plugins-official
```

**What you get:**
- `goToDefinition` - Jump directly to where functions, classes, or types are defined, even in external dependencies
- `findReferences` - Find all real usages of a symbol across the entire codebase, including test files
- `hover` - Get type signatures, parameter info, and inline documentation without navigating away
- `documentSymbol` - See the complete structure of a file (classes, methods, exports) at a glance

**Pros:**
- Zero config after install
- Claude uses tools automatically when needed
- Integrated into the flow, no bash intermediary
- Maintained by Anthropic/community

**Cons:**
- Relatively new feature (some bugs reported)

---

### 2. Serena MCP

[Serena](https://github.com/oraios/serena) ([docs](https://oraios.github.io/serena/)) is an MCP server that wraps LSP functionality.

```
Claude Code → MCP Protocol → Serena (Python) → gopls → Codebase
```

**Setup:**
```json
// ~/.claude/mcp.json
{
  "mcpServers": {
    "serena": {
      "command": "npx",
      "args": ["-y", "serena-mcp"],
      "env": {
        "WORKSPACE_PATH": "/path/to/project"
      }
    }
  }
}
```

**Pros:**
- Supports multiple languages with one config
- Uniform cross-language interface
- Pre-computed indexing for huge codebases

**Cons:**
- More breaking points
- Memory and latency overhead
- Now redundant if you only use Go

---

## My Setup

The native LSP plugin is the right choice. Simple and effective.

**Install:**
```bash
/plugin marketplace add anthropics/claude-plugins-official
/plugin install gopls-lsp@claude-plugins-official
/plugin install typescript-lsp@claude-plugins-official
/plugin install pyright-lsp@claude-plugins-official
/plugin install jdtls-lsp@claude-plugins-official
```

**Note:** Plugins require the language server installed on your system:
- Go: `gopls` (via `go install golang.org/x/tools/gopls@latest`)
- TypeScript: `@vtsls/language-server` (via `npm install -g @vtsls/language-server typescript`)
- Python: `pyright` (via `pip install pyright` or `npm install -g pyright`)
- Java: `jdtls` (via `brew install jdtls`, requires Java 21+)

That's it. Claude now has semantic code navigation automatically.

## Practical Example: Safe Refactoring

Renaming `UserService.Create` to `UserService.CreateUser`.

**Standard behavior with grep:**
```bash
grep -r "\.Create(" .
# Also finds: OrderService.Create, io.Create, template.Create...
```

**With native LSP:**
Claude automatically uses `findReferences` and finds only the 3 exact spots to modify. No false positives. No manual filtering.

## What You Can Actually Do

LSP gives Claude semantic understanding of your code. Here's what changes in practice:

**Safe refactoring:**
"Rename all occurrences of `processPayment` to `handlePayment`"
Claude finds only the actual function calls, not strings or comments containing "processPayment".

**Impact analysis:**
"If I change the signature of `UserService.authenticate`, what breaks?"
Claude finds all real usages across the codebase, including ones in test files.

**Jump through abstractions:**
"Show me where `DatabaseConnection.query` is actually implemented"
Claude navigates through interfaces and base classes to the concrete implementation.

**Understand dependencies:**
"What methods does `OrderController` use from `PaymentService`?"
Claude traces the actual method calls, not just text matches in imports.

The key difference: Claude sees your code structure, not just text. No more false positives from comments, strings, or similar names in different contexts.

## Supported Languages

The `claude-plugins-official` marketplace covers the main languages:

| Language | Plugin | Language Server |
|----------|--------|-----------------|
| Go | `gopls-lsp@claude-plugins-official` | gopls |
| TypeScript/JS | `typescript-lsp@claude-plugins-official` | vtsls |
| Rust | `rust-analyzer-lsp@claude-plugins-official` | rust-analyzer |

And many others: Python (pyright), Java, C/C++, C#, PHP, Kotlin, Ruby, HTML/CSS.

## When Serena Still Makes Sense

Honestly? Almost never now.

The only edge cases left:

- **Huge codebases** (500k+ LOC) where Serena's centralized indexing *might* be more efficient
- **Unsupported languages** if you use something exotic not in the list above

But for 99% of developers? Native LSP plugins cover everything.

## How Symbol Indexing Works

This is the key architectural difference between the two approaches.

### Native LSP Approach

gopls and other language servers work **on-demand**. When Claude asks for references, gopls analyzes the code right then and caches results in memory for your session. No persistent symbol map. Fast startup, slightly slower first query.

**Flow:**
1. Claude calls `findReferences`
2. gopls analyzes the codebase on-the-fly
3. Results cached in memory
4. Cache clears when session ends

**Performance:**
- Fast startup (no pre-computation)
- First lookup slightly slower (must analyze)
- Subsequent lookups fast (cached)
- Memory efficient

### Serena's Approach

Serena builds a **pre-computed index** of all symbols upfront. Every function, type, reference is mapped before you make any queries. Slower startup, but blazing fast lookups. The index persists across sessions.

**Flow:**
1. Serena builds complete symbol index at startup
2. Index includes all symbols, references, implementations
3. Queries hit the pre-computed index (very fast)
4. Index maintained across sessions

**Performance:**
- Slower startup (builds index)
- All lookups blazing fast (index lookup)
- Higher memory footprint (persistent index)
- Better for huge codebases with constant queries

### When Each Wins

For most projects, on-demand analysis is faster overall. You save time on startup and only pay for analysis when you actually need it.

Pre-indexing only wins on massive codebases (500k+ LOC) where you're constantly querying symbols across the entire project. The upfront cost pays off over time.

## What I Learned

The evolution was:

1. **2024**: grep + file reading (works, but imprecise)
2. **Early 2025**: Serena MCP (powerful, but complex)
3. **Late 2025**: Native LSP with 11 languages supported

Serena did its job. It solved a real problem when Claude Code had no native LSP support. Now Anthropic integrated it directly into the product, with plugins for all mainstream languages.

Two commands. Zero MCP servers. Zero JSON config. It works.

Keep it simple. The platform matured. Let it do its job.

---

*Updated January 2026: With Claude Code 2.0.74+, native LSP support covers 11 languages. Serena MCP is effectively obsolete for most use cases.*
