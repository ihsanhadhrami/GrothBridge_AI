import type { ReactNode } from 'react';
import { Bars } from './Mark';
import { Highlight } from './Highlight';

/**
 * Opening for the secondary pages (legal, contact, thank-you, Siap Pasang,
 * 404): the title at display size, one supporting line, then the mark's bars
 * as one full-width band.
 */
export function PageHead({
  id,
  title,
  titleMark,
  children,
}: {
  id: string;
  title: string;
  /** Opening words of the title to set on a green slab (sales pages only). */
  titleMark?: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-head" aria-labelledby={id}>
      <div className="frame">
        <h1 id={id} className="page-head-title">
          <Highlight text={title} mark={titleMark} />
        </h1>
        {children && <div className="page-head-lead">{children}</div>}
        <Bars className="page-head-bars" live />
      </div>
    </section>
  );
}
