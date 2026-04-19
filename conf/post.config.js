/**
 * Post-related features.
 */
module.exports = {
  // Default prefix for post URLs, e.g. /article/[slug]
  POST_URL_PREFIX: process.env.NEXT_PUBLIC_POST_URL_PREFIX ?? 'article',

  // Auto control visibility by scheduled publish time in Notion.
  POST_SCHEDULE_PUBLISH:
    process.env.NEXT_PUBLIC_NOTION_SCHEDULE_PUBLISH || true,

  // Share bar config
  POST_SHARE_BAR_ENABLE: process.env.NEXT_PUBLIC_POST_SHARE_BAR || 'true',
  POSTS_SHARE_SERVICES:
    process.env.NEXT_PUBLIC_POST_SHARE_SERVICES ||
    'link,wechat,qq,weibo,twitter,telegram,facebook,linkedin',
  // Supported services:
  // link,wechat,qq,weibo,email,facebook,twitter,telegram,messenger,line,
  // reddit,whatsapp,linkedin,vkshare,okshare,tumblr,livejournal,mailru,
  // viber,workplace,pocket,instapaper,hatena,threads,csdn,juejin

  POST_TITLE_ICON: process.env.NEXT_PUBLIC_POST_TITLE_ICON || true,
  POST_DISABLE_GALLERY_CLICK:
    process.env.NEXT_PUBLIC_POST_DISABLE_GALLERY_CLICK || false,
  POST_LIST_STYLE: process.env.NEXT_PUBLIC_POST_LIST_STYLE || 'page',
  POST_LIST_PREVIEW: process.env.NEXT_PUBLIC_POST_PREVIEW || 'false',
  POST_PREVIEW_LINES: process.env.NEXT_PUBLIC_POST_POST_PREVIEW_LINES || 12,
  POST_RECOMMEND_COUNT: process.env.NEXT_PUBLIC_POST_RECOMMEND_COUNT || 6,
  POSTS_PER_PAGE: process.env.NEXT_PUBLIC_POST_PER_PAGE || 12,
  POSTS_SORT_BY: process.env.NEXT_PUBLIC_POST_SORT_BY || 'notion',

  // Expiration reminder for posts, currently mainly used by some themes.
  ARTICLE_EXPIRATION_DAYS:
    process.env.NEXT_PUBLIC_ARTICLE_EXPIRATION_DAYS || 90,
  ARTICLE_EXPIRATION_MESSAGE:
    process.env.NEXT_PUBLIC_ARTICLE_EXPIRATION_MESSAGE ||
    '这篇文章发布于 %%DAYS%% 天前，内容可能已过时，请谨慎参考。',
  ARTICLE_EXPIRATION_ENABLED:
    process.env.NEXT_PUBLIC_ARTICLE_EXPIRATION_ENABLED || 'false',

  POST_WAITING_TIME_FOR_404:
    process.env.NEXT_PUBLIC_POST_WAITING_TIME_FOR_404 || '8',

  // Tag-related config
  TAG_SORT_BY_COUNT: true,
  IS_TAG_COLOR_DISTINGUISHED:
    process.env.NEXT_PUBLIC_IS_TAG_COLOR_DISTINGUISHED === 'true' || true
}
