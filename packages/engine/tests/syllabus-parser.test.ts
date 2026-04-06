import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SyllabusParser,
  validateCurriculumPlan,
} from '../src/curriculum/SyllabusParser.js';
import { CurriculumManager } from '../src/curriculum/CurriculumManager.js';
import {
  buildSyllabusAnalysisPrompt,
  SYLLABUS_ANALYSIS_VERSION,
} from '../src/prompts/syllabus-analysis.js';
import type { ClaudeProvider } from '../src/provider/ClaudeProvider.js';
import type { ProviderResponse } from '../src/provider/types.js';

import * as mitFixture from './fixtures/syllabus-mit-algorithms.js';
import * as courseraFixture from './fixtures/syllabus-coursera-ml.js';
import * as cookingFixture from './fixtures/syllabus-informal-cooking.js';

// --- Mock Provider ---

function mockProvider(response: ProviderResponse): ClaudeProvider {
  return {
    sendMessage: vi.fn().mockResolvedValue(response),
  } as unknown as ClaudeProvider;
}

function mockProviderSequence(...responses: ProviderResponse[]): ClaudeProvider {
  const fn = vi.fn();
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
  return { sendMessage: fn } as unknown as ClaudeProvider;
}

// --- Prompt Builder ---

describe('syllabus analysis prompt', () => {
  it('exports a version constant', () => {
    expect(SYLLABUS_ANALYSIS_VERSION).toBe('1.0');
  });

  it('builds a prompt with system, user message, and tool', () => {
    const prompt = buildSyllabusAnalysisPrompt('Some syllabus text');

    expect(prompt.system).toContain('curriculum designer');
    expect(prompt.messages).toHaveLength(1);
    expect(prompt.messages[0].role).toBe('user');
    expect(prompt.messages[0].content).toContain('Some syllabus text');
    expect(prompt.tools).toHaveLength(1);
    expect(prompt.tools![0].name).toBe('create_curriculum_plan');
    expect(prompt.toolChoice).toEqual({ type: 'tool', name: 'create_curriculum_plan' });
  });

  it('puts syllabus text in user message, not system prompt', () => {
    const syllabusText = 'SECRET SYLLABUS CONTENT';
    const prompt = buildSyllabusAnalysisPrompt(syllabusText);

    // Syllabus is in user message
    expect(prompt.messages[0].content).toContain(syllabusText);
    // Syllabus is NOT in system prompt
    expect(prompt.system).not.toContain(syllabusText);
  });

  it('system prompt instructs not to include meta-topics', () => {
    const prompt = buildSyllabusAnalysisPrompt('any');
    expect(prompt.system).toContain('course overview');
    expect(prompt.system).toContain('Do NOT');
  });

  it('tool schema requires title, description, and sections', () => {
    const prompt = buildSyllabusAnalysisPrompt('any');
    const schema = prompt.tools![0].inputSchema as Record<string, unknown>;
    expect((schema.required as string[]).sort()).toEqual(
      ['description', 'sections', 'title'].sort()
    );
  });
});

// --- Validation ---

