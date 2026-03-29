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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = '/explore/' + encodeURIComponent(noteId);
  document.body.appendChild(iframe);

  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const app = iframe.contentDocument?.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      const noteStore = pinia?._s?.get('note');
      const entry = noteStore?.noteDetailMap?.[noteId];
      const list = Array.isArray(entry?.comments?.list) ? entry.comments.list : [];
      const isReady = list.length > 0 || entry?.comments?.firstRequestFinish;
      if (isReady) {
        const comments = list.map(comment => ({
          id: comment.id,
          author: comment.userInfo?.nickname,
          author_id: comment.userInfo?.userId,
          content: comment.content,
          likes: comment.likeCount,
          sub_comment_count: comment.subCommentCount,
          created_time: comment.createTime
        }));

        return {
          note_id: noteId,
          count: comments.length,
          has_more: !!entry.comments.hasMore,
          comments
        };
      }

      await sleep(400);
    }

    return {error: 'Comments page did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
  } finally {
    iframe.remove();
  }
}
