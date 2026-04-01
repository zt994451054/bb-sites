/* @meta
{
  "name": "xiaohongshu/user_posts",
  "description": "获取小红书用户的笔记列表",
  "domain": "www.xiaohongshu.com",
  "args": {
    "user_id": {"required": true, "description": "User ID"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site xiaohongshu/user_posts 5a927d8411be10720ae9e1e4"
}
*/

async function(args) {
  const input = String(args.user_id || '').trim();
  if (!input) return {error: 'Missing argument: user_id'};

  const userId = input.match(/user\/profile\/([a-z0-9]+)/)?.[1] || input;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const noteIdToTime = (noteId) => {
    const hex = String(noteId || '').slice(0, 8);
    if (!/^[0-9a-f]{8}$/i.test(hex)) return null;
    const seconds = Number.parseInt(hex, 16);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  };
  const flattenNotes = (pages) => {
    if (!Array.isArray(pages)) return [];
    const flattened = [];
    for (const page of pages) {
      if (!Array.isArray(page)) continue;
      flattened.push(...page);
    }
    return flattened;
  };
  const uniqueNotes = (items) => {
    const seen = new Set();
    const notes = [];
    for (const item of items) {
      const noteId = item?.id || item?.noteCard?.noteId || item?.note_card?.note_id;
      if (!noteId || seen.has(noteId)) continue;
      seen.add(noteId);
      notes.push(item);
    }
    return notes;
  };

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = '/user/profile/' + encodeURIComponent(userId);
  document.body.appendChild(iframe);

  try {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const app = iframe.contentDocument?.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      const userStore = pinia?._s?.get('user');
      const rawNotes = uniqueNotes(flattenNotes(userStore?.notes));
      const hasUserPageData = !!(userStore?.userPageData && Object.keys(userStore.userPageData).length > 0);
      const isReady = userStore?.visitTargetUserId === userId && (rawNotes.length > 0 || hasUserPageData);
      if (isReady) {
        const noteQuery = Array.isArray(userStore?.noteQueries)
          ? userStore.noteQueries.find(query => query?.userId === userId)
          : null;
        const notes = rawNotes.map(item => {
          const noteCard = item.noteCard || item.note_card || {};
          const noteId = item.id || noteCard.noteId || noteCard.note_id;
          return {
            note_id: noteId,
            xsec_token: item.xsecToken || item.xsec_token || noteCard.xsecToken || noteCard.xsec_token,
            title: noteCard.displayTitle || noteCard.display_title,
            type: noteCard.type,
            url: 'https://www.xiaohongshu.com/explore/' + noteId,
            author: noteCard.user?.nickName || noteCard.user?.nickname,
            author_id: noteCard.user?.userId || noteCard.user?.user_id,
            likes: noteCard.interactInfo?.likedCount || noteCard.interact_info?.liked_count,
            // User profile cards omit publish timestamps, so fall back to the note id's embedded creation time.
            time: noteCard.time || noteCard.publishTime || noteCard.createTime || item.time || item.publishTime || item.createTime || item.lastUpdateTime || item.last_update_time || noteIdToTime(noteId)
          };
        });

        return {
          user_id: userId,
          count: notes.length,
          has_more: typeof noteQuery?.hasMore === 'boolean' ? noteQuery.hasMore : notes.length >= 30,
          notes
        };
      }

      await sleep(400);
    }

    return {error: 'User posts page did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
  } finally {
    iframe.remove();
  }
}
