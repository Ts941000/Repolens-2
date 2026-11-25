const ai = require("./Gemini");

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 50;

function normalizeVector(values) {
    let sumSq = 0;
    for (let i = 0; i < values.length; i++) {
        sumSq += values[i] * values[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0) return values;
    return values.map(v => Number((v / norm).toFixed(5)));
}

async function generateEmbeddings(chunks) {
    if (!chunks || chunks.length === 0) return [];

    console.time("Embedding Time");
    const results = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const response = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: batch.map(chunk => chunk.content),
            config: {
                taskType: "RETRIEVAL_DOCUMENT",
                outputDimensionality: EMBEDDING_DIMENSIONS
            }
        });

        if (!response.embeddings || response.embeddings.length !== batch.length) {
            throw new Error("Failed to generate embeddings from Gemini API");
        }

        batch.forEach((chunk, index) => {
            results.push({
                path: chunk.path,
                content: chunk.content,
                embedding: normalizeVector(response.embeddings[index].values)
            });
        });
    }

    console.timeEnd("Embedding Time");
    return results;
}

async function generateQueryEmbedding(question) {
    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: question,
        config: {
            taskType: "CODE_RETRIEVAL_QUERY",
            outputDimensionality: EMBEDDING_DIMENSIONS
        }
    });

    if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
        throw new Error("Failed to generate query embedding from Gemini API");
    }

    return normalizeVector(response.embeddings[0].values);
}

module.exports = {
    generateEmbeddings,
    generateQueryEmbedding
};
