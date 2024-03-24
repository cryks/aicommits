import type { Chat } from "./chat.js";

export type Model = "high" | "middle" | "low";

export type CommitParams = {
	maxLength: number;
	diff: string;
	hint?: string;
	additionalPrompt?: string;
	requestBody: boolean;
	chats: Chat[];
	n: number;
	isNuxtProject: boolean;
};

export type GeneratedCommitMessages = {
	commits: {
		message: string;
		japanese: string;
	}[];
};

export type CommitMessage = {
	message: string;
	japanese: string;
};

export type AssistantResponse = {
	rawResponse: string;
	messages: CommitMessage[];
};
