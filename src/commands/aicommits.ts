import {
	intro,
	isCancel,
	log,
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
} from "../utils/git.js";
import { generateCommitMessage as useOpenAI } from "../utils/openai.js";

type AIVendor = "anthropic" | "openai";
type AIModel = Model;
type AIModelVendor = { vendor: AIVendor } & { model: AIModel };

async function inferProjectType() {
	const gitDir = await getGitTopDir();

	const isNuxtProject = ["nuxt.config.js", "nuxt.config.ts"].some((file) =>
		fs.existsSync(path.join(gitDir, file))
	);

	return {
		isNuxtProject,
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

		const gitDir = await getGitDir();
		const promptTitlePath = path.join(gitDir, "prompt-title");
		const promptBodyPath = path.join(gitDir, "prompt-body");
		let promptTitle: string | undefined = undefined;
		let promptBody: string | undefined = undefined;
		if (fs.existsSync(promptTitlePath)) {
			promptTitle = fs.readFileSync(promptTitlePath, "utf-8").trim();
		}
		if (fs.existsSync(promptBodyPath)) {
			promptBody = fs.readFileSync(promptBodyPath, "utf-8").trim();
		}
		if (promptTitle) {
			log.step("📝 Prompt title found");
		}
		if (promptBody) {
			log.step("🔍 Prompt body found");
		}

		const detectingFiles = spinner();

		detectingFiles.start("Detecting staged files");
		const staged = await getStagedDiff(excludeFiles);

		if (!staged) {
			detectingFiles.stop("Detecting staged files");
			throw new KnownError(
				"No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag."
			);
		}

		detectingFiles.stop(
			`${getDetectedMessage(staged.files)}:\n${staged.files
				.map((file) => `     ${file}`)
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
					label: "Claude 3 Opus",
					value: { vendor: "anthropic", model: "high" },
				},
				{
					label: "GPT-4 Turbo",
					value: { vendor: "openai", model: "high" },
				},
				{
					label: "Claude 3 Sonnet",
					value: { vendor: "anthropic", model: "middle" },
				},
				{
					label: "Claude 3 Haiku",
					value: { vendor: "anthropic", model: "low" },
				},
			],
		});
		if (isCancel(aiModel)) {
			outro("Commit aborted");
			return;
		}

		const generateCommitMessage =
			aiModel.vendor === "anthropic" ? useAnthropic : useOpenAI;

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
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const s = spinner();
				s.start("AI is analyzing your changes...");
				let response: AssistantResponse;
				try {
					response = await generateCommitMessage(aiModel.model, {
						maxLength: config["max-length"],
						diff: staged.diff,
						hint,
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

				const selected = await select({
					maxItems: 15,
					initialValue: "",
					message: `Pick a commit message to use: ${dim("(Ctrl+c to exit)")}`,
					options: [
						{
							label: "🔄 Generate New Suggestions",
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
					const c = await select({
						message:
							"Select a prompt to guide the AI in generating new commit message suggestions:",
						initialValue: "",
						// prettier-ignore
						options: [
							{
								label: `🔄 Generate more suggestions`,
								value: "Generate more commit message suggestions.",
								hint: "さらにコミットメッセージの提案を生成してください。",
							},
							{
								label: `🔀 ${green("Change type")}`,
								value: "Change the type of the commit message.",
								hint: "コミットメッセージのタイプを変更してください。",
							},
							{
								label: `🎯 ${green("Change scope")}`,
								value: "Change the scope of the commit message.",
								hint: "コミットメッセージのスコープを変更してください。",
							},
							{
								label: `🤖 ${cyan("Highlight the benefits and purpose of the changes in the commit messages.")}`,
								value: "Highlight the benefits and purpose of the changes in the commit messages.",
								hint: "コミットメッセージで、変更の利点と目的を強調してください。",
							},
							{
								label: `🤖 ${cyan("Take a different approach in generating the commit messages.")}`,
								value: "Take a different approach in generating the commit messages.",
								hint: "コミットメッセージの生成において、別のアプローチを取ってください。",
							},
							{
								label: `💬 Add extra context`,
								value: "*MOREREQ*",
								hint: "AIを導くための追加のコンテキストを入力します。",
							},
						],
					});

					if (isCancel(c)) {
						outro("Commit aborted");
						return;
					}

					if (c === "*MOREREQ*") {
						const input = await text({
							message: "Enter extra context to guide the AI:",
						});
						if (isCancel(input) || !input) {
							outro("Commit aborted");
							return;
						}
						chats.push({ assistant: response.rawResponse, prompt: input });
					} else {
						chats.push({ assistant: response.rawResponse, prompt: c });
					}
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
