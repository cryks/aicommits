type PromptConfig = {
	maxLength: number;
	hint?: string;
  gitLog?: string;
	n: number;
	additionalPrompt?: string;
	isNuxtProject?: boolean;
	isGoProject?: boolean;
};

// prettier-ignore
export function generatePromptJSON(diff: string, config: PromptConfig) {
  const { maxLength, hint, n, additionalPrompt, isNuxtProject } = config;

  const systemPrompt = `
  Please generate ${n} concise git commit message candidates for the given diff, following these specifications:

  <language>
  - Write each message in English
  </language>

  <format>
  - Follow the Conventional Commits format
  - English message should be a single line, max ${maxLength} characters
  - Start the description with a lowercase letter
  - Consolidate multiple types/scopes into one if needed
  - Set scope to \`build(deps)\` when bumping dependencies
  - Use \`refactor\` type for trivial code changes without logic impact
  - Omit 'in ...' phrases and file extensions from scope
  - If file is in a subdir, only include the subdir name in scope, not the full path
  </format>

  <content>
  - Describe the result of the changes, not the changes themselves
  - Avoid generic terms like Refactor, Update, Adjust, Improve, Streamline, Consolidate, Simplify, etc.
  </content>

  ${isNuxtProject ? `
  <nuxt_considerations>
  - For changes related to the Nuxt project (excluding changes to .github/, Dockerfile, etc.):
    - Use one of these scopes: \`nuxt\`, \`config\`, \`plugin\`, \`module\`, \`pages\`, \`components\`, \`composables\`, \`server\`, \`store\`, \`assets\`, \`layouts\`, \`middleware\`, \`public\`
  </nuxt_considerations>
  ` : ''}

  ${additionalPrompt ? `
  <additional_prompt>
  ${additionalPrompt}
  </additional_prompt>
  ` : ''}

  <output>
  - Generate commit message candidates that range from highly relevant to creative, based on the diff and hint
  - For each candidate, include a "score" field indicating the estimated relevance (0-100, where 100 is most relevant)
  - Sort the candidates by descending score
  - If there are additional questions you want to ask the user to generate the commit messages, include them in the "assistant" field at the top level of the JSON output
  - If the intent cannot be inferred from the diff and generating commit message candidates is difficult, use the "assistant" field to ask the user for additional context or clarification
  - Keep the "assistant" field concise, containing at most 72 characters for alphanumeric content or 36 characters for Japanese content
  - Ensure the "assistant" field, if present, is a valid JSON string, with newlines escaped as \\n, and is written in Japanese
  - Output valid JSON as shown in these examples:

  Example 1 (without "assistant" field):
  {
    "commits": [
      {
        "message": "feat(scope): concise description of changes in English",
        "score": 95
      }
    ]
  }

  Example 2 (with "assistant" field):
  {
    "commits": [
      {
        "message": "feat(scope): concise description of changes in English",
        "score": 95
      }
    ],
    "assistant": "Brief questions the assistant wants to ask the user"
  }
  </output>

  Generate the most appropriate commit message candidates based mainly on the diff, but also consider the hint if provided. Ensure the JSON output is valid and matches the example format.

  ${isNuxtProject ? `
  If there are any contradictions between the <nuxt_considerations> and the rest of the prompt, prioritize the <nuxt_considerations>.
  ` : ''}

  ${additionalPrompt ? `
  If there are any contradictions between the <additional_prompt> and the base prompt, prioritize the <additional_prompt>.
  ` : ''}

  ${config.gitLog ? `
  If there are any contradictions between the <git_log_analysis> and the system prompt, prioritize the instructions in the <git_log_analysis>.
  ` : ''}
  `;

  const gitLog = config.gitLog ?
`
<git_log_analysis>
First, analyze the commit messages according to the following rules:
1. Analyze the latest 50 commit messages and calculate the percentage of commits with scopes
2. If the percentage of commits with scopes is less than 25%, completely exclude scopes from new commit messages
3. If the percentage is between 25-75%, include scopes only when necessary
4. If the percentage is above 75%, generally include scopes

Also analyze the main scope patterns used in past commits and maintain consistency with commonly used scopes.
</git_log_analysis>

<git_log>
${config.gitLog}
</git_log>
`
  : '';

  const hintPrompt = hint ?
`
<hint>
If provided, use the hint to describe the commit, but rely mainly on the diff:
${hint}
</hint>
` : '';

  const userPrompt = `
  <unified_diff>
  ${diff}
  </unified_diff>

  ${gitLog}

  ${hintPrompt}
  `;

  return { systemPrompt, userPrompt };
}
