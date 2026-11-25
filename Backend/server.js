const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const cosineSimilarity = require("./cosine");
const ai = require("./Gemini");
const { generateEmbeddings, generateQueryEmbedding } = require("./Embeddings");

let repositoryEmbeddings = [];

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ==============================
// Health Check Route
// ==============================
app.get("/api/health", async (req, res) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: "Say Connected"
        });

        return res.json({
            success: true,
            message: response.text
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==============================
// Repository Route
// ==============================
app.post("/api/repositories", async (req, res) => {
    const { repoUrl } = req.body;

    if (!repoUrl) {
        return res.status(400).json({
            success: false,
            message: "Repository URL is required"
        });
    }

    const match = repoUrl.match(
        /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?(?:[?#].*)?$/
    );

    if (!match) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid GitHub repository URL."
        });
    }

    const owner = match[1];
    const repo = match[2];

    try {
        const githubHeaders = {
            "Accept": "application/vnd.github+json",
            ...(process.env.GITHUB_TOKEN && {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
            })
        };

        const githubResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            { headers: githubHeaders }
        );

        if (!githubResponse.ok) {
            if (githubResponse.status === 404) {
                return res.status(404).json({
                    success: false,
                    message: "Repository not found or repository is private."
                });
            }
            if (githubResponse.status === 403) {
                return res.status(403).json({
                    success: false,
                    message: "GitHub API rate limit exceeded."
                });
            }
            throw new Error("GitHub API request failed");
        }

        const repoData = await githubResponse.json();

        const treeResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`,
            { headers: githubHeaders }
        );

        if (!treeResponse.ok) {
            throw new Error("Unable to fetch repository tree");
        }

        const treeData = await treeResponse.json();
        const allFiles = treeData.tree;

        const ignoredFolders = [
            "node_modules/",
            ".git/",
            "dist/",
            "build/",
            ".next/",
            "coverage/"
        ];

        const allowedExtensions = [
            ".js", ".jsx", ".ts", ".tsx",
            ".java", ".py", ".html", ".css", ".json", ".md"
        ];

        const usefulFiles = allFiles.filter(file => {
            if (file.type !== "blob") return false;
            const path = file.path.toLowerCase();
            if (ignoredFolders.some(folder => path.startsWith(folder))) {
                return false;
            }
            return allowedExtensions.some(ext => path.endsWith(ext));
        });

        const filesToProcess = usefulFiles.slice(0, 20);
        const repositoryDocuments = [];
        const repositoryChunks = [];

        for (const file of filesToProcess) {
            const fileResponse = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
                { headers: githubHeaders }
            );

            if (!fileResponse.ok) continue;

            const fileData = await fileResponse.json();
            if (!fileData.content) continue;

            const decodedContent = Buffer.from(
                fileData.content,
                "base64"
            ).toString("utf8");

            repositoryDocuments.push({
                path: file.path,
                content: decodedContent
            });

            const chunkSize = 800;
            for (let i = 0; i < decodedContent.length; i += chunkSize) {
                const slice = decodedContent.slice(i, i + chunkSize).trim();
                if (slice) {
                    repositoryChunks.push({
                        path: file.path,
                        content: slice
                    });
                }
            }
        }

        repositoryEmbeddings = await generateEmbeddings(repositoryChunks);

        return res.status(200).json({
            success: true,
            repository: {
                name: repoData.name,
                fullName: repoData.full_name,
                description: repoData.description,
                owner: repoData.owner.login,
                language: repoData.language,
                stars: repoData.stargazers_count,
                forks: repoData.forks_count,
                defaultBranch: repoData.default_branch,
                githubUrl: repoData.html_url
            },
            totalFiles: allFiles.length,
            usefulFiles: usefulFiles.length,
            documents: repositoryDocuments.length,
            chunks: repositoryChunks.length,
            embeddings: repositoryEmbeddings.length,
            indexedChunks: repositoryEmbeddings
        });
    } catch (error) {
        console.error("Repository Analysis Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==============================
// Chat Route
// ==============================
app.post("/api/chat", async (req, res) => {
    try {
        const {
            question,
            history = [],
            indexedChunks = []
        } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                message: "Question is required"
            });
        }

        // Use warm in-memory cache if available, otherwise fall back to client-supplied chunks (for Vercel cold starts)
        const activeEmbeddings =
            repositoryEmbeddings.length > 0 ? repositoryEmbeddings : indexedChunks;

        if (!activeEmbeddings || activeEmbeddings.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Analyze a repository first."
            });
        }

        const questionEmbedding = await generateQueryEmbedding(question);

        const scoredChunks = activeEmbeddings.map(chunk => ({
            path: chunk.path,
            content: chunk.content,
            score: cosineSimilarity(questionEmbedding, chunk.embedding)
        }));

        scoredChunks.sort((a, b) => b.score - a.score);
        const topChunks = scoredChunks.slice(0, 5);

        const context = topChunks
            .map(chunk => `FILE: ${chunk.path}\n\n${chunk.content}`)
            .join("\n\n--------------------------\n\n");

        const conversation = history
            .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join("\n\n");

        const prompt = `
You are RepoLens AI, an expert software engineer.

Continue the conversation naturally.

Use the previous conversation when it helps answer follow-up questions like:
- explain more
- give an example
- where is it implemented
- simplify this
- what about that

Only answer using the repository context.

If the answer is not present in the repository context, say:
"I couldn't find this information in the repository."

Previous Conversation:

${conversation || "No previous conversation."}

=============================

Repository Context:

${context}

=============================

Current Question:

${question}
`;

        const aiResponse = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt
        });

        return res.json({
            success: true,
            answer: aiResponse.text,
            chunks: topChunks
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==============================
// Start Server (local dev) & Export App (Vercel serverless)
// ==============================
const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`RepoLens server running on port ${PORT}`);
    });
}

module.exports = app;
