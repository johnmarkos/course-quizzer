// --- Recorded Fixture: WWII History Lifecycle ---
// Realistic API responses for a non-CS syllabus.

import type { ProviderResponse } from '../../../src/provider/types.js';

export const SYLLABUS_RESPONSE: ProviderResponse = {
  id: 'msg_wwii_01',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_wwii_01',
      name: 'create_curriculum_plan',
      input: {
        title: 'World War II: A Global Perspective',
        description:
          'An introductory survey of the Second World War covering political, military, and social dimensions across all major theaters.',
        sections: [
          {
            id: 'road-to-war',
            title: 'Road to War (1919–1939)',
            order: 0,
            topics: [
              {
                id: 'treaty-of-versailles',
                title: 'Treaty of Versailles',
                description:
                  'The 1919 peace treaty that ended WWI and imposed harsh terms on Germany, sowing seeds of resentment.',
              },
              {
                id: 'rise-of-fascism',
                title: 'Rise of Fascism',
                description:
                  'The emergence of fascist movements in Italy and Nazi Germany during the interwar period.',
              },
            ],
          },
          {
            id: 'european-theater',
            title: 'European Theater',
            order: 1,
            topics: [
              {
                id: 'blitzkrieg',
                title: 'Blitzkrieg',
                description:
                  'Germany\'s "lightning war" strategy combining fast-moving armor, infantry, and air support.',
              },
            ],
          },
          {
            id: 'pacific-theater',
            title: 'Pacific Theater',
            order: 2,
            topics: [
              {
                id: 'pearl-harbor',
                title: 'Pearl Harbor',
                description:
                  'The Japanese surprise attack on December 7, 1941 that brought the United States into the war.',
              },
            ],
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 500, outputTokens: 380 },
};

export const EXPLANATION_VERSAILLES: ProviderResponse = {
  id: 'msg_wwii_02',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_wwii_02',
      name: 'create_explanation',
      input: {
        title: 'The Treaty of Versailles',
        content:
          'The **Treaty of Versailles** (1919) formally ended World War I and was negotiated primarily by the Allied Powers — Britain, France, and the United States. Germany was not invited to the negotiations.\n\nThe treaty imposed severe terms on Germany: it had to accept sole responsibility for causing the war (the "War Guilt Clause," Article 231), pay massive reparations, cede territory including Alsace-Lorraine to France, and drastically reduce its military. The Rhineland was demilitarized, and Germany lost all overseas colonies.\n\nMany historians consider the treaty a critical factor in the rise of Nazism. The reparations crippled the German economy, contributing to hyperinflation in the 1920s and mass unemployment during the Great Depression. The humiliation of the War Guilt Clause fueled nationalist resentment that Adolf Hitler exploited to build support for the Nazi Party. As economist John Maynard Keynes warned in 1919, the treaty\'s harsh terms risked creating the conditions for another war — a prediction that proved tragically accurate.',
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 400, outputTokens: 290 },
};

export const QUIZ_VERSAILLES: ProviderResponse = {
  id: 'msg_wwii_03',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_wwii_03',
      name: 'create_quiz_questions',
      input: {
        questions: [
          {
            type: 'multiple-choice',
            question:
              'Which article of the Treaty of Versailles assigned sole blame for WWI to Germany?',
            options: ['Article 48', 'Article 231', 'Article 5', 'Article 14'],
            correctIndex: 1,
          },
          {
            type: 'multi-select',
            question: 'Select ALL terms imposed on Germany by the Treaty of Versailles:',
            options: [
              'Payment of reparations',
              'Cession of Alsace-Lorraine to France',
              'Permanent Allied military occupation of Berlin',
              'Drastic reduction of the German military',
              'Transfer of the Rhineland to Belgium',
            ],
            correctIndices: [0, 1, 3],
          },
          {
            type: 'numeric-input',
            question: 'In what year was the Treaty of Versailles signed?',
            correctValue: 1919,
            tolerance: 0,
          },
          {
            type: 'two-stage',
            question:
              'What was a major economic consequence of the reparations imposed on Germany?',
            options: [
              'Germany experienced an economic boom',
              'Hyperinflation devastated the German economy',
              "Germany became the world's largest creditor",
              'The German currency became the European standard',
            ],
            correctIndex: 1,
            followUp:
              'How did this economic consequence contribute to the rise of Nazism?',
            followUpOptions: [
              'Economic prosperity made people complacent about extremism',
              'Mass unemployment and humiliation fueled nationalist resentment that Hitler exploited',
              'The stable economy gave Hitler resources to fund his campaign',
            ],
            followUpCorrectIndex: 1,
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 780, outputTokens: 450 },
};

export const EXPLANATION_FASCISM: ProviderResponse = {
  id: 'msg_wwii_04',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_wwii_04',
      name: 'create_explanation',
      input: {
        title: 'The Rise of Fascism',
        content:
          "**Fascism** emerged in Europe during the 1920s and 1930s as a reaction to the perceived failures of liberal democracy and the fear of communist revolution. It combined extreme nationalism, authoritarianism, and the cult of a strong leader.\n\nIn **Italy**, Benito Mussolini founded the Fascist Party in 1919 and became prime minister in 1922 after the \"March on Rome.\" He dismantled democratic institutions and established a one-party state, using propaganda and political violence to maintain power.\n\nIn **Germany**, Adolf Hitler joined the small German Workers' Party in 1919 and transformed it into the National Socialist (Nazi) Party. After a failed coup attempt in 1923 (the Beer Hall Putsch), Hitler pursued power through electoral politics. Exploiting economic devastation and national humiliation from the Treaty of Versailles, the Nazis became Germany's largest party by 1932. Hitler was appointed Chancellor in January 1933 and quickly dismantled the Weimar Republic's democratic framework.",
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 420, outputTokens: 300 },
};

export const QUIZ_FASCISM: ProviderResponse = {
  id: 'msg_wwii_05',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_wwii_05',
      name: 'create_quiz_questions',
      input: {
        questions: [
          {
            type: 'ordering',
            question:
              'Order these events in the rise of European fascism from earliest to latest:',
            items: [
              'Hitler appointed Chancellor of Germany',
              "Mussolini's March on Rome",
              'Beer Hall Putsch',
              "Nazis become Germany's largest party",
            ],
            correctOrder: [1, 2, 3, 0],
          },
          {
            type: 'multiple-choice',
            question:
              'Which country saw the first successful fascist takeover in Europe?',
            options: ['Germany', 'Spain', 'Italy', 'Austria'],
            correctIndex: 2,
          },
          {
            type: 'multiple-choice',
            question: 'What was the Beer Hall Putsch?',
            options: [
              'A successful Nazi election campaign in Munich',
              'A failed coup attempt by Hitler in 1923',
              "Mussolini's march on the Italian parliament",
              'A diplomatic summit between Germany and Italy',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 710, outputTokens: 380 },
};
