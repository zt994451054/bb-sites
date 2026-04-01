/* @meta
{
  "name": "xiaohongshu/profile",
  "description": "获取小红书用户主页画像（基础信息、互动数据、标签、笔记列表）",
  "domain": "www.xiaohongshu.com",
  "args": {
    "user_id": {"required": true, "description": "User ID or profile URL"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site xiaohongshu/profile 58a9bd2050c4b4715477257f"
}
*/

async function(args) {
  const input = String(args.user_id || '').trim();
  if (!input) return {error: 'Missing argument: user_id'};

  const userId = input.match(/user\/profile\/([a-z0-9]+)/)?.[1] || input;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const noteIdToTime = (noteId) => {
    const hex = String(noteId || '').slice(0, 8);
    if (!/^[0-9a-f]{8}$/i.test(hex)) return null;
    const seconds = Number.parseInt(hex, 16);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  };
  const parseCount = (value) => {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value).trim().replace(/,/g, '');
    if (!text) return null;
    const match = text.match(/^([0-9]+(?:\.[0-9]+)?)([万亿千]?)$/);
    if (!match) {
      const raw = Number(text);
      return Number.isFinite(raw) ? raw : null;
    }
    const num = Number(match[1]);
    if (!Number.isFinite(num)) return null;
    const unit = match[2];
    const multiplier = unit === '亿' ? 1e8 : unit === '万' ? 1e4 : unit === '千' ? 1e3 : 1;
    return Math.round(num * multiplier);
  };
  const flattenNotes = (pages) => {
    if (!Array.isArray(pages)) return [];
    const flattened = [];
    for (const page of pages) {
      if (Array.isArray(page)) {
        flattened.push(...page);
      } else if (page && typeof page === 'object') {
        flattened.push(page);
      }
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
  const normalizeTags = (tags) => {
    if (!Array.isArray(tags)) return [];
    return tags.map((tag) => ({
      tagType: tag?.tagType || '',
      name: tag?.name || '',
      icon: tag?.icon || ''
    }));
  };
  const normalizeInteractions = (interactions) => {
    if (!Array.isArray(interactions)) return [];
    return interactions.map((item) => ({
      type: item?.type || '',
      name: item?.name || '',
      count: item?.count == null ? '' : String(item.count),
      countValue: parseCount(item?.count)
    }));
  };
  const pickInteractionCount = (interactions, matchers) => {
    const found = interactions.find((item) => {
      const type = String(item?.type || '');
      const name = String(item?.name || '');
      return matchers.some((matcher) => type.includes(matcher) || name.includes(matcher));
    });
    return found?.countValue ?? null;
  };
  const normalizeFeeds = (items) => {
    return uniqueNotes(flattenNotes(items)).map((item) => {
      const noteCard = item?.noteCard || item?.note_card || {};
      const noteId = item?.id || noteCard?.noteId || noteCard?.note_id;
      const xsecToken = item?.xsecToken || item?.xsec_token || noteCard?.xsecToken || noteCard?.xsec_token || '';
      const user = noteCard?.user || {};
      const interactInfo = noteCard?.interactInfo || noteCard?.interact_info || {};
      const cover = noteCard?.cover || {};
      const time = noteCard?.time || noteCard?.publishTime || noteCard?.createTime || item?.time || item?.publishTime || item?.createTime || item?.lastUpdateTime || item?.last_update_time || noteIdToTime(noteId);
      return {
        id: noteId,
        xsecToken,
        displayTitle: noteCard?.displayTitle || noteCard?.display_title || '',
        type: noteCard?.type || item?.type || '',
        time: time || null,
        noteCard: {
          noteId,
          xsecToken,
          displayTitle: noteCard?.displayTitle || noteCard?.display_title || '',
          type: noteCard?.type || item?.type || '',
          user: {
            userId: user?.userId || user?.user_id || '',
            nickname: user?.nickname || user?.nickName || '',
            nickName: user?.nickName || user?.nickname || ''
          },
          interactInfo: {
            likedCount: interactInfo?.likedCount || interactInfo?.liked_count || ''
          },
          cover: {
            urlPre: cover?.urlPre || '',
            urlDefault: cover?.urlDefault || '',
            infoList: Array.isArray(cover?.infoList) ? cover.infoList : []
          }
        }
      };
    });
  };
  const calcPostCount30d = (feeds) => {
    const now = Date.now();
    return feeds.filter((feed) => {
      const time = Number(feed?.time || 0);
      return time > 0 && now - time <= 30 * 24 * 60 * 60 * 1000;
    }).length;
  };
  const calcLastPostAt = (feeds) => {
    const values = feeds.map((feed) => Number(feed?.time || 0)).filter((v) => v > 0);
    return values.length ? Math.max(...values) : null;
  };
  const inferVerifyType = (verifyInfo) => {
    if (!verifyInfo || typeof verifyInfo !== 'object' || Object.keys(verifyInfo).length === 0) return '';
    const rawType = verifyInfo.redOfficialVerifyType ?? verifyInfo.officialVerifyType ?? verifyInfo.verifyType ?? null;
    if (rawType === 2 || rawType === '2' || rawType === 'enterprise') return '企业';
    return '个人';
  };

  const root = document.body || document.documentElement;
  if (!root) return {error: 'Page not ready', hint: 'Open xiaohongshu.com and wait for page to finish loading'};

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = '/user/profile/' + encodeURIComponent(userId);
  root.appendChild(iframe);

  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      const state = win?.__INITIAL_STATE__;
      const pageDataContainer = state?.user?.userPageData;
      const notesContainer = state?.user?.notes;
      const pageData = pageDataContainer && (pageDataContainer.value || pageDataContainer._value || pageDataContainer);
      const notesRaw = notesContainer && (notesContainer.value || notesContainer._value || notesContainer);
      const basicInfo = pageData?.basicInfo || null;
      const interactions = normalizeInteractions(pageData?.interactions);
      const tags = normalizeTags(pageData?.tags);
      const verifyInfo = pageData?.verifyInfo || null;
      const extraInfo = pageData?.extraInfo || null;
      const feeds = normalizeFeeds(notesRaw);
      const ready = !!pageData && (!!basicInfo || interactions.length > 0 || feeds.length > 0 || tags.length > 0);

      if (ready) {
        const followingCount = pickInteractionCount(interactions, ['follows', '关注']);
        const fansCount = pickInteractionCount(interactions, ['fans', '粉丝']);
        const likesAndFavsCount = pickInteractionCount(interactions, ['interaction', '获赞', '收藏', '点赞']);
        const locationTags = tags.filter((tag) => tag.tagType === 'location').map((tag) => tag.name).filter(Boolean);
        const categoryTags = tags.filter((tag) => tag.tagType === 'profession').map((tag) => tag.name).filter(Boolean);
        const verifyType = inferVerifyType(verifyInfo);
        const verified = !!verifyType;
        const profileUrl = 'https://www.xiaohongshu.com/user/profile/' + userId;

        return {
          userId,
          profileUrl,
          basicInfo: {
            nickname: basicInfo?.nickname || '',
            redId: basicInfo?.redId || '',
            desc: basicInfo?.desc || '',
            gender: basicInfo?.gender || 0,
            ipLocation: basicInfo?.ipLocation || '',
            images: basicInfo?.images || '',
            imageb: basicInfo?.imageb || ''
          },
          interactions,
          tags,
          verifyInfo,
          extraInfo,
          feeds,
          stats: {
            verified,
            verifyType,
            followingCount,
            fansCount,
            likesAndFavsCount,
            noteCount: feeds.length,
            lastPostAt: calcLastPostAt(feeds),
            postCount30d: calcPostCount30d(feeds),
            categoryTags,
            locationTags
          }
        };
      }

      const pageText = doc?.body?.innerText || '';
      if (/页面不见了|当前内容无法展示|请登录后查看/.test(pageText)) {
        return {error: 'Profile page is unavailable or restricted', hint: 'Retry with another public profile while logged in'};
      }

      await sleep(400);
    }

    return {error: 'Profile page did not finish loading', hint: 'Retry while logged in to xiaohongshu.com'};
  } finally {
    iframe.remove();
  }
}
