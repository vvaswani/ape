import type { APIRoute } from "astro";
import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";

export const prerender = false;

const apeAgent = new Agent({
  id: "ape-agent",
  name: "ape-agent",
  instructions: `
    You are a knowledgeable portfolio advisory assistant.
    Users will send short questions or instructions about portfolio allocation,
    rebalancing, risk management, or investing strategies.
    Provide concise, helpful, and actionable advice.
  `,
  model:"google/gemini-2.5-flash", // or replace with another supported model
});

const mastra = new Mastra({
  agents: {
    apeAgent,
  },
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { input } = await request.json();

    // Get the Mastra agent
    const agent = mastra.getAgent("apeAgent");

    // Generate a response
    const result = await agent.generate([
      { role: "user", content: input },
    ]);

    const text = result.text;

    return new Response(
      JSON.stringify({ response: text }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "failed to generate" }),
      { status: 500 }
    );
  }
};
