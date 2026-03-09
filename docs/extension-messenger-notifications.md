# Messenger Notifications (Telegram / WhatsApp)

When the extension encounters an unknown application question (e.g. "May we contact you via Telegram/WhatsApp?"), it needs user input. The extension already:

1. **Shows an in-page modal** — User types the answer or skips.
2. **Shows a browser notification** — Works when the tab is in the background (autopilot, multi-tab).
3. **Saves the answer to cache** — Future applications reuse it.

## Adding Telegram / WhatsApp Notifications

To notify the user in Telegram or WhatsApp when an unknown field appears (especially useful when running autopilot in the background):

### Option A: Telegram Bot

1. **Create a Telegram Bot** via [@BotFather](https://t.me/BotFather).
2. **Get your chat ID** — Message the bot, then call `https://api.telegram.org/bot<TOKEN>/getUpdates`.
3. **Backend endpoint** — Add `POST /api/notify-telegram` that:
   - Accepts `{ message, field_label }`.
   - Sends via `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=...`.
4. **Extension** — When `showUnknownFieldNotification` fires, also `fetch(API_BASE + '/api/notify-telegram', { method: 'POST', body: JSON.stringify({...}) })` if the user has enabled it and configured a bot token/chat ID in Settings.

### Option B: WhatsApp Business API

- Requires WhatsApp Business API approval.
- More complex; typically used for business flows.
- Simpler alternative: use a service like [Twilio](https://www.twilio.com/whatsapp) or [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) for personal use.

### Option C: Webhook / IFTTT / Zapier

- Extension sends a webhook when unknown field appears.
- User configures IFTTT/Zapier to forward to Telegram, Discord, email, etc.

## Implementation Checklist

- [ ] Add `telegram_enabled`, `telegram_bot_token`, `telegram_chat_id` to extension settings.
- [ ] Add backend route `POST /api/notify-telegram` (or use a serverless function).
- [ ] In `showUnknownFieldNotification` handler, call the notify API if enabled.
- [ ] Document setup in Settings UI.
