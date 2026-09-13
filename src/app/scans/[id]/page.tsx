import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

function getSeverityColor(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "bg-red-700 hover:bg-red-800 text-white";
    case "HIGH":
      return "bg-red-500 hover:bg-red-600 text-white";
    case "MEDIUM":
      return "bg-orange-500 hover:bg-orange-600 text-white";
    case "LOW":
      return "bg-yellow-500 hover:bg-yellow-600 text-black";
    default:
      return "bg-gray-500 text-white";
  }
}

// In Next.js 15, params is treated as a Promise
export default async function ScanResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  const scan = await prisma.scan.findUnique({
    where: { id: resolvedParams.id },
    include: { vulnerabilities: true },
  });

  if (!scan) return notFound();

  return (
    <main className="container mx-auto p-8 max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline mb-2 block"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Scan Results</h1>
          <p className="text-muted-foreground mt-1">Target: {scan.repoUrl}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Status: <Badge>{scan.status}</Badge>
          </p>
          <p className="text-sm font-medium mt-2">
            {scan.totalFiles} files analyzed
          </p>
        </div>
      </div>

      {scan.vulnerabilities.length === 0 ? (
        <Card className="bg-green-50/50 border-green-200">
          <CardContent className="py-10 text-center">
            <h2 className="text-xl font-semibold text-green-700">
              No Vulnerabilities Found!
            </h2>
            <p className="text-green-600/80 mt-2">
              DeepSeek-R1 did not detect any security issues in the scanned
              files.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {scan.vulnerabilities.map((vuln) => (
            <Card key={vuln.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50 border-b pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-3">
                      {vuln.title}
                      <Badge className={getSeverityColor(vuln.severity)}>
                        {vuln.severity}
                      </Badge>
                      {vuln.cwe && <Badge variant="outline">{vuln.cwe}</Badge>}
                    </CardTitle>
                    <p className="text-sm font-mono text-muted-foreground mt-2">
                      File: {vuln.filePath}
                      {vuln.lineStart &&
                        ` (Lines ${vuln.lineStart}-${vuln.lineEnd})`}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 grid gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Description</h4>
                  {/* Markdown Renderer Applied Here */}
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => (
                          <p className="mb-3 last:mb-0" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong
                            className="font-semibold text-foreground"
                            {...props}
                          />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc pl-5 mb-3" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal pl-5 mb-3" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="mb-1" {...props} />
                        ),
                      }}
                    >
                      {vuln.description}
                    </ReactMarkdown>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Remediation</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {vuln.remediation}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
