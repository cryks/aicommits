export const generatePrompt = (maxLength: number, additionalPrompt?: string) =>
	[
		"Generate a concise git commit message written in present tense for the following code diff with the given specifications below, aiming for the best result you can think of:",
		"* It must always be written in English.",
		"  * Please add the translation of the generated description in Japanese to the second line.",
		"    * Only the description should be translated. Please do not translate the type or scope.",
		"* For the description generated in English, it is absolutely essential to write in a single line.",
		`* Commit message must be a maximum of ${maxLength} characters.`,
		"* You should not use words like 'Refactor' or 'Update'.",
		"* Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit.",
		"* You should not output code blocks such as '```'.",
		"* You must describe what will happen as a result of the changes, not the specific changes themselves.",
		"* You should follow the Conventional Commits format for commit messages.",
		"  * If the scope spans multiple areas, or there are multiple types, you should consolidate them into one type and scope.",
		"  * When bumping a module, you should set scope: `build(deps)`.",
		"  * You should use the `refactor` type for trivial corrections in the source code that do not affect operation, such as changing variable names, adjusting indents, swapping lines, etc.",
		"  * It's unnecessary to include 'in ...' in the commit message. Instead, you should include it in the scope of Conventional Commits.",
		"    * For example, `build: add ... in Dockerfile` should be `build(Dockerfile): add ...`.",
		"    * For example, `fix(utils): fix typo in foobar.ts` should be `fix(utils/foobar): fix typo`.",
		"  * You should not include file extensions in the scope.",
		"    * For example, use `feat(index): add ...` instead of `feat(index.ts): add ...`.",
		additionalPrompt,
		"",
		"Please generate the best commit message that has the above features. Take your time to revise and refine your message until you are confident it's the best expression you can produce. You should not be embarrassed to show this to anyone. Thank you in advance.",
	]
		.filter((v) => v !== undefined)
		.join("\n");

export const generatePromptForBody = (
	maxLength: number,
	additionalPrompt?: string
) =>
	[
		"Next, please generate the body that will be the Conventional Commits Body.",
		"This Body Message does not have the restrictions mentioned earlier.",
		"However, you should adhere to the following conditions:",
		"* It must always be written in English.",
		"* You should insert appropriate line breaks. About three lines is desirable.",
		`* The maximum number of characters per line should be ${maxLength}.`,
		"* After inserting appropriate line breaks and after the Body Message, you should write a brief summary in one line starting with the string `[SUMMARY]`, in *Japanese*.",
		"  * This summary line is not used as a Body Message, so it doesn't matter how long it gets or if it exceeds the maximum number of characters per line.",
		additionalPrompt,
		"",
		"Example (The 'fix:' line is a sample commit message and should not be included in the body message):",
		"  fix: prevent racing of requests",
		"  ",
		"  Introduce a request id and a reference to latest request. Dismiss",
		"  incoming responses other than from latest request.",
		"  ",
		"  Remove timeouts which were used to mitigate the racing issue but are",
		"  obsolete now.",
	]
		.filter((v) => v !== undefined)
		.join("\n");
