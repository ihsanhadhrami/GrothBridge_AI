import { Layout } from './components/Layout';
import { matchRoute, normalisePath } from './routes';

export function App({ path }: { path: string }) {
  const route = matchRoute(path);
  return <Layout path={normalisePath(path)}>{route.render()}</Layout>;
}
