# Sage Learning

A Next.js prototype web application for a UX study observing interactions with an AI mentor ("Sage"). 

This application was designed to test how students interact with an AI acting under strict Socratic constraints (asking guiding questions instead of providing direct answers) specifically within the context of learning p5.js.

## What is this agent used for?

The "Sage" agent is configured using the Anthropic Claude API (`claude-sonnet-4-6`) with `<thinking>` blocks enabled. Its explicit constraints are:
1. **Never write code.** Not a single line, not even pseudocode.
2. **Never directly confirm correctness.** 
3. **Turn explanations into questions.**
4. **Resist frustration.** Acknowledge frustration warmly, but return to questioning.
5. **Always end with a question.**

### Features
- **Participant View (`/`)**: A clean, distraction-free interface where users chat with Sage. The model's `<thinking>` tokens are streamed in real-time but hidden from the user, giving the illusion of a human-like delay before the response.
- **Admin View (`/admin`)**: A password-protected dashboard observing all completed and active sessions. The researcher can expand the "Claude Reasoning" dropdown under any message to read exactly how the model decided to formulate its Socratic response, and export all sessions as JSON.
- **Session Export**: A permanent "End Session + Download" button lets users immediately download a text transcript of their conversation with exact timestamps for the researcher's records.

## Setup

1. Copy `.env.example` to `.env.local`
2. Add your Anthropic API Key (`ANTHROPIC_API_KEY`)
3. Set an admin password (`ADMIN_PASSWORD`)

```bash
npm install
npm run dev
```

The application runs exclusively using server-side in-memory storage, meaning sessions are cleared if the server restarts. To capture data permanently, use the in-app export functions.
