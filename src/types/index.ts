// src/types/index.ts
export interface VulnerabilityFinding {
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cwe: string | null;
  description: string;
  remediation: string;
  lineStart: number | null;
  lineEnd: number | null;
}
