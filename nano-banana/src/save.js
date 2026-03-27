import fs from 'fs/promises';
import path from 'path';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export async function saveImage(base64, prompt) {
  const buffer = Buffer.from(base64, 'base64');
  const timestamp = Date.now();
  const slug = slugify(prompt) || 'image';
  const filename = `${timestamp}-${slug}.png`;

  const imagesDir = path.resolve('images');
  await fs.mkdir(imagesDir, { recursive: true });

  const filePath = path.join(imagesDir, filename);
  await fs.writeFile(filePath, buffer);

  return filePath;
}
