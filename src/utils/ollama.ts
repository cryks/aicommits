import type {
	AssistantResponse,
	CommitParams,
	GeneratedCommitMessages,
} from "./assistant.js";
import { generatePromptJSON } from "./prompt.js";

type Message = {
	role: "user" | "assistant" | "system";
	content: string;
};

export async function generateCommitMessage(
	model: string,
	commit: CommitParams
): Promise<AssistantResponse> {
	const messages: Message[] = [];
	const leading = "{";

	const prompt = generatePromptJSON(commit.diff, commit);

	messages.push({
		role: "system",
		content: prompt.systemPrompt,
	});

	messages.push({
		role: "user",
		content: prompt.userPrompt,
	});

	for (const chat of commit.chats) {
		messages.push({
			role: "assistant",
			content: chat.assistant,
		});
		messages.push({
			role: "user",
			content: chat.prompt,
		});
	}

	messages.push({
		role: "assistant",
		content: leading,
	});

	const resp = await fetch("http://localhost:1234/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			stream: false,
			options: {
				temperature: 0.8,
			},
			messages,
		}),
	});

	const msg = await resp.json();

	const content =
		leading + msg.message.content.trim() + (msg.stop_sequence ?? "");
	try {
		const generated = JSON.parse(content) as GeneratedCommitMessages;
		return {
			rawResponse: content,
			messages: generated.commits,
			assistant: generated.assistant,
		};
	} catch (ex) {
		console.dir(content, { depth: null });
		throw ex;
	}
}
