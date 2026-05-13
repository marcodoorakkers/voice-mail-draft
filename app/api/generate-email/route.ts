import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { transcript } = await req.json();

  if (!transcript) {
    return NextResponse.json({ error: "No transcript" }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Je krijgt een gesproken bericht dat iemand wil omzetten naar een e-mail.
Verwerk ALLE inhoud uit het gesproken bericht in de mail — laat niets weg en vat niet samen.
Maak er een nette, professionele e-mail van met correcte alinea's en zinsbouw.
Gebruik dezelfde taal als het ingesproken bericht.

Geef ALLEEN een JSON object terug, zonder extra tekst, uitleg of markdown. Exact dit formaat:
{"subject": "onderwerp hier", "body": "volledige mailtekst hier"}

Gesproken bericht:
${transcript}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    // Strip markdown code blocks if present
    const cleaned = content.text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse email", raw: content.text }, { status: 500 });
    }

    const email = JSON.parse(jsonMatch[0]);
    return NextResponse.json(email);
  } catch {
    return NextResponse.json({ error: "Could not parse email", raw: content.text }, { status: 500 });
  }
}
