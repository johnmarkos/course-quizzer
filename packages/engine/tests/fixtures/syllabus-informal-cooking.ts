// --- Fixture: Informal Course Outline (Cooking) ---
// Tests that the parser handles informal/brief syllabi,
// not just structured academic ones.

export const SYLLABUS_TEXT = `
Learn to Cook: From Zero to Dinner Party

This is a 6-week beginner cooking course. No experience needed!

We'll cover:
- Kitchen basics: knife skills, mise en place, reading recipes
- Cooking methods: sautéing, roasting, braising, boiling
- Flavor building: seasoning, acids, fats, heat
- Proteins: chicken, fish, eggs, tofu
- Sides and salads: grains, vegetables, dressings
- Putting it together: meal planning, timing multiple dishes, hosting
`;

export const EXPECTED_RESPONSE = {
  id: 'msg_fixture_cooking',
  content: [
    {
      type: 'tool_use' as const,
      id: 'toolu_fixture_3',
      name: 'create_curriculum_plan',
      input: {
        title: 'Learn to Cook: From Zero to Dinner Party',
        description:
          'A beginner cooking course covering kitchen fundamentals, cooking techniques, flavor building, and meal planning.',
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
                  'Proper knife grip, basic cuts (dice, mince, julienne), and knife safety in the kitchen.',
              },
              {
                id: 'mise-en-place',
                title: 'Mise en Place',
                description:
                  'The practice of preparing and organizing all ingredients before cooking begins.',
              },
              {
                id: 'reading-recipes',
                title: 'Reading Recipes',
                description:
                  'How to interpret recipe instructions, measurements, and cooking terminology.',
              },
            ],
          },
          {
            id: 'cooking-methods',
            title: 'Cooking Methods',
            order: 1,
            topics: [
              {
                id: 'sauteing-and-roasting',
                title: 'Sautéing and Roasting',
                description:
                  'Dry-heat cooking methods: sautéing in a pan with fat, and roasting in the oven.',
              },
              {
                id: 'braising-and-boiling',
                title: 'Braising and Boiling',
                description:
                  'Wet-heat cooking methods: braising with liquid in a covered pot, and boiling in water.',
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
                title: 'Seasoning',
                description:
                  'Using salt, pepper, herbs, and spices to enhance the natural flavors of ingredients.',
              },
              {
                id: 'flavor-balance',
                title: 'Balancing Acids, Fats, and Heat',
                description:
                  'How acid (citrus, vinegar), fat (butter, oil), and heat levels interact to create balanced dishes.',
              },
            ],
          },
          {
            id: 'proteins',
            title: 'Proteins',
            order: 3,
            topics: [
              {
                id: 'poultry-and-fish',
                title: 'Chicken and Fish',
                description:
                  'Techniques for cooking chicken (roasting, pan-searing) and fish (baking, sautéing) safely and deliciously.',
              },
              {
                id: 'eggs-and-tofu',
                title: 'Eggs and Tofu',
                description:
                  'Versatile protein sources: scrambling, frying, and poaching eggs; pressing and cooking tofu.',
              },
            ],
          },
          {
            id: 'sides-and-salads',
            title: 'Sides and Salads',
            order: 4,
            topics: [
              {
                id: 'grains-and-vegetables',
                title: 'Grains and Vegetables',
                description:
                  'Cooking rice, pasta, and other grains; roasting, steaming, and sautéing vegetables.',
              },
              {
                id: 'dressings',
                title: 'Dressings and Vinaigrettes',
                description:
                  'Making basic vinaigrettes and dressings from scratch using oil, acid, and emulsifiers.',
              },
            ],
          },
          {
            id: 'putting-it-together',
            title: 'Putting It Together',
            order: 5,
            topics: [
              {
                id: 'meal-planning',
                title: 'Meal Planning',
                description:
                  'Planning balanced meals, creating shopping lists, and organizing prep work efficiently.',
              },
              {
                id: 'timing-and-hosting',
                title: 'Timing Multiple Dishes and Hosting',
                description:
                  'Coordinating cooking times for a multi-dish meal and tips for hosting a dinner party.',
              },
            ],
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 200, outputTokens: 800 },
};
