## CLOUT V2

#### Table and Banner with lines and rounded corners:
╭─────────────────────────────────────────────────────────────────╮
│ 📋 Code Quality Health                                          │
╰─────────────────────────────────────────────────────────────────╯

##### named emoji support
`:clipboard:` -> 📋
This may require templating, perhaps `::clipboard::`

Not sure if these are emojis: `→` but names for common chars like those found in the `health-check.sh` set of scripts could be good. If they are not emojis, they will need different templating.


#### List items
- with child elements
- and specific indentation

```
  ✅ TypeScript compilation successful                   1s
  ✅ Build process successful                            1s
  ⚠️  Linting issues detected                            1s
     → Run: pnpm lint
  ⚠️  Some files significantly exceed size limits         3s
     → Run: ./cmd/analyze-file-complexity.sh
  ✅ No code annotations found                        220ms
  ❌ 27 dead code issues detected                        2s
     → Run: pnpm knip
   🚨 Action Required:
     • Address linting issues to maintain code quality standards.
     • Monitor file sizes and consider refactoring before they exceed limits.
     • Critical: Review and remove unused code following AGENTS.md dead code removal guidelines.
```
