import { PinnedAnswer } from "./PinnedAnswer";

/**
 * Work on the left, the financial answer on the right.
 *
 *   <AnswerLayout>
 *     <AnswerColumn>{what answers "how am I doing?"}</AnswerColumn>
 *     <WorkColumn>{inputs, records, the page's working parts}</WorkColumn>
 *   </AnswerLayout>
 *
 * AnswerColumn goes FIRST, because that is where every one of these pages
 * already puts its answer on a phone. Below a 960px content area the two
 * simply stack in that order, exactly as before. From 960px the answer moves
 * into a 420px column on the right. The DOM never changes order, so screen
 * readers and the keyboard read the page the same way at every width.
 *
 * Layout only: nothing here knows or touches the numbers inside.
 */
export function AnswerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pr-answer-layout-container">
      <div className="pr-answer-layout">{children}</div>
    </div>
  );
}

export function AnswerColumn({ children }: { children: React.ReactNode }) {
  return <PinnedAnswer>{children}</PinnedAnswer>;
}

export function WorkColumn({ children }: { children: React.ReactNode }) {
  return <div className="pr-answer-layout-work">{children}</div>;
}
