// src/features/gemini/gemini.service.js
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GEMINI_API_KEY } = require("../../config/env");

let model = null;

function initGemini() {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY missing. Gemini Service will fail.");
    return;
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          is_valid: { type: SchemaType.BOOLEAN },
          reason: { type: SchemaType.STRING },
          normalized_word: { type: SchemaType.STRING },
          violations: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["is_valid", "reason", "normalized_word"],
      },
    },
  });
}

/**
 * Validate Word Pair
 * @param {string} lastWord
 * @param {string} newWord
 * @param {string[]} usedWords
 * @returns {Promise<object>} JSON response
 */
async function validateWord(lastWord, newWord, usedWords = []) {
  if (!model) initGemini();
  if (!model) {
    throw new Error("Gemini API Key failed to initialize.");
  }

  const prompt = `
Context: Vietnamese Word Chain Game (Nối từ).
Rules:
1. "newWord" must be a valid, meaningful Vietnamese word (1-4 syllables).
2. "newWord" must NOT be in the "usedWords" list.
3. If "lastWord" is provided (not null/empty), "newWord" MUST start with the last syllable of "lastWord".
   - Comparison should be case-insensitive.
   - Match full syllable with tone.
4. "newWord" must be found in dictionary or common usage. NO nonsense words.

Inputs:
- lastWord: "${lastWord || ""}"
- newWord: "${newWord}"
- usedWords: ${JSON.stringify(usedWords)}

Task: Evaluate "newWord" validity.
Return JSON.
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Gemini Validation Error:", error);
    // Log the actual response text if possible for debugging (not easy here since error is thrown)
    throw error;
  }
}

module.exports = { validateWord };
