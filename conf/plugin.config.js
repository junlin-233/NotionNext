const { toNumber } = require('./env-tools')

/**
 * 涓€浜涙彃浠?
 */
module.exports = {
  // 缃戠珯鍏ㄦ枃鎼滅储
  ALGOLIA_APP_ID: process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || null, // 鍦ㄨ繖閲屾煡鐪?https://dashboard.algolia.com/account/api-keys/
  ALGOLIA_ADMIN_APP_KEY: process.env.ALGOLIA_ADMIN_APP_KEY || null, // 绠＄悊鍚庡彴鐨凨EY锛屼笉瑕佹毚闇插湪浠ｇ爜涓紝鍦ㄨ繖閲屾煡鐪?https://dashboard.algolia.com/account/api-keys/
  ALGOLIA_SEARCH_ONLY_APP_KEY:
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_APP_KEY || null, // 瀹㈡埛绔悳绱㈢敤鐨凨EY
  ALGOLIA_INDEX: process.env.NEXT_PUBLIC_ALGOLIA_INDEX || null, // 鍦ˋlgolia涓垱寤轰竴涓猧ndex鐢ㄤ綔鏁版嵁搴?

  // AI 鏂囩珷鎽樿鐢熸垚
  AI_SUMMARY_API: process.env.AI_SUMMARY_API || '',
  AI_SUMMARY_KEY: process.env.AI_SUMMARY_KEY || '',
  AI_SUMMARY_CACHE_TIME: toNumber(process.env.AI_SUMMARY_CACHE_TIME, 1800), // 缂撳瓨鏃堕棿锛屽崟浣嶇
  AI_SUMMARY_WORD_LIMIT: toNumber(process.env.AI_SUMMARY_WORD_LIMIT, 1000),

  //   ********鎸備欢缁勪欢鐩稿叧********
  // AI 鏂囩珷鎽樿鐢熸垚 @see https://docs_s.tianli0.top/
  TianliGPT_CSS:
    process.env.NEXT_PUBLIC_TIANLI_GPT_CSS ||
    'https://cdn1.tianli0.top/gh/zhheo/Post-Abstract-AI@0.15.2/tianli_gpt.css',
  TianliGPT_JS:
    process.env.NEXT_PUBLIC_TIANLI_GPT_JS ||
    'https://cdn1.tianli0.top/gh/zhheo/Post-Abstract-AI@0.15.2/tianli_gpt.js',
  TianliGPT_KEY: process.env.NEXT_PUBLIC_TIANLI_GPT_KEY || '',

  // 閭欢
  MAILCHIMP_LIST_ID: process.env.MAILCHIMP_LIST_ID || null, // 寮€鍚痬ailichimp閭欢璁㈤槄 瀹㈡埛鍒楄〃ID 锛屽叿浣撲娇鐢ㄦ柟娉曞弬闃呮枃妗?
  MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY || null // 寮€鍚痬ailichimp閭欢璁㈤槄 APIkey
}
