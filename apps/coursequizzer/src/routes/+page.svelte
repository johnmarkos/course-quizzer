<script lang="ts">
  import { CourseEngine } from 'quizzer-engine';

  const engine = new CourseEngine({ apiKey: 'not-a-real-key' });

  let engineState = $state(engine.state);

  engine.on('stateChange', ({ to }) => {
    engineState = to;
  });

  const snapshot = engine.serialize();
</script>

<main>
  <h1>CourseQuizzer</h1>
  <p>Adaptive course material from any syllabus, powered by Claude.</p>

  <nav>
    <a href="/settings">Settings</a>
  </nav>

  <section>
    <h2>Engine Status</h2>
    <p>State: <code>{engineState}</code></p>
    <p>Snapshot: <code>{JSON.stringify(snapshot)}</code></p>
  </section>
</main>
