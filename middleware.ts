import { publicRouteResponse } from './src/storefront/publicRouting';

export default function middleware(request: Request): Response | undefined {
  return publicRouteResponse(request, process.env.VERCEL_ENV === 'preview');
}
