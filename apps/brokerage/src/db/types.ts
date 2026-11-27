/** The subset of pg's Pool / Client that repositories need. */
export interface Queryable {
  query<R = any>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
}
