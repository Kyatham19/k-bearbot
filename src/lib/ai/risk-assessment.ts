import { generateResponse } from "./mistral";
import { RISK_ASSESSMENT_PROMPT } from "./prompts";
import { AGENT_CONFIG } from "./config";

export async function assessPortfolioRisk(
  portfolioData: string,
  newsContext: string
  ): Promise<string> {
    const prompt = `Portfolio Data:\n${portfolioData}\n\nRecent News:\n${newsContext}`;

  try {
    const result = await generateResponse(prompt, {
      systemPrompt: RISK_ASSESSMENT_PROMPT,
      stream: false,
      temperature: AGENT_CONFIG.general.temp,
      maxTokens: AGENT_CONFIG.general.maxTokens,
      timeoutMs: AGENT_CONFIG.general.timeoutMs,
    });
    return typeof result === "string" ? result : "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Unable to assess portfolio risk. ${message}`;
  }
}
