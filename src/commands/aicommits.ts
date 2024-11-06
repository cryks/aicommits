import {
	intro,
	isCancel,
	log,
	multiselect,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import { execa } from "execa";
import { bgCyan, black, cyan, dim, green, red } from "kolorist";
import fs from "node:fs";
import path from "node:path";
import type { AssistantResponse, Model } from "../utils/assistant.js";
import { Chat } from "../utils/chat.js";
import { generateCommitMessage as useAnthropic } from "../utils/claude.js";
import { getConfig } from "../utils/config.js";
import { KnownError, handleCliError } from "../utils/error.js";
import {
	assertGitRepo,
	getDetectedMessage,
	getGitDir,
	getGitTopDir,
	getStagedDiff,
	getGitLog,
} from "../utils/git.js";
import { generateCommitMessage as useOpenAI } from "../utils/openai.js";
import { generateCommitMessage as useLocal } from "../utils/ollama.js";

type AIVendor = "anthropic" | "openai" | "local";
type AIModel = Model;
type AIModelVendor = { vendor: AIVendor } & { model: AIModel };

async function inferProjectType() {
	const gitDir = await getGitTopDir();

	const isNuxtProject = ["nuxt.config.js", "nuxt.config.ts"].some((file) =>
		fs.existsSync(path.join(gitDir, file))
	);

	const isGoProject = ["go.mod", "go.sum"].every((file) =>
		fs.existsSync(path.join(gitDir, file))
	);

	return {
		isNuxtProject,
		isGoProject,
	};
}

export default async (
	generate: number | undefined,
	excludeFiles: string[],
	rawArgv: string[]
) =>
	(async () => {
		intro(bgCyan(black(" aicommits ")));
		await assertGitRepo();

		const inferredProjectType = await inferProjectType();
		if (inferredProjectType.isNuxtProject) {
			log.step("🚀 Nuxt.js project");
		}
		if (inferredProjectType.isGoProject) {
			log.step("🐹 Go project");
		}

		const gitDir = await getGitDir();
		const promptTitlePath = path.join(gitDir, "prompt-title");
		let promptTitle: string | undefined = undefined;
		if (fs.existsSync(promptTitlePath)) {
			promptTitle = fs.readFileSync(promptTitlePath, "utf-8").trim();
		}
		if (promptTitle) {
			log.step("📝 Prompt title found");
		}

		const staged = await getStagedDiff(excludeFiles);

		if (!staged) {
			throw new KnownError(
				"No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag."
			);
		}

		const gitLog = await getGitLog();

		log.step(
			`${getDetectedMessage(staged.files)}:\n${staged.files
				.map((file) => `  ${file}`)
				.join("\n")}`
		);

		const config = await getConfig({
			generate: generate?.toString(),
		});

		const aiModel = await select({
			message: "Choose an AI model to use:",
			initialValue: { vendor: "anthropic", model: "high" } as AIModelVendor,
			options: [
				{
					label: "Claude 3.5 Sonnet",
					value: { vendor: "anthropic", model: "high" },
				},
				{
					label: "GPT-4o",
					value: { vendor: "openai", model: "high" },
				},
				{
					label: "o1-preview",
					value: { vendor: "openai", model: "middle" },
				},
				{
					label: "o1-mini",
					value: { vendor: "openai", model: "low" },
				},
				{
					label: "llama3:70b",
					value: { vendor: "local", model: "high" },
				},
				{
					label: "llama3:8b",
					value: { vendor: "local", model: "middle" },
				},
				{
					label: "Claude 3 Opus",
					value: { vendor: "anthropic", model: "middle" },
				},
				{
					label: "Claude 3.5 Haiku",
					value: { vendor: "anthropic", model: "low" },
				},
			],
		});
		if (isCancel(aiModel)) {
			outro("Commit aborted");
			return;
		}

		const generateCommitMessage =
			aiModel.vendor === "anthropic"
				? useAnthropic
				: aiModel.vendor === "openai"
				? useOpenAI
				: useLocal;

		let hint: string | undefined = undefined;
		const i = await text({
			message: "Provide a hint to assist the AI (optional):",
		});
		if (isCancel(i)) {
			outro("Commit aborted");
			return;
		}
		if (i) hint = i;

		const chats: Chat[] = [];

		const choose = async () => {
			let generate = true;
			let response: AssistantResponse | undefined = undefined;
			// eslint-disable-next-line no-constant-condition
			while (true) {
				if (generate) {
					const s = spinner();
					s.start("AI is analyzing your changes...");
					try {
						response = await generateCommitMessage(aiModel.model, {
							maxLength: config["max-length"],
							diff: staged.diff,
							hint,
							gitLog,
							additionalPrompt: promptTitle,
							chats,
							n: config.generate,
							...inferredProjectType,
						});
					} finally {
						s.stop("Analysis complete");
					}
					if (response.assistant) {
						log.step(`${cyan("🤖 AI Assistant:")}\n${response.assistant}`);
					}
				} else {
					generate = true;
				}

				if (!response) {
					throw new KnownError("No response from the AI model");
				}

				const selected = await select({
					maxItems: 15,
					initialValue: "",
					message: `Pick a commit message to use: ${dim("(Ctrl+c to exit)")}`,
					options: [
						{
							label: "🔄 Generate new suggestions",
							hint: "",
							value: "*REGENERATE*",
						},
						...response.messages.map((value) => {
							return {
								label: `[${String(value.score).padStart(2, " ")}] ${
									value.message
								}`,
								hint: value.japanese,
								value: value.message,
							};
						}),
					],
				});

				if (isCancel(selected)) {
					outro("Commit aborted");
					return;
				}

				if (selected === "*REGENERATE*") {
					const c = await multiselect({
						message:
							"Select a prompt to guide the AI in generating new commit message suggestions:",
						initialValues: [] as string[],
						// prettier-ignore
						options: [
							{
								label: `🔄 Generate more suggestions`,
								value: "Generate more commit message suggestions.",
								hint: "さらにコミットメッセージの提案を生成してください。",
							},
							{
								label: `🌟 ${green("Change type to 'feat:'")}`,
								value: "Change the type of the commit message to 'feat:'.",
								hint: "コミットメッセージのタイプを 'feat:' に変更してください。",
							},
							{
								label: `🐛 ${green("Change type to 'fix:'")}`,
								value: "Change the type of the commit message to 'fix:'.",
								hint: "コミットメッセージのタイプを 'fix:' に変更してください。",
							},
							{
								label: `💅 ${green("Change type to 'style:'")}`,
								value: "Change the type of the commit message to 'style:'.",
								hint: "コミットメッセージのタイプを 'style:' に変更してください。",
							},
							{
								label: `📚 ${green("Change type to 'docs:'")}`,
								value: "Change the type of the commit message to 'docs:'.",
								hint: "コミットメッセージのタイプを 'docs:' に変更してください。",
							},
							{
								label: `🔧 ${green("Change type to 'chore:'")}`,
								value: "Change the type of the commit message to 'chore:'.",
								hint: "コミットメッセージのタイプを 'chore:' に変更してください。",
							},
							{
								label: `🎯 ${green("Change scope")}`,
								value: "Change the scope of the commit message.",
								hint: "コミットメッセージのスコープを変更してください。",
							},
							{
								label: `🚫 ${red("Remove scope")}`,
								value: "Remove the scope from the commit message.",
								hint: "コミットメッセージからスコープを削除してください。",
							},
							{
								label: `🤖 ${red("Remove 'in/on <filename>' expressions from the commit message.")}`,
								value: "Remove 'in/on <filename>' expressions from the commit message.",
								hint: "コミットメッセージから 'in/on <ファイル名>' という表現を削除してください。",
							},
							{
								label: `🤖 ${cyan("Replace vague expressions like 'better readability' with more specific descriptions.")}`,
								value: "Replace vague expressions like 'better readability' with more specific descriptions.",
								hint: "'better readability' のようなあいまいな表現を、より具体的な説明に置き換えてください。",
							},
							{
								label: `🤖 ${cyan("Highlight the benefits and purpose of the changes in the commit messages.")}`,
								value: "Highlight the benefits and purpose of the changes in the commit messages.",
								hint: "コミットメッセージで、変更の利点と目的を強調してください。",
							},
							{
								label: `💬 Add extra context`,
								value: "*MOREREQ*",
								hint: "AIを導くための追加のコンテキストを入力します。",
							},
						],
					});

					if (isCancel(c)) {
						generate = false;
						continue;
					}

					const reqIndex = c.findIndex((x) => x === "*MOREREQ*");
					if (reqIndex !== -1) {
						const input = await text({
							message: "Enter extra context to guide the AI:",
						});
						if (isCancel(input) || !input) {
							generate = false;
							continue;
						}
						c[reqIndex] = input;
					}
					chats.push({
						assistant: response.rawResponse,
						prompt: c.join("\n\n"),
					});
					continue;
				}

				return selected;
			}
		};

		let message = await choose();
		if (!message) return;

		{
			const input = await text({
				message: "Enter the desired commit message:",
				initialValue: message,
			});
			if (isCancel(input)) {
				outro("Commit aborted");
				return;
			}
			message = input;
		}

		await execa("git", ["commit", "-m", message, ...rawArgv]);

		outro(`${green("✔")} Commit successful!`);
	})().catch((error) => {
		outro(`${red("✖")} ${error.message}`);
		handleCliError(error);
		process.exit(1);
	});
