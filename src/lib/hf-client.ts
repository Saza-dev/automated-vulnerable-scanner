// src/lib/hf-client.ts
import { VulnerabilityFinding } from "@/types";

const HF_ENDPOINT_URL = process.env.HF_ENDPOINT_URL;
const HF_TOKEN = process.env.HF_TOKEN;

export async function analyzeCode(
  filePath: string,
  code: string
): Promise<VulnerabilityFinding[]> {
  if (!HF_ENDPOINT_URL || !HF_TOKEN) {
    throw new Error("Missing Hugging Face environment variables");
  }

  try {
    const response = await fetch(HF_ENDPOINT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: code,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `HF API Error: ${response.status} - ${await response.text()}`
      );
    }

    const rawOutput = await response.text();
    return parseLLMOutput(rawOutput, filePath);
  } catch (error) {
    console.error(`Failed to analyze ${filePath}:`, error);
    return [];
  }
}


/**
 * Parses DeepSeek-R1 output, stripping reasoning tags and handling
 * both JSON and structured markdown findings with a safe fallback.
 */
function parseLLMOutput(rawText: string, filePath: string): VulnerabilityFinding[] {
  let text = rawText;

  // 1. Strip <think>...</think> or any leftover reasoning before </think>
  if (text.includes("</think>")) {
    text = text.split("</think>")[1].trim();
  } else {
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  // 2. Check if the model reported no vulnerabilities
  const lower = text.toLowerCase();
  if (
    lower.includes("no vulnerabilities") ||
    lower.includes("vulnerable code**: none") ||
    lower.includes("vulnerable code: none") ||
    lower.includes("risk**: none") ||
    text.trim() === ""
  ) {
    return [];
  }

  // 3. Try parsing standard JSON if the model actually listened to the prompt
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) return parsed as VulnerabilityFinding[];
    } catch {
      // Fall through to text extraction
    }
  }

  // 4. Parse custom fine-tuned markdown format (1. Code 2. Risk 3. CWE)
  try {
    // Make regexes much more forgiving for numbered lists
    const riskMatch = text.match(/(?:2\.\s*\*\*Risk\*\*|Risk\*\*?:|Risk)\s*([\s\S]*?)(?:3\.\s*\*\*CWE|CWE Classification\*\*?:|$)/i);
    const cweMatch = text.match(/(?:3\.\s*\*\*CWE Classification\*\*|CWE Classification\*\*?:)\s*([^\n]+)/i);

    // CRITICAL FIX: If we can't find the exact "Risk" header, just use the entire raw text as the description!
    const description = (riskMatch && riskMatch[1].trim()) ? riskMatch[1].trim() : text.trim();
    
    const cwe = (cweMatch && cweMatch[1].trim()) ? cweMatch[1].trim().replace(/[.*]/g, "") : null;

    // Determine severity heuristically 
    let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "HIGH";
    if (lower.includes("sql injection") || lower.includes("cwe-89") || lower.includes("rce")) {
      severity = "CRITICAL";
    } else if (lower.includes("xss") || lower.includes("csrf")) {
      severity = "MEDIUM";
    }

    const title = cwe && cwe !== "N/A" ? cwe : "Security Vulnerability Detected";

    return [{
      title,
      severity,
      cwe: cwe !== "N/A" ? cwe : null,
      description,
      remediation: "Review the code above and sanitize inputs. Check the description for model reasoning.",
      lineStart: null,
      lineEnd: null,
    }];
  } catch (err) {
    console.error(`Error parsing model output for ${filePath}:`, err);
    // Ultimate fallback: Just show the raw text
    return [{
      title: "Unparsed Vulnerability Finding",
      severity: "HIGH",
      cwe: null,
      description: text,
      remediation: "Manual review required.",
      lineStart: null,
      lineEnd: null,
    }];
  }
}