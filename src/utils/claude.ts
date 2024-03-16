import Anthropic from "@anthropic-ai/sdk";
import type { Chat } from "./chat.js";
import { generatePromptForClaude } from "./prompt.js";
import xml2js from "xml2js";

const anthropic = new Anthropic({
	apiKey: process.env.CLAUDE_API_KEY,
});

export type CommitParams = {
	maxLength: number;
	diff: string;
	hint?: string;
	additionalPrompt?: string;
	requestBody: boolean;
	chats: Chat[];
};

type Message = {
	commits: {
		commit: {
			message: string[];
			japanese: string[];
		}[];
	};
};

export type CommitMessage = {
	message: string;
	japanese: string;
};

export async function generateCommitMessage(commit: CommitParams) {
	const messages: Anthropic.Messages.MessageParam[] = [];
	const leading = "<commits><commit><message>";

	const prompt = generatePromptForClaude(commit.diff, {
		maxLength: commit.maxLength,
		hint: commit.hint,
		n: 10,
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

	const msg = await anthropic.messages.create({
		model: "claude-3-opus-20240229",
		max_tokens: 2048,
		system: prompt.systemPrompt,
		messages,
	});

	const contents = msg.content.map((x) => x.text);
	const xml = leading + contents[0].trim();
	try {
		const json: Message = await xml2js.parseStringPromise(xml);
		const result = json.commits.commit.map(
			(x): CommitMessage => ({
				message: x.message[0],
				japanese: x.japanese[0],
			})
		);

		return result;
	} catch (ex) {
		console.dir(xml, { depth: null });
		throw ex;
	}
}
