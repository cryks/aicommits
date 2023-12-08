export const generatePrompt = (maxLength: number) =>
	[
		"Generate a concise git commit message written in present tense for the following code diff with the given specifications below, aiming for the best result you can think of:",
		"* It must always be written in English.",
		`* Commit message must be a maximum of ${maxLength} characters.`,
		"* Please do not use words like 'Refactor' or 'Update'.",
		"* Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit.",
		"* Please do not output code blocks such as '```'.",
		"* Please follow the Conventional Commits format for commit messages.",
		"  * When bumping a module, please set scope: `build(deps)`.",
		"  * It's unnecessary to include 'in ...' in the commit message. Instead, please include it in the scope of Conventional Commits.",
		"    * For example, `feat: add ... in Dockerfile` should be `feat(Dockerfile): add ...`.",
		"    * For example, `fix(utils): fix typo in foobar.ts` should be `fix(utils/foobar): fix typo`.",
		"  * Please do not include file extensions in the scope.",
		"    * For example, use `feat(index): add ...` instead of `feat(index.ts): add ...`.",
		"Please generate the best commit message that has the above features and that you wouldn't be embarrassed to show to anyone. Thank you in advance.",
	]
		.filter(Boolean)
		.join("\n");

export const generatePromptForBody = (maxLength: number) =>
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
	]
		.filter(Boolean)
		.join("\n");
