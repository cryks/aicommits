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
  - If the AI assistant has truly important information that the user might not be aware of, include it in an "assistant" field at the top level of the JSON output
  - The "assistant" field should not explain the commit content, as the user is already aware of it
  - The "assistant" field should be concise, containing at most 72 characters for alphanumeric content or 36 characters for Japanese content
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
    "assistant": "ユーザーが気づいていない可能性のある重要な情報"
  }
  </output>

  Generate the most appropriate commit message candidates based mainly on the diff, but also consider the hint if provided. Ensure the JSON output is valid and matches the example format.

  ${isNuxtProject ? `
  If there are any contradictions between the <nuxt_considerations> and the rest of the prompt, prioritize the <nuxt_considerations>.
  ` : ''}

  ${additionalPrompt ? `
  If there are any contradictions between the <additional_prompt> and the base prompt, prioritize the <additional_prompt>.
  ` : ''}
  `;

  const gitLog = config.gitLog ?
`
Please use the provided \`git log\` information as context to generate commit message candidates that align with the project’s history. Focus on consistency in tone, style, and scope based on previous commits, especially when:

	1.	Similar types of changes have been made in the past.
	2.	There are common themes or scopes that the log reveals as relevant.

Refer to past commit messages to ensure stylistic coherence, prioritizing any recurring terms or conventions found in the git log section. However, the description should still accurately reflect the changes shown in the unified diff, prioritizing the latest context from the diff over past messages unless they directly relate.

<git_log>
${config.gitLog}
</git_log>
`
  : '';

  const userPrompt = `
  <unified_diff>
  ${diff}
  </unified_diff>

  ${gitLog}

  <hint>
  If provided, use the hint to describe the commit, but rely mainly on the diff:
  ${hint}
  </hint>
  `;

  return { systemPrompt, userPrompt };
}
