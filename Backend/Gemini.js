const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
    console.warn("Warning: GEMINI_API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

module.exports = ai;