describe('validateCurriculumPlan', () => {
  it('validates a well-formed plan', () => {
    const plan = validateCurriculumPlan({
      title: 'Test Course',
      description: 'A test',
      sections: [
        {
          id: 'sec-1',
          title: 'Section 1',
          order: 0,
          topics: [{ id: 'top-1', title: 'Topic 1', description: 'Desc' }],
        },
      ],
    });

    expect(plan.title).toBe('Test Course');
    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0].topics).toHaveLength(1);
  });

  it('rejects non-object input', () => {
    expect(() => validateCurriculumPlan('not an object')).toThrow('object');
    expect(() => validateCurriculumPlan(null)).toThrow('object');
  });

  it('rejects missing title', () => {
    expect(() =>
      validateCurriculumPlan({
        description: 'A test',
        sections: [
          {
            id: 's',
            title: 'S',
            order: 0,
            topics: [{ id: 't', title: 'T', description: 'D' }],
          },
        ],
      })
    ).toThrow('title');
  });

  it('rejects empty sections', () => {
    expect(() =>
      validateCurriculumPlan({ title: 'T', description: 'D', sections: [] })
    ).toThrow('sections');
  });

  it('rejects duplicate section ids', () => {
    expect(() =>
      validateCurriculumPlan({
        title: 'T',
        description: 'D',
        sections: [
          {
            id: 'dup',
            title: 'S1',
            order: 0,
            topics: [{ id: 't1', title: 'T', description: 'D' }],
          },
          {
            id: 'dup',
            title: 'S2',
            order: 1,
            topics: [{ id: 't2', title: 'T', description: 'D' }],
          },
        ],
      })
    ).toThrow('Duplicate section id');
  });

  it('rejects duplicate topic ids across sections', () => {
    expect(() =>
      validateCurriculumPlan({
        title: 'T',
        description: 'D',
        sections: [
          {
            id: 's1',
            title: 'S1',
            order: 0,
            topics: [{ id: 'shared-topic', title: 'T', description: 'D' }],
          },
          {
            id: 's2',
            title: 'S2',
            order: 1,
            topics: [{ id: 'shared-topic', title: 'T2', description: 'D2' }],
          },
        ],
      })
    ).toThrow('Duplicate topic id');
  });

  it('rejects section with empty topics', () => {
    expect(() =>
      validateCurriculumPlan({
        title: 'T',
        description: 'D',
        sections: [{ id: 's1', title: 'S1', order: 0, topics: [] }],
      })
    ).toThrow('topics');
  });

  it('rejects topic with missing description', () => {
    expect(() =>
      validateCurriculumPlan({
        title: 'T',
        description: 'D',
        sections: [
          {
            id: 's1',
            title: 'S1',
            order: 0,
            topics: [{ id: 't1', title: 'T' }],
          },
        ],
      })
    ).toThrow('description');
  });
});

// --- SyllabusParser with Fixtures ---

