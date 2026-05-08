import type { NextRequest } from 'next/server';

export type PageParams = {
  limit: number;   // capped at 200
  offset: number;
  page: number;    // 1-indexed
};

// Parse ?limit=&offset=&page= from query string.
// Defaults: limit=50 (capped at 200), offset=0.
// If `page` is provided (1-indexed), it overrides offset.
export function parsePageParams(request: NextRequest): PageParams {
  const sp = request.nextUrl.searchParams;
  const rawLimit = parseInt(sp.get('limit') || '50', 10);
  const limit = Math.min(200, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));

  let offset = parseInt(sp.get('offset') || '0', 10);
  if (isNaN(offset) || offset < 0) offset = 0;

  const rawPage = sp.get('page');
  const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : Math.floor(offset / limit) + 1;
  if (rawPage) offset = (page - 1) * limit;

  return { limit, offset, page };
}

// Wrap a list response with pagination metadata.
export function pageResponse<T>(rows: T[], total: number, params: PageParams) {
  return {
    rows,
    total,
    limit: params.limit,
    offset: params.offset,
    page: params.page,
    pageCount: Math.ceil(total / params.limit),
    hasMore: params.offset + rows.length < total,
  };
}
