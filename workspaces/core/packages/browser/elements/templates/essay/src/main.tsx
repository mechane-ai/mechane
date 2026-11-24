import '@mechane-ai/elements/styles.css';
import { checkLesson, validateLessonPlan } from '@mechane-ai/elements/lesson/spec';
import { Essay } from '@mechane-ai/elements/mdx';
import { themeProps } from '@mechane-ai/elements/theme';
import { colors, spacing } from '@mechane-ai/elements/tokens';
import { createRoot } from 'react-dom/client';
import plan from '../plan.json';
import Content, { meta } from './essay.mdx';
import { lesson } from './lesson.ts';

const PAGE_WIDTH = 1200;

const theme = matchMedia('(prefers-color-scheme: dark)').matches ? themeProps.dark : themeProps.light;

document.documentElement.className = theme.className ?? '';
document.body.style.backgroundColor = colors.surface;

/** Lists what `plan.json` and the lesson still get wrong, so an author or an agent sees it beside the essay. */
function Findings() {
  const findings = [...validateLessonPlan(plan).findings, ...checkLesson(lesson)];

  if (findings.length === 0) {
    return null;
  }

  return (
    <details open>
      <summary>Lesson checks</summary>
      <ul>
        {findings.map((finding) => (
          <li
            key={`${finding.path} ${finding.message}`}
          >{`${finding.severity} at ${finding.path}: ${finding.message}`}</li>
        ))}
      </ul>
    </details>
  );
}

const root = document.querySelector('#root');

if (root === null) {
  throw new Error('index.html has no #root element.');
}

createRoot(root).render(
  <main
    style={{ boxSizing: 'border-box', maxWidth: PAGE_WIDTH, margin: '0 auto', padding: `${spacing.xxl} ${spacing.lg}` }}
  >
    <Essay lesson={lesson} content={Content} locale="en-US" storageKey={lesson.id} {...meta} />
    <Findings />
  </main>,
);
