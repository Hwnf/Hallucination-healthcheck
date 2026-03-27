#!/usr/bin/env node
import 'dotenv/config';
import { generateImage } from '../src/generate.js';
import { saveImage } from '../src/save.js';
import { sendToDiscord } from '../src/discord.js';

const args = process.argv.slice(2);

if (!args.length) {
  console.error('❌ Please provide a prompt.');
  console.log('Usage: nano-banana "your prompt" [--send]');
  process.exit(1);
}

const sendFlagIndex = args.indexOf('--send');
const shouldSend = sendFlagIndex !== -1;
if (shouldSend) args.splice(sendFlagIndex, 1);

const prompt = args.join(' ').trim();

if (!prompt) {
  console.error('❌ Prompt cannot be empty.');
  process.exit(1);
}

(async () => {
  try {
    console.log('🍌 Generating image...');
    const base64 = await generateImage(prompt);

    const filePath = await saveImage(base64, prompt);
    console.log(`✅ Saved: ${filePath}`);

    if (shouldSend) {
      console.log('📤 Sending to Discord...');
      await sendToDiscord(filePath);
      console.log('✅ Sent to Discord.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
