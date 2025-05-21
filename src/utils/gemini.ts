import { Content, GoogleGenerativeAI } from "@google/generative-ai";
import type {
	AssistantResponse,
	CommitParams,
	GeneratedCommitMessages,
} from "./assistant.js";
import { generatePromptJSON } from "./prompt.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateCommitMessage(
	model: string,
	commit: CommitParams
): Promise<AssistantResponse> {
	const prompt = generatePromptJSON(commit.diff, commit);

	const geminiModel = genAI.getGenerativeModel({
		model,
		generationConfig: {
			temperature: 0,
			responseMimeType: "application/json",
		}
	});

	const history: Content[] = [];

	history.push({ role: "user", parts: [{ text: prompt.systemPrompt + "\n\n" + prompt.userPrompt }] });

	for (const chat of commit.chats) {
		history.push({ role: "model", parts: [{ text: chat.assistant }] });
		history.push({ role: "user", parts: [{ text: chat.prompt }] });
	}

	const chat = geminiModel.startChat({
		history,
	});

	const result = await chat.sendMessage("");
	const text = result.response.text();

	const jsonText = text;

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
