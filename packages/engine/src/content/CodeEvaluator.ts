// --- CodeEvaluator ---
// Uses the provider stack to grade code questions without executing code.

import { buildCodeEvaluationPrompt } from '../prompts/code-evaluation.js';
import type { ProviderClient, ToolUseBlock } from '../provider/types.js';
import type {
  CodeEvaluation,
  CodeEvaluationClient,
  CodeEvaluationVerdict,
  CodeQuestion,
} from './types.js';

const CODE_EVALUATION_MAX_TOKENS = 1024;
const VALID_VERDICTS = new Set<CodeEvaluationVerdict>([
  'correct',
  'partial',
  'incorrect',
]);

function isCodeEvaluationVerdict(value: unknown): value is CodeEvaluationVerdict {
  return typeof value === 'string' && VALID_VERDICTS.has(value as CodeEvaluationVerdict);
}

export class CodeEvaluator implements CodeEvaluationClient {
  #provider: ProviderClient;

  constructor(provider: ProviderClient) {
    this.#provider = provider;
  }

  async evaluateCode(
    question: CodeQuestion,
    studentAnswer: string
  ): Promise<CodeEvaluation> {
    const prompt = buildCodeEvaluationPrompt({ question, studentAnswer });
    let lastError = new Error(
      `Failed to evaluate code answer for question "${question.id}" after retry`
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.#provider.sendMessage({
        ...prompt,
        maxTokens: CODE_EVALUATION_MAX_TOKENS,
      });

      const toolBlock = response.content.find(
        (block): block is ToolUseBlock =>
          block.type === 'tool_use' && block.name === 'evaluate_code_submission'
      );

      if (!toolBlock) {
        lastError = new Error('Provider response did not include code evaluation');
        continue;
      }

      try {
        return this.#parseEvaluation(toolBlock);
      } catch (error) {
        lastError = this.#toError(error);
      }
    }

    throw lastError;
  }

  #parseEvaluation(block: ToolUseBlock): CodeEvaluation {
    const input = block.input as Record<string, unknown>;
    const verdict = input.verdict;
    const feedback = input.feedback;

    if (!isCodeEvaluationVerdict(verdict)) {
      throw new Error('Code evaluation response has an invalid verdict');
    }

    if (typeof feedback !== 'string' || feedback.trim().length === 0) {
      throw new Error('Code evaluation response is missing feedback');
    }

    return {
      verdict,
      correct: verdict === 'correct',
      feedback: feedback.trim(),
    };
  }

  #toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
