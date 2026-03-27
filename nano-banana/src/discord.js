import fs from 'fs/promises';

export async function sendToDiscord(filePath) {
  const webhook = process.env.DISCORD_WEBHOOK;
  if (!webhook) {
    throw new Error('DISCORD_WEBHOOK not set in .env');
  }

  const file = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([file]), 'image.png');

  const res = await fetch(webhook, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook error: ${res.status} ${text}`);
  }
}
