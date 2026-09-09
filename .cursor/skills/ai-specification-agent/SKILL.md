---
name: ai-specification-agent
description: Implement or extend the Agile-SOFL Studio Specification Agent (ChatECNU, skills, clarification cards, patch preview). Use when working on agent sessions, LLM tools, ChatECNU, or Informal AI UX.
---

# AI Specification Agent

API key stays in the Electron **main** process. Configure profiles in **Settings** (base URL + API key + model). `.env` (`ECNU_API_KEY`, default model `ecnu-max`) is the fallback seed.

Base URL (ChatECNU default): `https://chat.ecnu.edu.cn/open/api/v1`

## Loop

User NL → skill prompt + spec summary → ChatECNU tools → UI cards → user confirms → patch apply.

Tools: `ask_clarification`, `read_specification`, `propose_changes`, `review_specification`.

`propose_changes` sees the current inventory (id / type / title / description) and can **add, update, remove, or move** existing nodes. Prefer updating an existing id over adding a duplicate.

## UX

Clarification: option chips + optional custom input. Checking or unchecking an already answered option asks whether to fork a new session from that question or overwrite the current thread. After fork/overwrite, leave the clarification pending until the user confirms — do not auto-resume the LLM turn.
Message bubbles: selectable text, with Copy and Fork actions.
Changes: `Patch → Preview → Apply | Reject`. After Apply or Reject, stop; wait for the next user message.
Sessions: `<project>/.agile-sofl/agent/sessions/`.
Informal document metadata: `<project>/.agile-sofl/informal-meta.json`.

## Don't

- Stream raw markdown into the document.
- Send the API key to the renderer.
- Dump the entire chat history into every LLM call (keep a recent window + spec digest).
