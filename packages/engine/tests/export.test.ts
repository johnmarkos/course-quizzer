import { describe, it, expect } from 'vitest';
import { CourseEngine } from '../src/engine/CourseEngine.js';
import { Exporter } from '../src/export/Exporter.js';
import { Importer } from '../src/export/Importer.js';
import type { CurriculumPlan, ContentItem } from '../src/engine/types.js';

function mockCurriculum(): CurriculumPlan {
  return {
    title: 'Intro to Testing',
    description: 'A course about testing',
    sections: [
      {
        id: 'section-1',
        title: 'Unit Testing',
        order: 0,
        topics: [{ id: 'topic-1', title: 'Assertions', description: 'How to assert' }],
      },
    ],
  };
}

function mockSectionContent(): ContentItem[] {
  return [
    {
      type: 'explanation',
      topicId: 'topic-1',
      title: 'Understanding Assertions',
      content: 'Assertions verify expected behavior.',
    },
  ];
}

describe('Exporter & Importer', () => {
  function createValidSnapshot(): ReturnType<CourseEngine['serialize']> {
    const engine = new CourseEngine({ apiKey: 'sk-test-key' });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    engine.setSectionContent(mockSectionContent());
    return engine.serialize();
  }

  it('round-trips full course data with generated content', () => {
    const engine = new CourseEngine({ apiKey: 'sk-test-key' });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    const items = mockSectionContent();
    engine.setSectionContent(items);

    const exporter = new Exporter();
    const importer = new Importer();

    const snapshot = engine.serialize();
    const bundle = exporter.exportToString(snapshot);

    // Verify bundle structure
    expect(bundle).toContain('"type": "coursequizzer-export"');
    expect(bundle).toContain('"Intro to Testing"');
    expect(bundle).toContain('"Understanding Assertions"');

    // Security check: ensure API key is NOT in bundle
    expect(bundle).not.toContain('sk-test-key');

    // Restore into new engine
    const restoredSnapshot = importer.import(bundle);
    const restoredEngine = CourseEngine.restore(restoredSnapshot, {
      apiKey: 'sk-new-key',
    });

    expect(restoredEngine.state).toBe('practicing');
    expect(restoredEngine.curriculum?.title).toBe('Intro to Testing');
    expect(restoredEngine.currentItem?.title).toBe('Understanding Assertions');
  });

  it('maintains allGeneratedContent across sections', () => {
    const engine = new CourseEngine({ apiKey: 'sk-test-key' });
    engine.loadCurriculum(mockCurriculum());

    // Section 1
    engine.startSection('section-1');
    engine.setSectionContent([
      { type: 'explanation', topicId: 'topic-1', title: 'S1', content: 'C1' },
    ]);

    // Move to answered state by skipping (if we had a question)
    // Actually, just finish the section
    engine.nextItem(); // should transition to sectionComplete because only one item
    expect(engine.state).toBe('sectionComplete');

    const exporter = new Exporter();
    const snapshot = engine.serialize();
    const bundle = exporter.exportToString(snapshot);

    expect(bundle).toContain('"S1"');
    expect(bundle).toContain('"C1"');
  });

  it('rejects malformed or invalid bundles', () => {
    const importer = new Importer();

    expect(() => importer.import('{}')).toThrow('Invalid export bundle type');
    expect(() => importer.import('{"type": "wrong"}')).toThrow(
      'Invalid export bundle type'
    );
    expect(() =>
      importer.import('{"type": "coursequizzer-export", "version": 1, "data": {}}')
    ).toThrow('Invalid engine snapshot');
  });

  it('rejects bundles with malformed snapshot indices and content collections', () => {
    const importer = new Importer();
    const validSnapshot = createValidSnapshot();

    const invalidBundles = [
      {
        ...validSnapshot,
        currentSectionIndex: 1.5,
      },
      {
        ...validSnapshot,
        currentItemIndex: -0.25,
      },
      {
        ...validSnapshot,
        sectionItems: { bad: true },
      },
      {
        ...validSnapshot,
        allGeneratedContent: { 'section-1': 1 },
      },
    ];

    for (const snapshot of invalidBundles) {
      const bundle = JSON.stringify({
        type: 'coursequizzer-export',
        version: 1,
        data: snapshot,
      });

      expect(() => importer.import(bundle)).toThrow('Invalid engine snapshot');
    }
  });

  it('rejects version 3 bundles when malformed allGeneratedContent is present', () => {
    const importer = new Importer();
    const validSnapshot = createValidSnapshot();
    const bundle = JSON.stringify({
      type: 'coursequizzer-export',
      version: 1,
      data: {
        ...validSnapshot,
        version: 3,
        allGeneratedContent: { bad: 1 },
      },
    });

    expect(() => importer.import(bundle)).toThrow('Invalid engine snapshot');
  });

  it('strips unknown snapshot fields before re-exporting imported data', () => {
    const exporter = new Exporter();
    const importer = new Importer();
    const snapshotWithUnknownFields = {
      ...createValidSnapshot(),
      provider: { apiKey: 'sk-ant-provider-secret' },
      headers: { 'x-api-key': 'sk-ant-header-secret' },
      debug: { rawApiKey: 'sk-ant-debug-secret' },
    };

    const importedSnapshot = importer.import(
      JSON.stringify({
        type: 'coursequizzer-export',
        version: 1,
        data: snapshotWithUnknownFields,
      })
    );
    const importedRecord = importedSnapshot as typeof importedSnapshot &
      Record<string, unknown>;

    expect(importedRecord.provider).toBeUndefined();
    expect(importedRecord.headers).toBeUndefined();
    expect(importedRecord.debug).toBeUndefined();

    const exported = exporter.exportToString(importedSnapshot);
    expect(exported).not.toContain('sk-ant-provider-secret');
    expect(exported).not.toContain('sk-ant-header-secret');
    expect(exported).not.toContain('sk-ant-debug-secret');
  });

  it('copies imported generated content __proto__ keys as own data properties', () => {
    const importer = new Importer();
    const validSnapshot = createValidSnapshot();
    const generatedContentWithProtoKey = {
      ...validSnapshot.allGeneratedContent,
      ['__proto__']: mockSectionContent(),
    };

    const importedSnapshot = importer.import(
      JSON.stringify({
        type: 'coursequizzer-export',
        version: 1,
        data: {
          ...validSnapshot,
          allGeneratedContent: generatedContentWithProtoKey,
        },
      })
    );

    expect(
      Object.prototype.hasOwnProperty.call(
        importedSnapshot.allGeneratedContent,
        '__proto__'
      )
    ).toBe(true);
    expect(Object.getPrototypeOf(importedSnapshot.allGeneratedContent)).toBe(
      Object.prototype
    );
    expect(importedSnapshot.allGeneratedContent['__proto__']).toEqual(
      mockSectionContent()
    );
  });

  it('copies imported mastery __proto__ keys as own data properties', () => {
    const importer = new Importer();
    const validSnapshot = createValidSnapshot();
    const protoMastery = {
      topicId: '__proto__',
      score: 0.5,
      questionsAnswered: 2,
      questionsCorrect: 1,
    };

    const importedSnapshot = importer.import(
      JSON.stringify({
        type: 'coursequizzer-export',
        version: 1,
        data: {
          ...validSnapshot,
          studentState: {
            masteryByTopic: {
              ...validSnapshot.studentState.masteryByTopic,
              ['__proto__']: protoMastery,
            },
            gaps: [],
          },
        },
      })
    );

    expect(
      Object.prototype.hasOwnProperty.call(
        importedSnapshot.studentState.masteryByTopic,
        '__proto__'
      )
    ).toBe(true);
    expect(Object.getPrototypeOf(importedSnapshot.studentState.masteryByTopic)).toBe(
      Object.prototype
    );
    expect(importedSnapshot.studentState.masteryByTopic['__proto__']).toEqual(
      protoMastery
    );
  });
});
