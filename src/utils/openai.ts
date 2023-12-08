import https from "https";
import type { ClientRequest, IncomingMessage } from "http";
import type {
	ChatCompletionRequestMessageRoleEnum,
	CreateChatCompletionRequest,
	CreateChatCompletionResponse,
} from "openai";
import {
	type TiktokenModel,
	// encoding_for_model,
} from "@dqbd/tiktoken";
import createHttpsProxyAgent from "https-proxy-agent";
import { KnownError } from "./error.js";
import type { CommitType } from "./config.js";
import { generatePrompt } from "./prompt.js";

const httpsPost = async (
	hostname: string,
	path: string,
	headers: Record<string, string>,
	json: unknown,
	timeout: number,
	proxy?: string
) =>
	new Promise<{
		request: ClientRequest;
		response: IncomingMessage;
		data: string;
	}>((resolve, reject) => {
		const postContent = JSON.stringify(json);
		const request = https.request(
			{
				port: 443,
				hostname,
				path,
				method: "POST",
				headers: {
					...headers,
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(postContent),
				},
				timeout,
				agent: proxy ? createHttpsProxyAgent(proxy) : undefined,
			},
			(response) => {
				const body: Buffer[] = [];
				response.on("data", (chunk) => body.push(chunk));
				response.on("end", () => {
					resolve({
						request,
						response,
						data: Buffer.concat(body).toString(),
					});
				});
			}
		);
		request.on("error", reject);
		request.on("timeout", () => {
			request.destroy();
			reject(
				new KnownError(
					`Time out error: request took over ${timeout}ms. Try increasing the \`timeout\` config, or checking the OpenAI API status https://status.openai.com`
				)
			);
		});

		request.write(postContent);
		request.end();
	});

const createChatCompletion = async (
	apiKey: string,
	json: CreateChatCompletionRequest,
	timeout: number,
	proxy?: string
) => {
	const { response, data } = await httpsPost(
		"api.openai.com",
		"/v1/chat/completions",
		{
			Authorization: `Bearer ${apiKey}`,
		},
		json,
		timeout,
		proxy
	);

	if (
		!response.statusCode ||
		response.statusCode < 200 ||
		response.statusCode > 299
	) {
		let errorMessage = `OpenAI API Error: ${response.statusCode} - ${response.statusMessage}`;

		if (data) {
			errorMessage += `\n\n${data}`;
		}

		if (response.statusCode === 500) {
			errorMessage += "\n\nCheck the API status: https://status.openai.com";
		}

		throw new KnownError(errorMessage);
	}

	return JSON.parse(data) as CreateChatCompletionResponse;
};

const sanitizeMessage = (message: string) =>
	message
		.trim()
		//.replace(/[\n\r]/g, "")
		.replace(/(\w)\.$/, "$1");

const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

// const generateStringFromLength = (length: number) => {
// 	let result = '';
// 	const highestTokenChar = 'z';
// 	for (let i = 0; i < length; i += 1) {
// 		result += highestTokenChar;
// 	}
// 	return result;
// };

// const getTokens = (prompt: string, model: TiktokenModel) => {
// 	const encoder = encoding_for_model(model);
// 	const tokens = encoder.encode(prompt).length;
// 	// Free the encoder to avoid possible memory leaks.
// 	encoder.free();
// 	return tokens;
// };

export type Chat = {
	assistant: string;
	prompt: string;
};

export const generateCommitMessage = async (
	apiKey: string,
	model: TiktokenModel,
	locale: string,
	diff: string,
	completions: number,
	maxLength: number,
	type: CommitType,
	timeout: number,
	proxy?: string,
	hint?: string,
	chats?: Chat[],
	requestBody: boolean = false
) => {
	try {
		const messages: {
			role: ChatCompletionRequestMessageRoleEnum;
			content: string;
		}[] = [];
		messages.push({
			role: "system",
			content: generatePrompt(maxLength),
		});
		if (hint) {
			messages.push({
				role: "user",
				content: `Generation Hint: ${hint}`,
			});
		}
		messages.push({
			role: "user",
			content: "diff:\n```\n" + diff + "\n```",
		});

		if (chats) {
			for (const chat of chats) {
				messages.push({
					role: "assistant",
					content: chat.assistant,
				});
				if (chat.prompt) {
					messages.push({
						role: "user",
						content: chat.prompt,
					});
				}
			}
		}

		if (requestBody) {
			messages.push({
				role: "system",
				content: (
					[
						"Next, please generate the body that will be the Conventional Commits Body.",
						"This Body Message does not have the restrictions mentioned earlier.",
						"However, please adhere to the following conditions.",
						"* It must always be written in English.",
						"* Please insert appropriate line breaks. About three lines is desirable.",
						`* The maximum number of characters per line is ${maxLength}.`,
						"* After inserting appropriate line breaks and after the Body Message, please write a brief summary in one line starting with the string `[SUMMARY]`, in *Japanese*.",
						"Example:",
						"  fix: prevent racing of requests",
						"  ",
						"  Introduce a request id and a reference to latest request. Dismiss",
						"  incoming responses other than from latest request.",
						"  ",
						"  Remove timeouts which were used to mitigate the racing issue but are",
						"  obsolete now.",
					] as string[]
				)
					.filter(Boolean)
					.join("\n"),
			});
		}

		const completion = await createChatCompletion(
			apiKey,
			{
				model,
				messages,
				temperature: 0.7,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				max_tokens: 200,
				stream: false,
				n: completions,
			},
			timeout,
			proxy
		);

		return deduplicateMessages(
			completion.choices
				.filter((choice) => choice.message?.content)
				.map((choice) => sanitizeMessage(choice.message!.content))
		);
	} catch (error) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const errorAsAny = error as any;
		if (errorAsAny.code === "ENOTFOUND") {
			throw new KnownError(
				`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall}). Are you connected to the internet?`
			);
		}

		throw errorAsAny;
	}
};
