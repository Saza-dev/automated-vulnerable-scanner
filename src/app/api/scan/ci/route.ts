// src/app/api/scan/ci/route.ts
import { NextResponse } from "next/server";
import { analyzeCode } from "@/lib/hf-client";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the request using the secret key
    const authHeader = request.headers.get("Authorization");
    const expectedToken = `Bearer ${process.env.CI_SECRET_KEY}`;

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repoUrl, branch, prNumber, files } = body;

    if (!files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: "Invalid payload: 'files' array is required." },
        { status: 400 },
      );
    }

    // 2. Create a scan record so it shows up on your dashboard
    const scanRecord = await prisma.scan.create({
      data: {
        repoUrl: repoUrl || "Unknown CI Repo",
        branch: branch || `PR-${prNumber}`,
        source: "GITHUB_ACTION",
        status: "PENDING",
        totalFiles: files.length,
      },
    });

    // 3. Scan the incoming files
    const allFindings: any[] = [];

    for (const file of files) {
      if (file.content.length < 10) continue;

      const findings = await analyzeCode(file.path, file.content);

      if (findings && findings.length > 0) {
        allFindings.push({ file: file.path, findings });

        // Save to DB for the dashboard view
        for (const finding of findings) {
          await prisma.vulnerability.create({
            data: {
              scanId: scanRecord.id,
              filePath: file.path,
              title: finding.title,
              severity: finding.severity,
              cwe: finding.cwe || null,
              description: finding.description,
              remediation: finding.remediation,
              rawCode: file.content,
            },
          });
        }
      }
    }

    // 4. Update scan status
    await prisma.scan.update({
      where: { id: scanRecord.id },
      data: { status: "COMPLETED" },
    });

    // 5. Return the findings directly back to GitHub Actions
    return NextResponse.json({
      message: "CI Scan complete",
      scanId: scanRecord.id,
      vulnerabilitiesFound: allFindings.length,
      details: allFindings,
    });
  } catch (error) {
    console.error("CI Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
