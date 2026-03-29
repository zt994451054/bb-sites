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

  let noteId = input;
  const urlMatch = noteId.match(/explore\/([a-z0-9]+)/);
  if (urlMatch) noteId = urlMatch[1];

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = '/explore/' + encodeURIComponent(noteId);
  document.body.appendChild(iframe);

  try {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const app = iframe.contentDocument?.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      const noteStore = pinia?._s?.get('note');
      const note = noteStore?.noteDetailMap?.[noteId]?.note;
      if (note?.title || note?.desc || note?.user?.nickname) {
        return {
          note_id: noteId,
          title: note.title,
          desc: note.desc,
          type: note.type,
          url: 'https://www.xiaohongshu.com/explore/' + noteId,
          author: note.user?.nickname,
          author_id: note.user?.userId || note.user?.user_id,
          likes: note.interactInfo?.likedCount || note.interact_info?.liked_count,
          comments: note.interactInfo?.commentCount || note.interact_info?.comment_count,
          collects: note.interactInfo?.collectedCount || note.interact_info?.collected_count,
          shares: note.interactInfo?.shareCount || note.interact_info?.share_count,
          tags: Array.isArray(note.tagList) ? note.tagList.map(tag => tag.name).filter(Boolean) : [],
          images: Array.isArray(note.imageList)
            ? note.imageList.map(img => img.infoList?.[0]?.url || img.urlDefault || null).filter(Boolean)
            : [],
          created_time: note.time || note.createTime || null
        };
      }

      await sleep(400);
    }

    return {error: 'Note page did not finish loading', hint: 'Note may be deleted or restricted'};
  } finally {
    iframe.remove();
  }
}
