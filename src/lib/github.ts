// src/lib/github.ts
import { Octokit } from "@octokit/rest";

// Initialize Octokit with your Personal Access Token
const octokit = new Octokit({
  auth: process.env.GITHUB_PAT,
});

export interface FileData {
  path: string;
  content: string;
}

// Ignore files that are compiled, locked, or multimedia
const IGNORED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".lock", ".pdf", ".mp4"];
const IGNORED_DIRS = ["node_modules/", "dist/", "build/", ".git/", "vendor/"];

export async function fetchRepoFiles(repoUrl: string, branch = "main"): Promise<FileData[]> {
  // 1. Parse the URL (e.g., https://github.com/facebook/react)
  const urlParts = repoUrl.replace("https://github.com/", "").split("/");
  const owner = urlParts[0];
  const repo = urlParts[1];

  if (!owner || !repo) {
    throw new Error("Invalid GitHub URL");
  }

  try {
    // 2. Fetch the entire tree recursively for the given branch
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: "true", // Required to get nested folders
    });

    if (treeData.truncated) {
      console.warn("Warning: Repository tree is too large, results may be truncated.");
    }

    // 3. Filter for files (blobs) we actually want to scan
    const validFiles = (treeData.tree || []).filter((item) => {
      if (item.type !== "blob" || !item.path) return false;
      const isIgnoredDir = IGNORED_DIRS.some((dir) => item.path!.includes(dir));
      const isIgnoredExt = IGNORED_EXTENSIONS.some((ext) => item.path!.endsWith(ext));
      return !isIgnoredDir && !isIgnoredExt;
    });

    const fileContents: FileData[] = [];

    // 4. Fetch the raw code for a max of 20 files (to prevent rate limits during development)
    const filesToScan = validFiles.slice(0, 20); 

    for (const file of filesToScan) {
      const { data: blobData } = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: file.sha!,
      });

      // GitHub returns blob content encoded in Base64
      const content = Buffer.from(blobData.content, "base64").toString("utf-8");
      fileContents.push({ path: file.path!, content });
    }

    return fileContents;
  } catch (error) {
    console.error("Error fetching repo files:", error);
    throw new Error("Failed to fetch repository from GitHub.");
  }
}