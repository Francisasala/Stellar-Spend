export interface PaginationParams {
  cursor?: string | null;
  limit?: number;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Decode a cursor to get the offset.
 * Cursor is a base64-encoded offset value.
 */
export function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const offset = parseInt(decoded, 10);
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

/**
 * Encode an offset to create a cursor.
 * Cursor is a base64-encoded offset value.
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(offset.toString(), 'utf-8').toString('base64');
}

/**
 * Create a paginated response with cursor for the next page.
 * Returns `null` cursor if there are no more items.
 */
export function createPaginatedResponse<T>(
  data: T[],
  cursor: number,
  limit: number,
  totalAvailable: number,
): PaginationResponse<T> {
  const hasMore = cursor + limit < totalAvailable;
  const nextCursor = hasMore ? encodeCursor(cursor + limit) : undefined;

  return {
    data,
    pagination: {
      cursor: nextCursor,
      hasMore,
      limit,
    },
  };
}
