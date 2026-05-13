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
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Je krijgt een gesproken bericht dat iemand wil omzetten naar een e-mail.
Verwerk ALLE inhoud uit het gesproken bericht in de mail — laat niets weg en vat niet samen.
Maak er een nette, professionele e-mail van met correcte alinea's en zinsbouw.
Geef het resultaat terug als JSON met de velden "subject" en "body".
Gebruik dezelfde taal als het ingesproken bericht.

Gesproken bericht:
${transcript}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Could not parse email" }, { status: 500 });
  }

  const email = JSON.parse(jsonMatch[0]);
  return NextResponse.json(email);
}
