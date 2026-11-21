import { renderToString } from 'react-dom/server';
import { App } from './App';
import { notFound, routes } from './routes';
import { headTags } from './seo';
import { site } from './data/site';

/** Used only at build time by scripts/prerender.mjs. */
export function render(path: string): { html: string } {
  return { html: renderToString(<App path={path} />) };
}

export const pages = [...routes, notFound].map((r) => ({
  path: r.meta.path,
  noindex: Boolean(r.meta.noindex),
  head: headTags(r.meta),
  title: r.meta.title,
}));

export const siteUrl = site.url;
