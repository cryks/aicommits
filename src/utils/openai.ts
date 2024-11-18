import OpenAI from "openai";
import type {
	AssistantResponse,
	CommitParams,
	GeneratedCommitMessages,
} from "./assistant.js";
import { generatePromptJSON } from "./prompt.js";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCommitMessage(
	model: string,
	commit: CommitParams
): Promise<AssistantResponse> {
	const systemRole = model !== "gpt-4o" ? "user" : "system";

	const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
	const leading = "{";

	const prompt = generatePromptJSON(commit.diff, commit);

	messages.push({
		role: systemRole,
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
		model,
		messages,
		//n: commit.n,
		...(model !== "gpt-4o" ? {
		} : {
			max_tokens: 1000,
			temperature: 0,
			response_format: {
				type: "json_object",
			},
		}),
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
