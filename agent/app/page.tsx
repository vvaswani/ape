import AgentInput from "@/components/AgentInput";
import AgentResponse from "@/components/AgentResponse";

export default function Page() {
  return (
    <main className="container">
      <h1>Talk to the APE!</h1>
      <AgentInput />
      <AgentResponse />
    </main>
  );
}
