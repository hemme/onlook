---
'@studio/app': minor
---

Adds GLM as a third agent: GLM-5.3 and GLM-5.3 Flash through Z.ai's Anthropic-compatible endpoint, with the API key pasted in-app and stored encrypted in the OS keychain.

Commits written by a GLM session carry no "Claude Code" attribution trailer: the CLI stamps that trailer whatever model answers behind its API, so for GLM the attribution settings are blanked.
