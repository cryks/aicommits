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
  const { maxLength, hint, gitLog, n, additionalPrompt } = config;

  const systemPrompt = `
Please generate ${n} concise git commit message candidates based on the provided diff, following these rules:

Language:
- Write messages in English.

Format:
- Use the Conventional Commits format: \`type(scope): description\`
  e.g. \`refactor: remove redundant popup flag to simplify state control\`
- The message must be a single line and no longer than ${maxLength} characters.
- The description must start with a lowercase letter.
- Do not use the prepositions "for" or "by" in the description.
- Describe the overall impact or effect of the changes rather than listing individual modifications.
- Avoid generic terms such as "update", "adjust", "improve", "simplify", etc.

Content:
- Base the message primarily on the provided diff.
- Use the hint (if provided) to supplement the diff.
- Refer to past commit messages (gitLog) as a style and scope reference.
- If an additional prompt is provided, prioritize its instructions over the base rules.
- Focus on clarity, brevity, and precision.

Output:
- Return valid JSON with a "commits" array. Each element should have a "message" and a "score" (0-100, where 100 is most relevant).
- Optionally include an "assistant" field with a brief clarification question if more context is needed.
- Example:
{
  "commits": [
    {
      "message": "refactor: remove redundant popup flag to simplify state control",
      "score": 100
    }
  ]
}
  `;

  const gitLogSection = gitLog ? `
<git_log>
${gitLog}
</git_log>` : '';

  const hintSection = hint ? `
<hint>
${hint}
</hint>` : '';

  const additionalPromptSection = additionalPrompt ? `
<additional_prompt>
${additionalPrompt}
</additional_prompt>` : '';

  const userPrompt = `
<unified_diff>
${diff}
</unified_diff>
${gitLogSection}
${hintSection}
${additionalPromptSection}
  `;

  return { systemPrompt, userPrompt };
}
