import { NextResponse } from "next/server";
import { fetchRepoFiles } from "@/lib/github";
import { analyzeCode } from "@/lib/hf-client";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoUrl, branch = "main" } = body;

    if (!repoUrl) {
      return NextResponse.json(
        { error: "repoUrl is required" },
        { status: 400 },
      );
    }

    // 1. Create a "PENDING" scan record in the database
    const scanRecord = await prisma.scan.create({
      data: {
        repoUrl,
        branch,
        source: "DASHBOARD_PULL",
        status: "PENDING",
      },
    });

    // 2. Fetch files from GitHub
    let files;
    try {
      files = await fetchRepoFiles(repoUrl, branch);
    } catch (error) {
      await prisma.scan.update({
        where: { id: scanRecord.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "Failed to pull from GitHub" },
        { status: 500 },
      );
    }

    await prisma.scan.update({
      where: { id: scanRecord.id },
      data: { totalFiles: files.length },
    });

    // 3. Scan files one by one with DeepSeek-R1
    let totalVulnerabilities = 0;

    for (const file of files) {
      // Small optimization: skip scanning very small files
      if (file.content.length < 10) continue;

      const findings = await analyzeCode(file.path, file.content);

      // Save valid findings to the database
      if (findings && findings.length > 0) {
        totalVulnerabilities += findings.length;

        for (const finding of findings) {
          await prisma.vulnerability.create({
            data: {
              scanId: scanRecord.id,
              filePath: file.path,
              lineStart: finding.lineStart || null,
              lineEnd: finding.lineEnd || null,
              title: finding.title,
              severity: finding.severity,
              cwe: finding.cwe || null,
              description: finding.description,
              remediation: finding.remediation,
              rawCode: file.content, // Save code snippet for dashboard highlight
            },
          });
        }
      }
    }

    // 4. Mark scan as Complete
    const completedScan = await prisma.scan.update({
      where: { id: scanRecord.id },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({
      message: "Scan completed",
      scanId: completedScan.id,
      filesScanned: files.length,
      vulnerabilitiesFound: totalVulnerabilities,
    });
  } catch (error) {
    console.error("Critical Scanner Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
