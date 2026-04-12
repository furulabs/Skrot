export interface ErgExtractResult {
  time?: string;
  distance?: number;
  pace?: string;
  strokeRate?: number;
}

const PROMPT = `Read the Concept2 erg screen in this photo. Extract the workout summary data and return ONLY a JSON object with these fields:
- time: string like "30:00" or "5:05.2"
- distance: number in meters (whole number)
- pace: string pace per 500m like "2:09.3"
- strokeRate: number (strokes per minute or RPM)

If a field is not visible or readable, omit it. Return only the JSON object, no markdown fences or explanation.`;

export async function extractErgData(
  base64DataUrl: string,
  apiKey: string,
): Promise<ErgExtractResult> {
  const [prefix, data] = base64DataUrl.split(',', 2);
  const mediaType = prefix.match(/data:(.*?);/)?.[1] ?? 'image/jpeg';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? '';

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned) as ErgExtractResult;
  } catch {
    throw new Error('Could not parse response from AI');
  }
}
