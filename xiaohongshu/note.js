/* @meta
{
  "name": "xiaohongshu/note",
  "description": "获取小红书笔记详情（标题、正文、互动数据）",
  "domain": "www.xiaohongshu.com",
  "args": {
    "note_id": {"required": true, "description": "Note ID or URL"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site xiaohongshu/note 69aa7160000000001b01634d"
}
*/

async function(args) {
  const input = String(args.note_id || '').trim();
  if (!input) return {error: 'Missing argument: note_id'};

  const noteId = input.match(/explore\/([a-z0-9]+)/)?.[1] || input;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const parseTotalComments = () => {
    const text = document.querySelector('.comments-container .total')?.textContent || '';
    const match = text.match(/共\s*(\d+)\s*条评论/);
    return match ? Number.parseInt(match[1], 10) : null;
  };

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
  const readNote = () => {
    const entry = noteStore?.noteDetailMap?.[noteId];
    const note = entry?.note;
    if (!note?.title && !note?.desc && !note?.user?.nickname) return null;
    return {
      note_id: noteId,
      title: note.title,
      desc: note.desc,
      type: note.type,
      url: 'https://www.xiaohongshu.com/explore/' + noteId,
      author: note.user?.nickname,
      author_id: note.user?.userId || note.user?.user_id,
      likes: note.interactInfo?.likedCount || note.interact_info?.liked_count,
      comments: note.interactInfo?.commentCount || note.interact_info?.comment_count || parseTotalComments(),
      collects: note.interactInfo?.collectedCount || note.interact_info?.collected_count,
      shares: note.interactInfo?.shareCount || note.interact_info?.share_count,
      tags: Array.isArray(note.tagList) ? note.tagList.map((tag) => tag.name).filter(Boolean) : [],
      images: Array.isArray(note.imageList)
        ? note.imageList.map((img) => img.infoList?.[0]?.url || img.urlDefault || null).filter(Boolean)
        : [],
      created_time: note.time || note.createTime || null
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

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const note = readNote();
    if (note) return note;

    if (isRestrictedPage()) {
      return {error: 'Note is restricted or unavailable on web', hint: 'Retry with another public note'};
    }

    await sleep(300);
  }

  return {error: 'Note page did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
}
