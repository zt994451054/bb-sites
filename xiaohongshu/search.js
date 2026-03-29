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
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = '/search_result?keyword=' + encodeURIComponent(keyword) + '&bb_search_probe=' + Date.now();
  document.body.appendChild(iframe);

  try {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const app = iframe.contentDocument?.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      const searchStore = pinia?._s?.get('search');
      const feeds = Array.isArray(searchStore?.feeds) ? searchStore.feeds : null;
      const isReady = feeds && (feeds.length > 0 || searchStore?.hasMore === false);
      if (isReady) {
        const notes = feeds
          .filter(item => (item.modelType || item.model_type) === 'note' && (item.noteCard || item.note_card))
          .map(item => ({
          id: item.id,
          xsec_token: item.xsecToken || item.xsec_token,
          title: item.noteCard?.displayTitle || item.note_card?.display_title,
          type: item.noteCard?.type || item.note_card?.type,
          url: 'https://www.xiaohongshu.com/explore/' + item.id,
          author: item.noteCard?.user?.nickName || item.noteCard?.user?.nickname || item.note_card?.user?.nickname,
          author_id: item.noteCard?.user?.userId || item.noteCard?.user?.user_id || item.note_card?.user?.user_id,
          likes: item.noteCard?.interactInfo?.likedCount || item.noteCard?.interact_info?.liked_count || item.note_card?.interact_info?.liked_count
          }));

        return {
          keyword,
          count: notes.length,
          has_more: !!searchStore.hasMore,
          notes
        };
      }

      await sleep(400);
    }

    return {error: 'Search page did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
  } finally {
    iframe.remove();
  }
}
