/* @meta
{
  "name": "xiaohongshu/feed",
  "description": "获取小红书首页推荐 Feed",
  "domain": "www.xiaohongshu.com",
  "args": {},
  "capabilities": ["network"],
  "readOnly": true
}
*/

async function(args) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const app = document.querySelector('#app')?.__vue_app__;
  const pinia = app?.config?.globalProperties?.$pinia;
  if (!pinia?._s) {
    return {error: 'Page not ready', hint: 'Open xiaohongshu.com and wait for page to finish loading'};
  }

  const feedStore = pinia._s.get('feed');
  if (!feedStore) {
    return {error: 'Feed store not found', hint: 'Ensure xiaohongshu.com is fully loaded'};
  }

  const normalizeNotes = (items) => {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    const notes = [];
    for (const item of items) {
      const noteCard = item?.noteCard || item?.note_card;
      const noteId = item?.id || noteCard?.noteId || noteCard?.note_id;
      const modelType = item?.modelType || item?.model_type;
      if (!noteCard || !noteId || (modelType && modelType !== 'note') || seen.has(noteId)) continue;
      seen.add(noteId);
      notes.push({
        id: noteId,
        xsec_token: item?.xsecToken || item?.xsec_token || noteCard?.xsecToken || noteCard?.xsec_token,
        title: noteCard?.displayTitle || noteCard?.display_title,
        type: noteCard?.type,
        url: 'https://www.xiaohongshu.com/explore/' + noteId,
        author: noteCard?.user?.nickName || noteCard?.user?.nickname,
        author_id: noteCard?.user?.userId || noteCard?.user?.user_id,
        likes: noteCard?.interactInfo?.likedCount || noteCard?.interact_info?.liked_count
      });
    }
    return notes;
  };

  const readFeed = () => {
    const notes = normalizeNotes(feedStore?.feeds);
    if (!notes.length) return null;
    return {
      count: notes.length,
      has_more: typeof feedStore?.hasMore === 'boolean' ? feedStore.hasMore : !!feedStore?.cursorScore || notes.length > 0,
      notes
    };
  };

  const cached = readFeed();
  if (cached) return cached;

  try {
    if (typeof feedStore.fetchFeeds === 'function') {
      await Promise.race([
        Promise.resolve(feedStore.fetchFeeds()),
        sleep(2500)
      ]);
    }
  } catch {}

  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const result = readFeed();
    if (result) return result;
    await sleep(300);
  }

  return {error: 'Feed data did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
}