describe('SyllabusParser', () => {
  it('parses MIT algorithms syllabus', async () => {
    const provider = mockProvider(mitFixture.EXPECTED_RESPONSE);
    const parser = new SyllabusParser(provider);

    const plan = await parser.parse(mitFixture.SYLLABUS_TEXT);

    expect(plan.title).toBe('Introduction to Algorithms');
    expect(plan.sections.length).toBeGreaterThanOrEqual(4);
    // Check that sections have valid structure
    for (const section of plan.sections) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.topics.length).toBeGreaterThanOrEqual(1);
      for (const topic of section.topics) {
        expect(topic.id).toBeTruthy();
        expect(topic.title).toBeTruthy();
        expect(topic.description).toBeTruthy();
      }
    }
  });

  it('parses Coursera ML syllabus', async () => {
    const provider = mockProvider(courseraFixture.EXPECTED_RESPONSE);
    const parser = new SyllabusParser(provider);

    const plan = await parser.parse(courseraFixture.SYLLABUS_TEXT);

    expect(plan.title).toBe('Machine Learning');
    expect(plan.sections.length).toBeGreaterThanOrEqual(4);
  });

  it('parses informal cooking syllabus', async () => {
    const provider = mockProvider(cookingFixture.EXPECTED_RESPONSE);
    const parser = new SyllabusParser(provider);

    const plan = await parser.parse(cookingFixture.SYLLABUS_TEXT);

    expect(plan.title).toContain('Cook');
    expect(plan.sections.length).toBeGreaterThanOrEqual(4);
  });

  it('retries once on malformed response, succeeds on second try', async () => {
    const malformedResponse: ProviderResponse = {
      id: 'msg_bad',
      content: [{ type: 'text', text: 'Oops, no tool use' }],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    const provider = mockProviderSequence(
      malformedResponse,
      mitFixture.EXPECTED_RESPONSE
    );
    const parser = new SyllabusParser(provider);

    const plan = await parser.parse(mitFixture.SYLLABUS_TEXT);

    expect(plan.title).toBe('Introduction to Algorithms');
    expect((provider.sendMessage as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('throws after retry if both responses are malformed', async () => {
    const malformed: ProviderResponse = {
      id: 'msg_bad',
      content: [{ type: 'text', text: 'No tool use' }],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    const provider = mockProviderSequence(malformed, malformed);
    const parser = new SyllabusParser(provider);

    await expect(parser.parse('some syllabus')).rejects.toThrow(
      'did not contain a create_curriculum_plan'
    );
  });

  it('throws on malformed JSON in tool_use input', async () => {
    const badInput: ProviderResponse = {
      id: 'msg_bad_json',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_bad',
          name: 'create_curriculum_plan',
          input: { title: '', description: 'D', sections: [] },
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'tool_use',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    const provider = mockProviderSequence(badInput, badInput);
    const parser = new SyllabusParser(provider);

    await expect(parser.parse('some syllabus')).rejects.toThrow();
  });
});

// --- CurriculumManager ---

describe('CurriculumManager', () => {
  const plan = mitFixture.EXPECTED_RESPONSE.content[0].input as unknown as {
    title: string;
    description: string;
    sections: Array<{
      id: string;
      title: string;
      order: number;
      topics: Array<{ id: string; title: string; description: string }>;
    }>;
  };

  it('holds the curriculum plan', () => {
    const manager = new CurriculumManager(plan);
    expect(manager.plan.title).toBe('Introduction to Algorithms');
    expect(manager.totalSections).toBe(8);
  });

  it('starts with no current section', () => {
    const manager = new CurriculumManager(plan);
    expect(manager.currentSection).toBeNull();
    expect(manager.currentSectionIndex).toBe(-1);
  });

  it('starts a section by ID', () => {
    const manager = new CurriculumManager(plan);
    const section = manager.startSection('hashing');
    expect(section.title).toBe('Hashing');
    expect(manager.currentSectionIndex).toBe(2);
  });

  it('throws on unknown section ID', () => {
    const manager = new CurriculumManager(plan);
    expect(() => manager.startSection('nonexistent')).toThrow('not found');
  });

  it('advances to next section', () => {
    const manager = new CurriculumManager(plan);
    manager.startSection('algorithmic-thinking');
    const next = manager.nextSection();
    expect(next?.title).toBe('Sorting and Trees');
    expect(manager.currentSectionIndex).toBe(1);
  });

  it('returns null when no next section', () => {
    const manager = new CurriculumManager(plan);
    manager.startSection('computational-complexity'); // last section
    expect(manager.nextSection()).toBeNull();
  });

  it('reports hasNextSection correctly', () => {
    const manager = new CurriculumManager(plan);
    manager.startSection('graphs');
    expect(manager.hasNextSection).toBe(true);
    manager.startSection('computational-complexity');
    expect(manager.hasNextSection).toBe(false);
  });

  it('gets a section by ID without changing position', () => {
    const manager = new CurriculumManager(plan);
    manager.startSection('algorithmic-thinking');
    const section = manager.getSection('dynamic-programming');
    expect(section?.title).toBe('Dynamic Programming');
    // Position unchanged
    expect(manager.currentSectionIndex).toBe(0);
  });

  it('returns null for unknown section in getSection', () => {
    const manager = new CurriculumManager(plan);
    expect(manager.getSection('nonexistent')).toBeNull();
  });

  it('stores a defensive copy of the plan', () => {
    const mutablePlan = {
      title: 'Mutable',
      description: 'Test',
      sections: [
        {
          id: 's1',
          title: 'S1',
          order: 0,
          topics: [{ id: 't1', title: 'T1', description: 'D1' }],
        },
      ],
    };
    const manager = new CurriculumManager(mutablePlan);
    mutablePlan.title = 'Changed';
    mutablePlan.sections.push({
      id: 's2',
      title: 'S2',
      order: 1,
      topics: [{ id: 't2', title: 'T2', description: 'D2' }],
    });

    expect(manager.plan.title).toBe('Mutable'); // title is shallow-copied via spread
    expect(manager.totalSections).toBe(1);
  });
});
