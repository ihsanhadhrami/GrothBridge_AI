import { site } from '../src/data/site';

/**
 * The whole job of the growthbridge-www Worker: send every www request to
 * the apex over HTTPS with a permanent redirect, keeping path and query.
 * The apex comes from site.url, the one place the domain is set.
 */
const apex = new URL(site.url);

export default {
  fetch(request: Request): Response {
    const target = new URL(request.url);
    target.protocol = apex.protocol;
    target.hostname = apex.hostname;
    target.port = '';
    return Response.redirect(target.toString(), 301);
  },
} satisfies ExportedHandler;
