/** 判定結果を URL で共有できるようにする。`?t=曲名&a=アーティスト`。 */
export interface SharedQuery {
  title: string;
  artist?: string;
}

export function readSharedQuery(search: string): SharedQuery | null {
  const params = new URLSearchParams(search);
  const title = params.get('t')?.trim();
  if (!title) return null;
  const artist = params.get('a')?.trim();
  return artist ? { title, artist } : { title };
}

export function sharedQueryString(query: SharedQuery): string {
  const params = new URLSearchParams();
  params.set('t', query.title);
  if (query.artist) params.set('a', query.artist);
  return `?${params.toString()}`;
}
