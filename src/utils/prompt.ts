type PromptConfig = {
	maxLength: number;
	hint?: string;
	n: number;
};

export const generatePrompt = (maxLength: number, additionalPrompt?: string) =>
	[
		"Generate a concise git commit message written in present tense for the following code diff with the given specifications below, aiming for the best result you can think of:",
		"* It must always be written in English.",
		"  * Please write the Japanese version of the commit description on the second line.",
		"    * Only the description should be translated. DO NOT translate the type or scope.",
		"    * This translation is not about translating generated English into Japanese, but explaining the meaning of the original commit in Japanese.",
		"* For the description generated in English, it is absolutely essential to write in a single line.",
		`* Commit message must be a maximum of ${maxLength} characters.`,
		"* You should not use words like 'Refactor' or 'Update'.",
		"* You should not use words like 'ensure', 'streamline', 'centralize', 'enhance', 'improve', 'adjust'.",
		"* Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit.",
		"* You should not output code blocks such as '```'.",
		"* You must describe what will happen as a result of the changes, not the specific changes themselves.",
		"* You should follow the Conventional Commits format for commit messages.",
		"  * If the scope spans multiple areas, or there are multiple types, you should consolidate them into one type and scope.",
		"  * When bumping a module, you should set scope: `build(deps)`.",
		"    * Please specify both the old version and the new version.",
		"      * For example, `build(deps): bump foobar from 1.2.3 to 2.3.4`.",
		"    * When a new module is added, please only list the new version.",
		"      * For example, `build(deps): add foobar@2.3.4`.",
		"  * You should use the `refactor` type for trivial corrections in the source code that do not affect operation, such as changing variable names, adjusting indents, swapping lines, etc.",
		"  * When performance improvements are made, use the `perf` type.",
		"  * It's unnecessary to include 'in ...' in the commit message. Instead, you should include it in the scope of Conventional Commits.",
		"    * For example, `build: add ... in Dockerfile` should be `build(Dockerfile): add ...`.",
		"    * When a file is under a directory, please list only the directory name as much as possible, so it's easier to group when listing.",
		"    * For example, `fix(utils): fix typo in foobar.ts` should be `fix(utils): fix typo`.",
		"    * For example, `feat(utils/foobar): add new foobar feature` should be `feat(utils): add new foobar feature`.",
		"  * You should not include file extensions in the scope.",
		"    * For example, use `feat(index): add ...` instead of `feat(index.ts): add ...`.",
		"  * If the type is `ci`, you must not add a scope.",
		"    * For example, use `ci: ...` instead of `ci(github): ...`.",
		additionalPrompt,
		"",
		"Please generate the best commit message that has the above features. Take your time to revise and refine your message until you are confident it's the best expression you can produce. You should not be embarrassed to show this to anyone. Thank you in advance.",
	]
		.filter((v) => v !== undefined)
		.join("\n");

export function generatePromptForClaude(diff: string, config: PromptConfig) {
	const { maxLength, hint, n } = config;

	const systemPrompt = `
	<prompt>
		<system>
			<section>
				<instruction>Generate ${n} concise git commit message candidates for the given code diff, following the specifications below:</instruction>
				<specifications>
					<language>
						<item>Write each candidate in English.</item>
						<item>Add the Japanese version of the commit description on the second line enclosed in \`&lt;japanese&gt;\` tags.</item>
						<item>The Japanese version should explain the meaning of the original commit, not just translate the English.</item>
						<item>Translate only the description, not the type or scope.</item>
					</language>
					<format>
						<item>Each English description must be a single line.</item>
						<item>Each message must be at most ${maxLength} characters.</item>
						<item>Follow the Conventional Commits format.</item>
						<item>Consolidate multiple types/scopes into one if needed.</item>
						<item>Use \`build(deps)\` scope when bumping a module.</item>
						<item>Specify both old and new versions when bumping, e.g., \`build(deps): bump foobar from 1.2.3 to 2.3.4\`.</item>
						<item>List only the new version when adding a module, e.g., \`build(deps): add foobar@2.3.4\`.</item>
						<item>Use \`refactor\` type for trivial code changes without operational impact.</item>
						<item>Use \`perf\` type for performance improvements.</item>
						<item>Omit 'in ...' and file extensions in scope. Use \`feat(index)\`, not \`feat(index.ts)\`.</item>
						<item>List only the directory name in scope when a file is under a directory, e.g., \`fix(utils)\`, not \`fix(utils/foobar)\`.</item>
						<item>Omit scope when type is \`ci\`, e.g., \`ci: ...\`, not \`ci(github): ...\`.</item>
					</format>
					<content>
						<item>Describe the result of the changes, not the changes themselves.</item>
						<item>Avoid words like 'Refactor', 'Update', 'ensure', 'streamline', 'centralize', 'enhance', 'improve', 'adjust'.</item>
						<item>Omit unnecessary details like translation or code blocks.</item>
					</content>
				</specifications>
				<output>
					<format>
						<![CDATA[
	<commits>
	<commit><message>feat(scope): concise description of changes in English</message><japanese>変更内容の簡潔な日本語での説明</japanese></commit>
	<commit><message>fix(scope): brief summary of another candidate</message><japanese>別の候補の簡潔な日本語での要約</japanese></commit>
	</commits>
						]]>
					</format>
				</output>
			</section>
			<section>
				<instruction>Generate the ${n} best commit message candidates enclosed in the specified XML tags, adhering to the above guidelines. The XML output should be compact without any whitespace. Refine the messages to the best of your ability. The output should be presentable to anyone without embarrassment.</instruction>
			</section>
		</system>
	</prompt>
	`;

	const userPrompt = `
	<prompt>
		<user>
			<diff>
				<![CDATA[
	${diff}
				]]>
			</diff>
			<hint>
				<item>If provided, use the hint below to describe the commit, but primarily rely on the code diff:</item>
				<item>${hint}</item>
			</hint>
		</user>
	</prompt>
	`;

	return { systemPrompt, userPrompt };
}

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
