/* @meta
{
  "name": "xiaohongshu/me",
  "description": "获取当前小红书登录用户信息",
  "domain": "www.xiaohongshu.com",
  "args": {},
  "capabilities": ["network"],
  "readOnly": true
}
*/

async function(args) {
  const app = document.querySelector('#app')?.__vue_app__;
  const pinia = app?.config?.globalProperties?.$pinia;
  if (!pinia?._s) return {error: 'Page not ready', hint: 'Ensure xiaohongshu.com is fully loaded'};

  const userStore = pinia._s.get('user');
  if (!userStore) return {error: 'User store not found', hint: 'Not logged in?'};

  let user = userStore.userInfo;
  const userId = user?.userId || user?.user_id;
  if (!userId && userStore.getUserInfo) {
    try {
      await userStore.getUserInfo();
    } catch {}
    await new Promise(r => setTimeout(r, 500));
    user = userStore.userInfo;
  }

  const resolvedUserId = user?.userId || user?.user_id;
  if (!resolvedUserId) return {error: 'Failed to get user info', hint: 'Not logged in?'};

  return {
    nickname: user.nickname,
    red_id: user.redId || user.red_id,
    desc: user.desc,
    gender: user.gender,
    userid: resolvedUserId,
    url: 'https://www.xiaohongshu.com/user/profile/' + resolvedUserId
  };
}
