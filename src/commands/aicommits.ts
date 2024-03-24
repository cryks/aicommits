import {
	//confirm,
	intro,
	isCancel,
	log,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import { execa } from "execa";
import { bgCyan, black, dim, green, red } from "kolorist";
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
	stageAll: boolean,
	commitType: string | undefined,
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

		if (stageAll) {
			// This should be equivalent behavior to `git commit --all`
			await execa("git", ["add", "--update"]);
		}

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

		const { env } = process;
		const config = await getConfig({
			OPENAI_KEY: env.OPENAI_KEY || env.OPENAI_API_KEY,
			proxy:
				env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
			generate: generate?.toString(),
			type: commitType?.toString(),
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
			],
		});
		if (isCancel(aiModel)) {
			outro("Commit cancelled");
			return;
		}

		const generateCommitMessage =
			aiModel.vendor === "anthropic" ? useAnthropic : useOpenAI;

		let hint: string | undefined = undefined;
		const i = await text({
			message: "Enter a hint to help the AI generate a commit message:",
		});
		if (isCancel(i)) {
			outro("Commit cancelled");
			return;
		}
		if (i) hint = i;

		const chats: Chat[] = [];

		const choose = async () => {
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const s = spinner();
				s.start("The AI is analyzing your changes");
				let response: AssistantResponse;
				try {
					response = await generateCommitMessage(aiModel.model, {
						maxLength: config["max-length"],
						diff: staged.diff,
						hint,
						additionalPrompt: promptTitle,
						requestBody: false,
						chats,
						n: config.generate,
						...inferredProjectType,
					});
				} finally {
					s.stop("Changes analyzed");
				}

				const selected = await select({
					maxItems: 15,
					initialValue: "",
					message: `Pick a commit message to use: ${dim("(Ctrl+c to exit)")}`,
					options: [
						{
							label: "🔃 Regenerate",
							hint: "",
							value: "*REGENERATE*",
						},
						...response.messages.map((value) => {
							return {
								label: value.message,
								hint: value.japanese,
								value: value.message,
							};
						}),
						{
							label: "🔃 More Request",
							hint: "",
							value: "*MOREREQ*",
						},
					],
				});

				if (isCancel(selected)) {
					outro("Commit cancelled");
					return;
				}
				if (selected === "*REGENERATE*") {
					continue;
				} else if (selected === "*MOREREQ*") {
					const input = await text({
						message: "Additional requests to the assistant:",
					});
					if (isCancel(input) || !input) {
						outro("Commit cancelled");
						return;
					}

					chats.push({ assistant: response.rawResponse, prompt: input });
					continue;
				}

				return selected;
			}
		};

		let message = await choose();
		if (!message) return;

		{
			const input = await text({
				message: "Enter a commit message:",
				initialValue: message,
			});
			if (isCancel(input)) {
				outro("Commit cancelled");
				return;
			}
			message = input;
		}

		await execa("git", ["commit", "-m", message, ...rawArgv]);

		outro(`${green("✔")} Successfully committed!`);
	})().catch((error) => {
		outro(`${red("✖")} ${error.message}`);
		handleCliError(error);
		process.exit(1);
	});
