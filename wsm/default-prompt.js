#!/usr/bin/env node
// Prints a ready-to-copy AI prompt (buildDefaultAIPrompt from
// prompt-builder.js — the same "skip the form" defaults as the web UI's
// "Copy Prompt Cepat" button) to stdout for one subject.
//
// Used by the menu bar app's "Copy Prompt AI" menu: it shells out to
//   node default-prompt.js <subject>
// and copies stdout straight to the clipboard — no browser window needed.
//
// Usage: node default-prompt.js [subject]
//   subject: matematika (default) | fisika | kimia | biologi |
//            bahasa-indonesia | bahasa-inggris

const { buildDefaultAIPrompt } = require('./prompt-builder.js');

const subject = process.argv[2] || 'matematika';
process.stdout.write(buildDefaultAIPrompt(subject));
