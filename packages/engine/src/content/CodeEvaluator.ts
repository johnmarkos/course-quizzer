// --- Code Evaluator ---
// Provider-backed AI tutor grading for code questions.
// Student code is sent as text and is never executed.

import { buildCodeEvaluationPrompt } from '../prompts/code-evaluation.js';
import type { ProviderClient, ToolUseBlock } from '../provider/types.js';
import type { CodeEvaluation, CodeEvaluationVerdict, CodeQuestion } from './types.js';

const CODE_EVALUATION_MAX_TOKENS = 1024;

export type { CodeEvaluation, CodeEvaluationVerdict } from './types.js';

export type CodeAnswerEvaluator = {
  evaluateCodeAnswer(
    question: CodeQuestion,
    studentCode: string
  ): Promise<CodeEvaluation>;
};

export class CodeEvaluator implements CodeAnswerEvaluator {
  #provider: ProviderClient;

  constructor(provider: ProviderClient) {
    this.#provider = provider;
  }

  async evaluateCodeAnswer(
    question: CodeQuestion,
    studentCode: string
  ): Promise<CodeEvaluation> {
    const prompt = buildCodeEvaluationPrompt({ question, studentCode });
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
          block.type === 'tool_use' && block.name === 'evaluate_code_answer'
      );

      if (!toolBlock) {
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

    if (verdict !== 'correct' && verdict !== 'partial' && verdict !== 'incorrect') {
      throw new Error('Code evaluation verdict is invalid');
    }

    if (typeof feedback !== 'string' || feedback.length === 0) {
      throw new Error('Code evaluation feedback is missing');
    }

    return { verdict, feedback };
  }

  #toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
