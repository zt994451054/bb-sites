/* @meta
{
  "name": "xiaohongshu/search",
  "description": "搜索小红书笔记",
  "domain": "www.xiaohongshu.com",
  "args": {
    "keyword": {"required": true, "description": "Search keyword"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site xiaohongshu/search 美食"
}
*/

async function(args) {
  const keyword = String(args.keyword || '').trim();
  if (!keyword) return {error: 'Missing argument: keyword'};

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
  const root = document.body || document.documentElement;
  if (!root) return {error: 'Page not ready', hint: 'Open xiaohongshu.com and wait for page to finish loading'};

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = '/search_result/?keyword=' + encodeURIComponent(keyword) + '&source=web_explore_feed&type=51&bb_search_probe=' + Date.now();
  root.appendChild(iframe);

  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const doc = iframe.contentDocument;
      const app = doc?.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      const userStore = pinia?._s?.get('user');
      const searchStore = pinia?._s?.get('search');
      const storeKeyword = String(searchStore?.searchValue || searchStore?.searchContext?.keyword || '').trim();
      const notes = normalizeNotes(searchStore?.feeds);
      const pageText = doc?.body?.innerText || '';

      if ((userStore?.loggedIn === false || userStore?.userInfo?.guest) && /登录后查看搜索结果|请登录/.test(pageText)) {
        return {
          error: 'Search requires a fully logged-in xiaohongshu session',
          hint: 'Current browser session is guest/tourist. Log in to xiaohongshu.com and retry.'
        };
      }

      if (storeKeyword === keyword && notes.length > 0) {
        return {
          keyword,
          count: notes.length,
          has_more: !!searchStore?.hasMore,
          notes
        };
      }

      if (storeKeyword === keyword && (searchStore?.hasMore === false || /没有找到相关结果|暂无搜索结果/.test(pageText))) {
        return {
          keyword,
          count: 0,
          has_more: false,
          notes: []
        };
      }

      await sleep(300);
    }

    return {error: 'Search page did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
  } finally {
    iframe.remove();
  }
}
