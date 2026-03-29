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
  const flattenNotes = (pages) => {
    if (!Array.isArray(pages)) return [];
    const flattened = [];
    for (const page of pages) {
      if (!Array.isArray(page)) continue;
      flattened.push(...page);
    }
    return flattened;
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
      const rawNotes = flattenNotes(userStore?.notes);
      const hasUserPageData = !!(userStore?.userPageData && Object.keys(userStore.userPageData).length > 0);
      const isReady = userStore?.visitTargetUserId === userId && (rawNotes.length > 0 || hasUserPageData);
      if (isReady) {
        const notes = rawNotes.map(item => ({
          note_id: item.id,
          xsec_token: item.xsecToken || item.xsec_token,
          title: item.noteCard?.displayTitle || item.note_card?.display_title,
          type: item.noteCard?.type || item.note_card?.type,
          url: 'https://www.xiaohongshu.com/explore/' + item.id,
          author: item.noteCard?.user?.nickName || item.noteCard?.user?.nickname || item.note_card?.user?.nickname,
          author_id: item.noteCard?.user?.userId || item.noteCard?.user?.user_id || item.note_card?.user?.user_id,
          likes: item.noteCard?.interactInfo?.likedCount || item.noteCard?.interact_info?.liked_count || item.note_card?.interact_info?.liked_count,
          time: item.noteCard?.time || item.noteCard?.publishTime || item.note_card?.time || null
        }));

        return {
          user_id: userId,
          count: notes.length,
          has_more: notes.length >= 30,
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
