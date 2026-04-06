// --- Fixture: MIT OCW Introduction to Algorithms ---
// Recorded fixture for deterministic testing of syllabus analysis.

export const SYLLABUS_TEXT = `
MIT 6.006 Introduction to Algorithms

Course Overview:
This course is an introduction to mathematical modeling of computational problems,
as well as common algorithms, algorithmic paradigms, and data structures used to
solve these problems. It emphasizes the relationship between algorithms and programming,
and introduces basic performance measures and analysis techniques.

Topics:
1. Algorithmic Thinking, Peak Finding
2. Sorting and Trees: Insertion Sort, Merge Sort, Heaps, BSTs
3. Hashing: Hash Functions, Chaining, Open Addressing
4. Numerics: Integer Arithmetic, Karatsuba Multiplication
5. Graphs: BFS, DFS, Topological Sort
6. Shortest Paths: Dijkstra, Bellman-Ford
7. Dynamic Programming: Fibonacci, Shortest Paths, Text Justification, Knapsack
8. Advanced Topics: Computational Complexity, NP-Completeness

Prerequisites: 6.0001 (Introduction to CS and Programming Using Python)
Textbook: Introduction to Algorithms, Cormen et al. (CLRS)
`;

export const EXPECTED_RESPONSE = {
  id: 'msg_fixture_mit_algo',
  content: [
    {
      type: 'tool_use' as const,
      id: 'toolu_fixture_1',
      name: 'create_curriculum_plan',
      input: {
        title: 'Introduction to Algorithms',
        description:
          'Mathematical modeling of computational problems with common algorithms, data structures, and analysis techniques.',
        sections: [
          {
            id: 'algorithmic-thinking',
            title: 'Algorithmic Thinking and Peak Finding',
            order: 0,
            topics: [
              {
                id: 'computational-problems',
                title: 'Computational Problem Modeling',
                description:
                  'How to model real-world problems as computational problems with well-defined inputs, outputs, and correctness criteria.',
              },
              {
                id: 'peak-finding',
                title: 'Peak Finding',
                description:
                  'Finding a peak element in 1D and 2D arrays, and how algorithm design choices affect performance.',
              },
            ],
          },
          {
            id: 'sorting-and-trees',
            title: 'Sorting and Trees',
            order: 1,
            topics: [
              {
                id: 'insertion-sort',
                title: 'Insertion Sort',
                description:
                  'A simple comparison-based sorting algorithm that builds the sorted array one element at a time.',
              },
              {
                id: 'merge-sort',
                title: 'Merge Sort',
                description:
                  'A divide-and-conquer sorting algorithm with O(n log n) worst-case time complexity.',
              },
              {
                id: 'heaps',
                title: 'Heaps and Priority Queues',
                description:
                  'Binary heap data structure, heap operations, and its use in implementing priority queues.',
              },
              {
                id: 'binary-search-trees',
                title: 'Binary Search Trees',
                description:
                  'BST properties, insertion, deletion, and search operations with their time complexities.',
              },
            ],
          },
          {
            id: 'hashing',
            title: 'Hashing',
            order: 2,
            topics: [
              {
                id: 'hash-functions',
                title: 'Hash Functions',
                description:
                  'Properties of good hash functions, universal hashing, and how to map keys to table indices.',
              },
              {
                id: 'collision-resolution',
                title: 'Collision Resolution',
                description:
                  'Chaining and open addressing strategies for handling hash collisions, with performance analysis.',
              },
            ],
          },
          {
            id: 'numerics',
            title: 'Numerics',
            order: 3,
            topics: [
              {
                id: 'integer-arithmetic',
                title: 'Integer Arithmetic',
                description:
                  'Algorithms for basic integer operations and their computational complexity.',
              },
              {
                id: 'karatsuba',
                title: 'Karatsuba Multiplication',
                description:
                  'A divide-and-conquer algorithm for fast multiplication that improves on the naive O(n²) approach.',
              },
            ],
          },
          {
            id: 'graphs',
            title: 'Graphs',
            order: 4,
            topics: [
              {
                id: 'bfs',
                title: 'Breadth-First Search',
                description:
                  'BFS algorithm for exploring graphs level by level, finding shortest paths in unweighted graphs.',
              },
              {
                id: 'dfs',
                title: 'Depth-First Search',
                description:
                  'DFS algorithm for exploring graphs by going deep before backtracking, edge classification.',
              },
              {
                id: 'topological-sort',
                title: 'Topological Sort',
                description:
                  'Ordering vertices of a directed acyclic graph such that every edge goes from earlier to later.',
              },
            ],
          },
          {
            id: 'shortest-paths',
            title: 'Shortest Paths',
            order: 5,
            topics: [
              {
                id: 'dijkstra',
                title: "Dijkstra's Algorithm",
                description:
                  'Finding shortest paths from a single source in graphs with non-negative edge weights.',
              },
              {
                id: 'bellman-ford',
                title: 'Bellman-Ford Algorithm',
                description:
                  'Finding shortest paths with negative edge weights and detecting negative cycles.',
              },
            ],
          },
          {
            id: 'dynamic-programming',
            title: 'Dynamic Programming',
            order: 6,
            topics: [
              {
                id: 'dp-fundamentals',
                title: 'DP Fundamentals',
                description:
                  'The principle of optimal substructure and overlapping subproblems, memoization vs. tabulation.',
              },
              {
                id: 'dp-applications',
                title: 'DP Applications',
                description:
                  'Applying dynamic programming to Fibonacci, shortest paths, text justification, and knapsack problems.',
              },
            ],
          },
          {
            id: 'computational-complexity',
            title: 'Computational Complexity',
            order: 7,
            topics: [
              {
                id: 'complexity-classes',
                title: 'Complexity Classes',
                description:
                  'P, NP, and NP-Complete complexity classes and what they mean for algorithm efficiency.',
              },
              {
                id: 'np-completeness',
                title: 'NP-Completeness',
                description:
                  'How to prove a problem is NP-Complete using reductions, and implications for finding solutions.',
              },
            ],
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 450, outputTokens: 1200 },
};
