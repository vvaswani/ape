import { NextResponse } from "next/server";
import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";

export const runtime = "nodejs";

const apeAgent = new Agent({
  id: "ape-agent",
  name: "ape-agent",
  instructions: `
    You are a knowledgeable portfolio advisory assistant.
    Users will send short questions or instructions about portfolio allocation,
    rebalancing, risk management, or investing strategies.
    Provide concise, helpful, and actionable advice.
  `,
  model: "google/gemini-2.5-flash",
});

const mastra = new Mastra({
  agents: {
    apeAgent,
  },
});

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    const agent = mastra.getAgent("apeAgent");
    const result = await agent.generate([
      { role: "user", content: input },
    ]);

    return NextResponse.json({ response: result.text });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "failed to generate" },
      { status: 500 }
    );
  }
}
