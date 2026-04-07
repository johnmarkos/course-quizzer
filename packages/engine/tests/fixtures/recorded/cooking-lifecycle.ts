// --- Recorded Fixture: Cooking Course Lifecycle ---
// Realistic API responses for the first section of an informal cooking course.

import type { ProviderResponse } from '../../../src/provider/types.js';

export const SYLLABUS_RESPONSE: ProviderResponse = {
  id: 'msg_cook_01',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_cook_01',
      name: 'create_curriculum_plan',
      input: {
        title: 'Learn to Cook: From Zero to Dinner Party',
        description:
          'A 6-week beginner cooking course covering kitchen fundamentals, cooking techniques, and meal planning.',
        sections: [
          {
            id: 'kitchen-basics',
            title: 'Kitchen Basics',
            order: 0,
            topics: [
              {
                id: 'knife-skills',
                title: 'Knife Skills',
                description:
                  'Essential cutting techniques: dicing, mincing, julienne, and chiffonade.',
              },
              {
                id: 'mise-en-place',
                title: 'Mise en Place',
                description:
                  'The practice of preparing and organizing all ingredients before cooking begins.',
              },
            ],
          },
          {
            id: 'cooking-methods',
            title: 'Cooking Methods',
            order: 1,
            topics: [
              {
                id: 'sauteing-roasting',
                title: 'Sautéing and Roasting',
                description:
                  'Dry-heat cooking methods: high-heat pan cooking and oven roasting.',
              },
              {
                id: 'braising-boiling',
                title: 'Braising and Boiling',
                description:
                  'Moist-heat cooking methods: slow braising in liquid and rapid boiling.',
              },
            ],
          },
          {
            id: 'flavor-building',
            title: 'Flavor Building',
            order: 2,
            topics: [
              {
                id: 'seasoning',
                title: 'Seasoning and Spices',
                description:
                  'Using salt, pepper, herbs, and spices to build layers of flavor.',
              },
            ],
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 400, outputTokens: 320 },
};

export const EXPLANATION_KNIFE_SKILLS: ProviderResponse = {
  id: 'msg_cook_02',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_cook_02',
      name: 'create_explanation',
      input: {
        title: 'Essential Knife Skills',
        content:
          'Good knife skills are the foundation of efficient cooking. The four essential cuts every beginner should master are:\n\n**Dice** — Cut food into uniform cubes (small, medium, or large). Start by cutting planks, then sticks, then cubes. Uniformity matters for even cooking.\n\n**Mince** — Cut food as finely as possible, creating tiny irregular pieces. Used for garlic, shallots, and herbs where you want the flavor to melt into a dish.\n\n**Julienne** — Cut into thin matchstick-sized strips, about 3mm × 3mm × 5cm. Common for stir-fries and salads.\n\n**Chiffonade** — Stack leafy herbs or greens, roll them tightly, and slice across to create thin ribbons. Perfect for basil on pasta or mint in salads.\n\nAlways keep your knife sharp — a dull knife requires more force and is more dangerous. Grip the knife with your thumb and index finger pinching the blade just above the handle (the "pinch grip") for maximum control.',
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 350, outputTokens: 280 },
};

export const QUIZ_KNIFE_SKILLS: ProviderResponse = {
  id: 'msg_cook_03',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_cook_03',
      name: 'create_quiz_questions',
      input: {
        questions: [
          {
            type: 'multiple-choice',
            question: 'Which knife cut produces thin matchstick-sized strips?',
            options: ['Dice', 'Mince', 'Julienne', 'Chiffonade'],
            correctIndex: 2,
          },
          {
            type: 'ordering',
            question: 'Order the steps for creating a dice cut from first to last:',
            items: ['Cut into cubes', 'Cut into planks', 'Cut into sticks'],
            correctOrder: [1, 2, 0],
          },
          {
            type: 'multiple-choice',
            question: 'Why is a sharp knife considered safer than a dull one?',
            options: [
              'Sharp knives cut faster so you spend less time cutting',
              'A dull knife requires more force, increasing the risk of slipping',
              'Sharp knives are lighter and easier to handle',
              'Dull knives rust more quickly',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 600, outputTokens: 340 },
};

export const EXPLANATION_MISE_EN_PLACE: ProviderResponse = {
  id: 'msg_cook_04',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_cook_04',
      name: 'create_explanation',
      input: {
        title: 'Mise en Place: Everything in Its Place',
        content:
          '**Mise en place** (French for "everything in its place") is the practice of reading the full recipe, then measuring, cutting, and organizing every ingredient before you turn on the stove.\n\nWhy it matters: Cooking often moves fast. If a recipe says "add garlic and stir for 30 seconds," you don\'t have time to peel and mince garlic on the spot — it will burn. Having ingredients prepped and within arm\'s reach lets you focus on technique and timing.\n\nA typical mise en place workflow:\n1. Read the recipe completely\n2. Gather all ingredients and equipment\n3. Wash, peel, and cut everything as specified\n4. Measure liquids and spices into small bowls\n5. Arrange everything near your cooking station\n\nProfessional chefs treat mise en place as non-negotiable. It reduces mistakes, speeds up cooking, and makes cleanup easier since you can wash prep tools while the food cooks.',
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 370, outputTokens: 260 },
};

export const QUIZ_MISE_EN_PLACE: ProviderResponse = {
  id: 'msg_cook_05',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_cook_05',
      name: 'create_quiz_questions',
      input: {
        questions: [
          {
            type: 'multi-select',
            question: 'Select ALL steps that are part of a mise en place workflow:',
            options: [
              'Read the full recipe before starting',
              'Start cooking immediately and prep as you go',
              'Measure and organize all ingredients',
              'Wash and cut vegetables in advance',
              'Leave cleanup until after eating',
            ],
            correctIndices: [0, 2, 3],
          },
          {
            type: 'multiple-choice',
            question:
              'What is the primary benefit of mise en place when cooking a fast-paced recipe?',
            options: [
              'It makes the food taste better over time',
              'It lets you focus on technique and timing',
              'It reduces the number of dishes to wash',
              'It requires significantly less counter space',
            ],
            correctIndex: 1,
          },
          {
            type: 'numeric-input',
            question:
              'A recipe calls for mise en place with the following steps: read recipe, gather ingredients, wash produce, cut vegetables, measure spices, arrange station. How many steps is that?',
            correctValue: 6,
            tolerance: 0,
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 640, outputTokens: 360 },
};
