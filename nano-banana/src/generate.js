const DEFAULT_MODEL = 'models/gemini-3-pro-image-preview';

export async function generateImage(prompt) {
  const apiKey = process.env.GOOGLE_API_KEY;

  // Mock mode if no API key (for local verification)
  if (!apiKey) {
    console.warn('⚠️ GOOGLE_API_KEY not set. Using mock image.');
    const dummy = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
      'base64'
    );
    return dummy.toString('base64');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['IMAGE']
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error: ${response.status} ${text}`);
  }

  const data = await response.json();

  const imagePart = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image data returned from API.');
  }

  return imagePart.inlineData.data;
}
