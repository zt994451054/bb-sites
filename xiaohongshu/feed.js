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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = '/explore?bb_feed_probe=' + Date.now();
  document.body.appendChild(iframe);

  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const app = iframe.contentDocument?.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      const feedStore = pinia?._s?.get('feed');
      const feeds = Array.isArray(feedStore?.feeds) ? feedStore.feeds : null;
      if (feedStore && feeds && feeds.length > 0) {
        const notes = feeds.map(item => ({
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
          count: notes.length,
          has_more: notes.length > 0,
          notes
        };
      }

      await sleep(400);
    }

    return {error: 'Feed page did not finish loading', hint: 'Ensure xiaohongshu.com is fully loaded'};
  } finally {
    iframe.remove();
  }
}
