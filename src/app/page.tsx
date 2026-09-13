import { prisma } from "@/lib/db";
import { RepoForm } from "@/components/repo-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function DashboardPage() {
  // Fetch the 10 most recent scans from SQLite
  const recentScans = await prisma.scan.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      _count: { select: { vulnerabilities: true } },
    },
  });

  return (
    <main className="container mx-auto p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8 tracking-tight">
        Vulnerability Scanner Dashboard
      </h1>

      <RepoForm />

      <h2 className="text-xl font-semibold mb-4">Recent Scans</h2>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repository</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Files Scanned</TableHead>
              <TableHead>Vulnerabilities</TableHead>
              <TableHead>Date</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentScans.map((scan) => (
              <TableRow key={scan.id}>
                <TableCell className="font-medium">
                  {scan.repoUrl.replace("https://github.com/", "")}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      scan.status === "COMPLETED" ? "default" : "secondary"
                    }
                  >
                    {scan.status}
                  </Badge>
                </TableCell>
                <TableCell>{scan.totalFiles}</TableCell>
                <TableCell>
                  {scan._count.vulnerabilities > 0 ? (
                    <Badge variant="destructive">
                      {scan._count.vulnerabilities} Found
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(scan.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/scans/${scan.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Results &rarr;
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {recentScans.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-6 text-muted-foreground"
                >
                  No scans yet. Trigger one above!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
