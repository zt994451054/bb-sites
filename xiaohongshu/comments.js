/* @meta
{
  "name": "xiaohongshu/comments",
  "description": "获取小红书笔记的评论列表",
  "domain": "www.xiaohongshu.com",
  "args": {
    "note_id": {"required": true, "description": "Note ID"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site xiaohongshu/comments 69aa7160000000001b01634d"
}
*/

async function(args) {
  const input = String(args.note_id || '').trim();
  if (!input) return {error: 'Missing argument: note_id'};

  const noteId = input.match(/explore\/([a-z0-9]+)/)?.[1] || input;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const app = document.querySelector('#app')?.__vue_app__;
  const globals = app?.config?.globalProperties;
  const pinia = globals?.$pinia;
  const router = globals?.$router;
  if (!pinia?._s || !router) {
    return {error: 'Page not ready', hint: 'Open xiaohongshu.com and wait for page to finish loading'};
  }

  const noteStore = pinia._s.get('note');
  if (!noteStore) {
    return {error: 'Note store not found', hint: 'Ensure xiaohongshu.com is fully loaded'};
  }

  const targetPath = '/explore/' + encodeURIComponent(noteId);
  const getCurrentPath = () => globals?.$route?.path || location.pathname;
  const isRestrictedPage = () => {
    const pageText = document.body?.innerText || '';
    return /当前笔记暂时无法浏览|请打开小红书App扫码查看|你访问的页面不见了/.test(pageText) || getCurrentPath() === '/404';
  };
  const parseTotalComments = () => {
    const text = document.querySelector('.comments-container .total')?.textContent || '';
    const match = text.match(/共\s*(\d+)\s*条评论/);
    return match ? Number.parseInt(match[1], 10) : null;
  };
  const normalizeStoreComments = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map((comment) => ({
      id: comment.id,
      author: comment.userInfo?.nickname || comment.user_info?.nickname,
      author_id: comment.userInfo?.userId || comment.userInfo?.user_id || comment.user_info?.userId || comment.user_info?.user_id,
      content: comment.content,
      likes: comment.likeCount || comment.like_count || null,
      sub_comment_count: comment.subCommentCount || comment.sub_comment_count || 0,
      created_time: comment.createTime || comment.create_time || null
    }));
  };
  const normalizeDomComments = () => {
    const items = Array.from(document.querySelectorAll('.comments-container .parent-comment > .comment-item'));
    const seen = new Set();
    const comments = [];
    for (const item of items) {
      const id = item.id?.replace(/^comment-/, '') || null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const replyText = item.querySelector('.interactions .reply .count')?.textContent?.trim() || '';
      const replyMatch = replyText.match(/\d+/);
      comments.push({
        id,
        author: item.querySelector('.author .name')?.textContent?.trim() || null,
        author_id: item.querySelector('.author .name')?.getAttribute('data-user-id') || null,
        content: item.querySelector('.content .note-text')?.innerText?.trim() || item.querySelector('.content')?.innerText?.trim() || null,
        likes: null,
        sub_comment_count: replyMatch ? Number.parseInt(replyMatch[0], 10) : 0,
        created_time: null
      });
    }
    return comments;
  };
  const readComments = () => {
    const entry = noteStore?.noteDetailMap?.[noteId];
    const storeComments = normalizeStoreComments(entry?.comments?.list);
    const domComments = normalizeDomComments();
    const totalCount = parseTotalComments();
    const comments = storeComments.length > 0 ? storeComments : domComments;
    const isReady = comments.length > 0 || entry?.comments?.firstRequestFinish || totalCount !== null;
    if (!isReady) return null;
    return {
      count: comments.length,
      total_count: totalCount,
      has_more: typeof entry?.comments?.hasMore === 'boolean'
        ? entry.comments.hasMore
        : totalCount !== null && comments.length < totalCount,
      comments
    };
  };

  if (getCurrentPath() !== targetPath) {
    try {
      await router.push(targetPath);
    } catch {}
  }

  try {
    noteStore.setCurrentNoteId(noteId);
  } catch {}
  try {
    const pending = noteStore.getNoteDetailByNoteId?.(noteId);
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch {}

  const deadline = Date.now() + 18_000;
  while (Date.now() < deadline) {
    const result = readComments();
    if (result) {
      return {
        note_id: noteId,
        count: result.count,
        total_count: result.total_count,
        has_more: result.has_more,
        comments: result.comments
      };
    }

    if (isRestrictedPage()) {
      return {error: 'Note is restricted or unavailable on web', hint: 'Retry with another public note'};
    }

    await sleep(300);
  }

  return {error: 'Comments did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
}
