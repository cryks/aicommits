import OpenAI from "openai";
import type {
	AssistantResponse,
	CommitParams,
	GeneratedCommitMessages,
	Model,
} from "./assistant.js";
import { generatePromptJSON } from "./prompt.js";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCommitMessage(
	model: Model,
	commit: CommitParams
): Promise<AssistantResponse> {
	const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
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

	const msg = await openai.chat.completions.create({
		model:
			model === "high"
				? "gpt-4o"
				: model === "middle"
				? "gpt-4-turbo"
				: "gpt-3.5-turbo",
		messages,
		//n: commit.n,
		max_tokens: 1000,
		temperature: 0,
		response_format: {
			type: "json_object",
		},
	});

	const contents = msg.choices
		.map((x) => x.message.content)
		.filter((x): x is string => !!x);

	try {
		const generated = contents.map(
			(x) => JSON.parse(x) as GeneratedCommitMessages
		);
		return {
			rawResponse: contents[0],
			messages: generated.flatMap((x) => x.commits),
			assistant: generated[0].assistant,
		};
	} catch (ex) {
		console.dir(contents, { depth: null });
		throw ex;
	}
}
