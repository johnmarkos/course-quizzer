// --- Fixture: Coursera Machine Learning (Andrew Ng style) ---

export const SYLLABUS_TEXT = `
Machine Learning

Week 1: Introduction
- What is Machine Learning?
- Supervised vs Unsupervised Learning
- Linear Regression with One Variable
- Cost Function
- Gradient Descent

Week 2: Linear Regression with Multiple Variables
- Multiple Features
- Gradient Descent for Multiple Variables
- Feature Scaling and Normalization
- Normal Equation

Week 3: Classification
- Logistic Regression
- Decision Boundary
- Cost Function for Logistic Regression
- Regularization

Week 4: Neural Networks
- Non-linear Hypotheses
- Neural Network Model Representation
- Forward Propagation
- Backpropagation Algorithm
`;

export const EXPECTED_RESPONSE = {
  id: 'msg_fixture_coursera_ml',
  content: [
    {
      type: 'tool_use' as const,
      id: 'toolu_fixture_2',
      name: 'create_curriculum_plan',
      input: {
        title: 'Machine Learning',
        description:
          'Foundations of machine learning covering supervised learning, regression, classification, and neural networks.',
        sections: [
          {
            id: 'ml-introduction',
            title: 'Introduction to Machine Learning',
            order: 0,
            topics: [
              {
                id: 'ml-definition',
                title: 'What is Machine Learning?',
                description:
                  'Definition of machine learning, types of learning tasks, and real-world applications.',
              },
              {
                id: 'supervised-vs-unsupervised',
                title: 'Supervised vs Unsupervised Learning',
                description:
                  'The difference between learning from labeled data (supervised) and finding patterns in unlabeled data (unsupervised).',
              },
            ],
          },
          {
            id: 'linear-regression',
            title: 'Linear Regression',
            order: 1,
            topics: [
              {
                id: 'single-variable-regression',
                title: 'Linear Regression with One Variable',
                description:
                  'Fitting a line to data with a single feature, making predictions from the model.',
              },
              {
                id: 'cost-function',
                title: 'Cost Function',
                description:
                  'Measuring how well a model fits the data using mean squared error and other metrics.',
              },
              {
                id: 'gradient-descent',
                title: 'Gradient Descent',
                description:
                  'An iterative optimization algorithm that adjusts parameters to minimize the cost function.',
              },
            ],
          },
          {
            id: 'multivariate-regression',
            title: 'Linear Regression with Multiple Variables',
            order: 2,
            topics: [
              {
                id: 'multiple-features',
                title: 'Multiple Features',
                description:
                  'Extending linear regression to handle multiple input features simultaneously.',
              },
              {
                id: 'feature-scaling',
                title: 'Feature Scaling and Normalization',
                description:
                  'Techniques to scale features to similar ranges so gradient descent converges faster.',
              },
              {
                id: 'normal-equation',
                title: 'Normal Equation',
                description:
                  'A closed-form solution for linear regression that finds optimal parameters without iteration.',
              },
            ],
          },
          {
            id: 'classification',
            title: 'Classification',
            order: 3,
            topics: [
              {
                id: 'logistic-regression',
                title: 'Logistic Regression',
                description:
                  'A classification algorithm that predicts probabilities using the sigmoid function.',
              },
              {
                id: 'decision-boundary',
                title: 'Decision Boundary',
                description:
                  'The boundary that separates different classes in the feature space, determined by the model parameters.',
              },
              {
                id: 'regularization',
                title: 'Regularization',
                description:
                  'Techniques to prevent overfitting by penalizing large parameter values in the cost function.',
              },
            ],
          },
          {
            id: 'neural-networks',
            title: 'Neural Networks',
            order: 4,
            topics: [
              {
                id: 'nn-representation',
                title: 'Neural Network Model Representation',
                description:
                  'How neural networks are structured with layers of neurons, weights, and activation functions.',
              },
              {
                id: 'forward-propagation',
                title: 'Forward Propagation',
                description:
                  'Computing the output of a neural network by passing inputs through each layer sequentially.',
              },
              {
                id: 'backpropagation',
                title: 'Backpropagation',
                description:
                  'The algorithm for computing gradients in a neural network to update weights during training.',
              },
            ],
          },
        ],
      },
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stopReason: 'tool_use',
  usage: { inputTokens: 350, outputTokens: 900 },
};
