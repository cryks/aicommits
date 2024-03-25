import Anthropic from "@anthropic-ai/sdk";
import type {
	AssistantResponse,
	CommitParams,
	GeneratedCommitMessages,
	Model,
} from "./assistant.js";
import { generatePromptJSON } from "./prompt.js";

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateCommitMessage(
	model: Model,
	commit: CommitParams
): Promise<AssistantResponse> {
	const messages: Anthropic.Messages.MessageParam[] = [];
	const leading = "{";

	const prompt = generatePromptJSON(commit.diff, commit);

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

	const msg = await anthropic.messages.create({
		model:
			model === "high"
				? "claude-3-opus-20240229"
				: model === "middle"
				? "claude-3-sonnet-20240229"
				: "claude-3-haiku-20240307",
		max_tokens: 1000,
		temperature: 0,
		system: prompt.systemPrompt,
		messages,
	});

	const contents = msg.content.map((x) => x.text);
	const content = leading + contents[0].trim() + (msg.stop_sequence ?? "");
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
