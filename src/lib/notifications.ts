/**
 * WhatsApp Notification Helper (US-042)
 *
 * Sends minimal, non-sensitive notification messages to Dan via WhatsApp.
 * Uses OpenClaw's message tool pattern. This is a stub that logs notifications
 * in development and can be wired to a real WhatsApp API (e.g., Twilio, WhatsApp Business API).
 */

export interface NotificationConfig {
  webhookUrl?: string;
  enabled?: boolean;
}

const config: NotificationConfig = {
  webhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
  enabled: process.env.NOTIFICATIONS_ENABLED === "true",
};

export async function notifyDan(message: string): Promise<void> {
  try {
    // Security: ensure message doesn't contain sensitive details
    const sanitized = sanitizeMessage(message);

    if (!config.enabled || !config.webhookUrl) {
      console.log(`[Notification] (not sent — disabled): ${sanitized}`);
      return;
    }

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: sanitized }),
    });

    if (!response.ok) {
      console.error(`[Notification] Failed to send (${response.status}): ${sanitized}`);
    } else {
      console.log(`[Notification] Sent: ${sanitized}`);
    }
  } catch (error) {
    // Never throw — notifications are best-effort
    console.error("[Notification] Error sending notification:", error);
  }
}

function sanitizeMessage(message: string): string {
  // Keep messages short and non-sensitive
  // Strip any URLs, file paths, or code snippets
  return message
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/\/[\w/.-]+\.\w+/g, "[file]")
    .replace(/`[^`]+`/g, "[code]")
    .slice(0, 200);
}

export function formatBlockerNotification(cardId: string): string {
  return `WOWWAI: ${cardId} is blocked — needs your input`;
}

export function formatSummaryNotification(taskCount: number): string {
  return `WOWWAI: ${taskCount} task${taskCount !== 1 ? "s" : ""} need your input`;
}
