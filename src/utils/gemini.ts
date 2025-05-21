import { Content, GoogleGenAI } from "@google/genai";
import type {
	AssistantResponse,
	CommitParams,
	GeneratedCommitMessages,
} from "./assistant.js";
import { generatePromptJSON } from "./prompt.js";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateCommitMessage(
	model: string,
	commit: CommitParams
): Promise<AssistantResponse> {
	const prompt = generatePromptJSON(commit.diff, commit);

	const history: Content[] = [];

	history.push({ role: "user", parts: [{ text: prompt.systemPrompt + "\n\n" + prompt.userPrompt }] });

	for (const chat of commit.chats) {
		history.push({ role: "model", parts: [{ text: chat.assistant }] });
		history.push({ role: "user", parts: [{ text: chat.prompt }] });
	}

	const result = await genAI.models.generateContent({
		model,
		config: {
			temperature: 0,
			responseMimeType: "application/json",
		},
		contents: history,
	});

	const jsonText = result.text;
	if (!jsonText) {
		throw new Error("No response from Gemini");
	}

	try {
		const generated = JSON.parse(jsonText) as GeneratedCommitMessages;
		return {
			rawResponse: jsonText,
			messages: generated.commits,
			assistant: generated.assistant,
		};
	} catch (ex) {
		console.dir(jsonText, { depth: null });
		throw ex;
	}
}
