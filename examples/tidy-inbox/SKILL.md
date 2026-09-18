---
name: tidy-inbox
description: Turn a week of receipts in a personal inbox into one claim ready to send. Use when the user wants to be reimbursed for a trip, an interview or a client visit they paid for themselves.
license: MIT
metadata:
  version: "1.0"
---

# tidy-inbox

Someone spent their own money on a company's behalf and now has to claim it back. tidy-inbox finds the receipts in their mailbox, keeps the ones the company owes, and builds one claim: a summary, then every receipt behind it. It runs in Claude Code, Cursor and Codex.

## Steps

1. Ask for the trip dates, or read them from the calendar.
2. Search the inbox for receipts in that window.
3. Show the candidate list and take corrections.
4. Build the claim, write it into the folder the user names, and hand it back. Nothing is sent anywhere.
