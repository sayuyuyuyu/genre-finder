/**
 * jsmediatags 3.9.7 には型定義が同梱されていないための最小限の宣言。
 * ブラウザでは `dist/jsmediatags.min.js`（UMD）が使われる。
 */
declare module 'jsmediatags' {
  export interface MediaTag {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
    picture?: { format: string; data: number[] };
  }

  export interface MediaTagsReadResult {
    tags: MediaTag;
  }

  export interface MediaTagsError {
    type: string;
    info?: string;
  }

  export interface MediaTagsReadCallbacks {
    onSuccess: (result: MediaTagsReadResult) => void;
    onError: (error: MediaTagsError) => void;
  }

  export interface JsMediaTags {
    read: (file: File | Blob, callbacks: MediaTagsReadCallbacks) => void;
  }

  const jsmediatags: JsMediaTags;
  export default jsmediatags;
}

declare module 'jsmediatags/dist/jsmediatags.min.js' {
  import type { JsMediaTags } from 'jsmediatags';
  const jsmediatags: JsMediaTags;
  export default jsmediatags;
}
