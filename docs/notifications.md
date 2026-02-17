# Notifications Guide

## Overview

WOWWAI can send WhatsApp notifications to Dan when tasks need attention. Notifications are minimal and non-sensitive by design.

## Setup

Set these environment variables:

```bash
WHATSAPP_WEBHOOK_URL=https://your-webhook-endpoint.com/send
NOTIFICATIONS_ENABLED=true
```

## Usage

```ts
import { notifyDan, formatBlockerNotification, formatSummaryNotification } from "@/lib/notifications";

// Notify about a blocked task
await notifyDan(formatBlockerNotification("WOWWAI-42"));
// Sends: "WOWWAI: WOWWAI-42 is blocked — needs your input"

// Notify about tasks needing attention
await notifyDan(formatSummaryNotification(3));
// Sends: "WOWWAI: 3 tasks need your input"
```

## Security Rules

- Messages never contain task descriptions, project details, or code
- URLs and file paths are automatically stripped
- Messages are capped at 200 characters
- Notifications are best-effort — errors are logged but never thrown

## Quiet Hours

The blocker notification trigger (US-043) respects quiet hours: no notifications between 23:00-08:00 AEST. This is enforced in the Convex scheduled function, not in this helper.

## When Disabled

When `NOTIFICATIONS_ENABLED` is not `true`, all notifications are logged to console but not sent. This is the default behavior in development.
