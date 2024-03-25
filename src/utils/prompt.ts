type PromptConfig = {
	maxLength: number;
	hint?: string;
	n: number;
	additionalPrompt?: string;
	isNuxtProject?: boolean;
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

/*
export function generatePromptForClaude(diff: string, config: PromptConfig) {
	const { maxLength, hint, n } = config;

	const systemPrompt = `
	<prompt>
	<system>
	<section>
	<instruction>Generate ${n} concise git commit message candidates for the given diff, following the specs:</instruction>
	<language>
	<item>Write each message in English, with Japanese translation in the "japanese" field</item>
	<item>Only translate the description, not the type or scope</item>
	</language>
	<format>
	<item>Follow Conventional Commits format</item>
	<item>English message must be a single line, max ${maxLength} chars</item>
	<item>Consolidate multiple types/scopes into one if needed</item>
	<item>Set scope to \`build(deps)\` when bumping dependencies</item>
	<item>Use \`refactor\` type for trivial code changes without logic impact</item>
	<item>Omit 'in ...' phrases and file extensions from scope</item>
	<item>If file is in subdir, only include the subdir name in scope, not full path</item>
	</format>
	<content>
	<item>Describe the result of the changes, not the changes themselves</item>
	<item>Avoid generic terms like Refactor, Update, Adjust, Improve, etc.</item>
	</content>
	<output>
	<item>Output valid JSON as shown in example</item>
	<item>Wrap the commits array in a "commits" object</item>
	</output>
	<example>
	<![CDATA[
	{
		"commits": [
			{
				"message": "feat(scope): concise description of changes in English",
				"japanese": "変更内容の簡潔な日本語での説明"
			}
		]
	}
	]]>
	</example>
	</section>
	<section>
	<instruction>Generate the ${n} best commit message candidates based on the diff, ordered from most to least fitting. Rely mainly on the diff, but also consider the hint if provided. Ensure valid JSON output matching the example format.</instruction>
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
	<item>If provided, use hint to describe commit, but rely mainly on diff:</item>
	<item>${hint}</item>
	</hint>
	</user>
	</prompt>
	`;

	return { systemPrompt, userPrompt };
}
*/

// prettier-ignore
export function generatePromptJSON(diff: string, config: PromptConfig) {
  const { maxLength, hint, n, additionalPrompt, isNuxtProject } = config;

  const systemPrompt = `
  Please generate ${n} concise git commit message candidates for the given diff, following these specifications:

  <language>
  - Write each message in English, with a Japanese translation in the "japanese" field
  - Only translate the description part, not the type or scope
  </language>

  <format>
  - Follow the Conventional Commits format
  - English message should be a single line, max ${maxLength} characters
  - Consolidate multiple types/scopes into one if needed
  - Set scope to \`build(deps)\` when bumping dependencies
  - Use \`refactor\` type for trivial code changes without logic impact
  - Omit 'in ...' phrases and file extensions from scope
  - If file is in a subdir, only include the subdir name in scope, not the full path
  </format>

  <content>
  - Describe the result of the changes, not the changes themselves
  - Avoid generic terms like Refactor, Update, Adjust, Improve, etc.
  </content>

  ${isNuxtProject ? `
  <nuxt_considerations>
  - Use \`nuxt\` as the scope for general Nuxt-specific changes
  - Use \`config\`, \`plugin\`, \`module\` as the scope for changes to nuxt.config, plugins, and modules respectively
  - Use \`pages\` as the scope for changes to pages/ directory
  - Use \`components\` as the scope for changes to components/ directory
  - Use \`composables\` as the scope for changes to composables/ directory
  - Use \`server\` as the scope for changes to server/ directory and server-side API components
  - Use \`store\` as the scope for changes related to Vuex store
  - Use \`i18n\` as the scope for internationalization related changes
  - Use \`ssr\` as the scope for server-side rendering specific changes
  - Use \`assets\` as the scope for changes to assets/ directory (e.g., images, fonts, css)
  - Use \`layouts\` as the scope for changes to layouts/ directory
  - Use \`middleware\` as the scope for changes to middleware/ directory
  - Use \`public\` as the scope for changes to public/ directory (e.g., favicon, robots.txt)
  - Mention the specific page, component, API endpoint, or feature in the description when relevant
  </nuxt_considerations>
  ` : ''}

  ${additionalPrompt ? `
  <additional_prompt>
  ${additionalPrompt}
  </additional_prompt>
  ` : ''}

  <output>
  - Output valid JSON as shown in this example:
  {
    "commits": [
      {
        "message": "feat(scope): concise description of changes in English",
        "japanese": "変更内容の簡潔な日本語での説明"
      }
    ]
  }
  </output>

  Generate the ${n} most appropriate commit message candidates based mainly on the diff, but also consider the hint if provided. Ensure the JSON output is valid and matches the example format.

  ${isNuxtProject ? `
  If there are any contradictions between the <nuxt_considerations> and the rest of the prompt, prioritize the <nuxt_considerations>.
  ` : ''}

  ${additionalPrompt ? `
  If there are any contradictions between the <additional_prompt> and the base prompt, prioritize the <additional_prompt>.
  ` : ''}
  `;

  const userPrompt = `
  <diff>
  ${diff}
  </diff>

  <hint>
  If provided, use the hint to describe the commit, but rely mainly on the diff:
  ${hint}
  </hint>
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
