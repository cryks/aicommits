import {
	confirm,
	intro,
	isCancel,
	outro,
	select,
	spinner,
	text,
	log,
} from "@clack/prompts";
import { execa } from "execa";
import { bgCyan, black, dim, green, red } from "kolorist";
import { getConfig } from "../utils/config.js";
import { KnownError, handleCliError } from "../utils/error.js";
import {
	assertGitRepo,
	getDetectedMessage,
	getGitDir,
	getStagedDiff,
} from "../utils/git.js";
import { Chat, generateCommitMessage } from "../utils/openai.js";
import path from "node:path";
import fs from "node:fs";

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
		if (promptTitle || promptBody) {
			log.step(
				`Detected additional prompt file${
					promptTitle && promptBody ? "s" : ""
				}:\n` +
					[promptTitle ? "title" : "", promptBody ? "body" : ""]
						.filter(Boolean)
						.map((x) => `  * ${x}`)
						.join("\n")
			);
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
			const s = spinner();
			s.start("The AI is analyzing your changes");
			let messages: string[];
			try {
				messages = await generateCommitMessage(
					config.OPENAI_KEY,
					config.model,
					config.locale,
					staged.diff,
					config.generate,
					config["max-length"],
					config.type,
					config.timeout,
					config.proxy,
					hint,
					chats,
					false,
					promptTitle
				);
			} finally {
				s.stop("Changes analyzed");
			}

			if (messages.length === 0) {
				throw new KnownError("No commit messages were generated. Try again.");
			}

			const selected = await select({
				maxItems: 10,
				initialValue: "",
				message: `Pick a commit message to use: ${dim("(Ctrl+c to exit)")}`,
				options: messages.map((value) => {
					const line = value.split("\n");
					return {
						label: line[0],
						hint: line[1],
						value: line[0],
					};
				}),
			});

			if (isCancel(selected)) {
				outro("Commit cancelled");
				return;
			}

			chats.push({ assistant: selected, prompt: "" });
			return selected;
		};

		let message = await choose();
		if (!message) return;

		for (;;) {
			const input = await text({
				message: "Additional requests to the assistant:",
			});
			if (isCancel(input)) {
				outro("Commit cancelled");
				return;
			}
			if (!input) break;

			chats[chats.length - 1].prompt = input;
			message = await choose();
			if (!message) return;
		}

		let body = "";
		{
			const confirmed = await confirm({
				initialValue: false,
				message: "Do you want to add a body?",
			});
			if (isCancel(confirmed)) {
				outro("Commit cancelled");
				return;
			}

			if (confirmed) {
				const s = spinner();
				s.start("The AI is analyzing your changes");
				let messages: string[];
				try {
					messages = await generateCommitMessage(
						config.OPENAI_KEY,
						config.model,
						config.locale,
						staged.diff,
						5,
						config["max-length"],
						config.type,
						config.timeout,
						config.proxy,
						hint,
						chats,
						true,
						promptBody
					);
				} finally {
					s.stop("Changes analyzed");
				}

				const selected = await select({
					message: `Pick a commit body to use: ${dim("(Ctrl+c to exit)")}`,
					maxItems: 10,
					initialValue: 0,
					options: messages.map((value, i) => {
						let msg = "";
						let summary = "";
						for (const line of value.split("\n")) {
							if (line.startsWith("[SUMMARY]")) {
								summary = line.replace("[SUMMARY]", "").trim();
							} else {
								msg += line + "\n";
							}
						}
						return {
							label: `#${i + 1}:\n${msg.trim()}\n => ${summary}`,
							value: i,
						};
					}),
				});
				if (isCancel(selected)) {
					outro("Commit cancelled");
					return;
				}
				for (const line of messages[selected].split("\n")) {
					if (line.startsWith("[SUMMARY]")) continue;
					body += line + "\n";
				}
			}
		}

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

		if (body) {
			message += `\n\n${body.trim()}`;
		}

		await execa("git", ["commit", "-m", message, ...rawArgv]);

		outro(`${green("✔")} Successfully committed!`);
	})().catch((error) => {
		outro(`${red("✖")} ${error.message}`);
		handleCliError(error);
		process.exit(1);
	});
