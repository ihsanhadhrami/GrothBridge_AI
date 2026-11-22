/**
 * A headline whose opening words sit on a green slab, like selected text.
 * `mark` must be the start of `text`; the rest starts on a new line. If it
 * isn't (copy changed), the title renders plain rather than wrong.
 */
export function Highlight({ text, mark }: { text: string; mark?: string }) {
  if (!mark || !text.startsWith(mark)) return <>{text}</>;
  return (
    <>
      <span className="hl">{mark}</span>
      <br />
      {text.slice(mark.length).trimStart()}
    </>
  );
}
