// ==UserScript==
// @name         RedNote Image Copy Helper
// @namespace    https://github.com/xl-antonym/rednote-image-copy-helper
// @version      0.1.1
// @description  Copy note text and download images from RedNote/Xiaohongshu pages.
// @author       Xin Li
// @match        https://www.xiaohongshu.com/*
// @match        https://xiaohongshu.com/*
// @match        *://*.xiaohongshu.com/*
// @grant        GM_download
// @grant        GM_setClipboard
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // 通用工具与全局配置
  // Shared utilities and global configuration
  const ROOT_ID = 'xhs-note-collector-root';
  const PANEL_ID = 'xhs-note-collector-panel';
  const TOAST_ID = 'xhs-note-collector-toast';
  const STYLE_ID = 'xhs-note-collector-style';
  const LEGACY_POS_KEY = 'xhs-note-collector-pos';
  const PANEL_POS_KEY = 'xhs-note-collector-panel-pos';
  const COLLAPSED_KEY = 'xhs-note-collector-collapsed';
  const LANG_KEY = 'xhs-note-collector-lang';
  const THEME_KEY = 'xhs-note-collector-theme';
  const DEV_MODE_KEY = 'xhs-note-collector-dev-mode';
  const DEBUG = false;
  const MIN_WIDTH = 180;
  const MIN_HEIGHT = 180;
  const RAIL_SLOT_CONFIG = {
    right: 24,
    baseBottom: 178,
    gap: 10,
    width: 82,
    height: 34,
    margin: 8,
  };

  const I18N = {
    zh: {
      title: 'XHS采集助手',
      settings: '设置',
      hide: '隐藏',
      back: '返回',
      copyText: '复制文字',
      downloadCurrent: '下载当前图',
      downloadAll: '下载全部图',
      copyLinks: '复制图链',
      copyProbe: '复制Probe',
      language: '语言',
      theme: '主题',
      auto: '自动',
      light: '浅色',
      dark: '深色',
      detectedTheme: '当前检测主题',
      developerTest: '开发者测试',
      on: '开启',
      off: '关闭',
      mini: '图文',
      miniTitle: '显示 XHS采集助手',
      openNoteFirst: '请先打开一篇笔记详情页',
      noNoteContent: '没有识别到笔记内容，请先打开笔记详情页',
      copiedText: '已复制文字，可粘贴到 Word / AI',
      copyFail: '复制失败，请刷新页面后重试',
      noImageCurrent: '当前笔记中没有识别到当前可见大图',
      noImageAll: '当前笔记中没有识别到已加载大图',
      noImageLinks: '当前笔记中没有识别到图片链接',
      noDownloadable: '没有识别到可下载的大图',
      downloading: '正在下载 {current}/{total}',
      downloadDone: '完成：已下载 {count} 张图片',
      downloadPartial: '完成：成功 {success}，失败 {fail}。失败图链已复制',
      linksCopied: '已复制 {count} 条图片链接',
      probeCopied: 'Probe JSON 已复制',
      probeFail: '复制 Probe 失败，请刷新页面后重试',
      langChanged: '语言已切换',
      themeChanged: '主题已切换',
    },
    en: {
      title: 'XHS Helper',
      settings: 'Settings',
      hide: 'Hide',
      back: 'Back',
      copyText: 'Copy Text',
      downloadCurrent: 'Current Image',
      downloadAll: 'All Images',
      copyLinks: 'Copy Links',
      copyProbe: 'Copy Probe',
      language: 'Language',
      theme: 'Theme',
      auto: 'Auto',
      light: 'Light',
      dark: 'Dark',
      detectedTheme: 'Detected theme',
      developerTest: 'Developer Test',
      on: 'On',
      off: 'Off',
      mini: 'Post',
      miniTitle: 'Show XHS Helper',
      openNoteFirst: 'Please open a note detail page first.',
      noNoteContent: 'No note content detected. Please open a note detail page first.',
      copiedText: 'Text copied. You can paste it into Word / AI.',
      copyFail: 'Copy failed. Please refresh the page and try again.',
      noImageCurrent: 'No visible large image detected in the current note.',
      noImageAll: 'No loaded large image detected in the current note.',
      noImageLinks: 'No image links detected in the current note.',
      noDownloadable: 'No downloadable large image detected.',
      downloading: 'Downloading {current}/{total}',
      downloadDone: 'Done: downloaded {count} image(s).',
      downloadPartial: 'Done: {success} succeeded, {fail} failed. Failed image links copied.',
      linksCopied: 'Copied {count} image link(s).',
      probeCopied: 'Probe JSON copied.',
      probeFail: 'Failed to copy Probe. Please refresh and try again.',
      langChanged: 'Language updated.',
      themeChanged: 'Theme updated.',
    },
  };

  let rootEl = null;
  let panelEl = null;
  let miniEl = null;
  let toastTimer = null;
  let isCollapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';
  let currentView = 'main';
  let uiLang = localStorage.getItem(LANG_KEY) || 'zh';
  let themePref = localStorage.getItem(THEME_KEY) || 'auto';
  let devMode = loadDevMode();
  let detectedTheme = 'light';
  let miniPositionTimer = null;

  function t(key, vars = {}) {
    const table = I18N[uiLang] || I18N.zh;
    const template = table[key] || I18N.zh[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : '';
    });
  }

  function normalizeText(text, keepLineBreaks = false) {
    if (!text) return '';
    let s = String(text)
      .replace(/\u200b/g, '')
      .replace(/\r/g, '')
      .replace(/\u00a0/g, ' ');

    if (keepLineBreaks) {
      return s
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    return s.replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeUrl(url) {
    if (!url) return '';

    let u = String(url).trim();

    if (!u || u === 'none') return '';
    if (u.startsWith('data:')) return '';
    if (u.startsWith('blob:')) return '';
    if (u.startsWith('//')) u = 'https:' + u;

    u = u.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');

    return u;
  }

  function queryAllSafe(root, selector) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isDisplayed(el) {
    if (!el || !(el instanceof Element)) return false;

    const style = window.getComputedStyle(el);

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    return true;
  }

  function isInViewport(rect) {
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function loadDevMode() {
    const raw = localStorage.getItem(DEV_MODE_KEY);
    return raw === 'true' || raw === '1';
  }

  function saveDevMode(value) {
    devMode = Boolean(value);
    localStorage.setItem(DEV_MODE_KEY, String(devMode));
  }

  function uniqueElements(nodes) {
    return Array.from(new Set(nodes.filter(Boolean)));
  }

  function classText(el) {
    return String(el?.className || '').trim();
  }

  function parseRgb(color) {
    const match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/i);
    if (!match) return null;
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    if (alpha === 0) return null;
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: alpha,
    };
  }

  function luminance(rgb) {
    if (!rgb) return 255;
    return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  }

  function truncateText(text, length = 180) {
    const s = String(text || '');
    return s.length > length ? `${s.slice(0, length)}...` : s;
  }

  function sanitizeFilePrefix(raw) {
    const safe = Array.from(String(raw || ''))
      .join('')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/[\s　]+/g, '_')
      .replace(/[，,;；]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_\s.]+|[_\s.]+$/g, '')
      .trim();

    const chars = Array.from(safe || 'rednote_image');
    return chars.slice(0, 70).join('').replace(/^[_\s.]+|[_\s.]+$/g, '') || 'rednote_image';
  }

  // 页面状态与当前笔记定位
  // Page state and active note root detection
  function getPageState() {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const exploreDetailMatch = pathname.match(/^\/explore\/([^/]+)$/);
    const discoveryDetailMatch = pathname.match(/^\/discovery\/item\/([^/]+)$/);

    return {
      url: window.location.href,
      pathname,
      isFeedHome: pathname === '/explore',
      isExploreDetail: Boolean(exploreDetailMatch),
      isDiscoveryItem: Boolean(discoveryDetailMatch),
      isNoteDetailUrl: Boolean(exploreDetailMatch || discoveryDetailMatch),
      noteId: decodeURIComponent((exploreDetailMatch?.[1] || discoveryDetailMatch?.[1] || '').trim()),
    };
  }

  function getNoteId() {
    return getPageState().noteId;
  }

  function getNodeSelectorHint(el, matchedSelector = '') {
    if (!el || !(el instanceof Element)) return '';
    if (el.id) return `#${el.id}`;
    if (matchedSelector) return matchedSelector;
    const cls = classText(el)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(item => `.${item}`)
      .join('');
    return `${el.tagName.toLowerCase()}${cls}`;
  }

  function hasDetailLayerIndicator(el) {
    if (!el || !(el instanceof Element)) return false;
    const text = `${classText(el)} ${classText(el.parentElement)} ${el.id || ''}`.toLowerCase();
    if (/note-detail|detail-mask|detail-container/.test(text)) return true;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const position = style.position;
    const zIndex = Number(style.zIndex) || 0;
    const viewportArea = window.innerWidth * window.innerHeight;
    const area = rect.width * rect.height;

    return (
      (position === 'fixed' || position === 'sticky') &&
      area > viewportArea * 0.35 &&
      zIndex >= 10
    );
  }

  function normalizeCandidateRoot(node, selector) {
    if (!node || !(node instanceof Element)) return null;

    const detailRoot = node.closest(
      '.note-detail-mask, .note-detail-container, .note-detail, [class*="note-detail"]'
    );
    if (detailRoot) return { root: detailRoot, selector: getNodeSelectorHint(detailRoot, selector) };

    const noteRoot = node.closest('.note-container, [class*="note-container"]');
    if (noteRoot) return { root: noteRoot, selector: getNodeSelectorHint(noteRoot, selector) };

    const contentRoot = node.closest('[class*="media-container"], [class*="interaction-container"], [class*="note-content"]');
    if (contentRoot) {
      const parent = contentRoot.parentElement?.closest('[class*="note"], main, section, article');
      const root = parent && parent !== document.body ? parent : contentRoot;
      return { root, selector: getNodeSelectorHint(root, selector) };
    }

    return { root: node, selector: getNodeSelectorHint(node, selector) };
  }

  function scoreActiveRoot(root, selector, pageState) {
    if (!root || !(root instanceof Element) || root === rootEl) return -Infinity;
    if (!isVisible(root)) return -Infinity;

    const rootClass = classText(root).toLowerCase();
    const rect = root.getBoundingClientRect();
    let score = 0;

    if (/note-detail|detail-container|detail-mask/.test(rootClass)) score += 120;
    if (/note-container/.test(rootClass)) score += 60;
    if (/media-container|interaction-container|note-content/.test(rootClass)) score += 35;
    if (hasDetailLayerIndicator(root)) score += 80;
    if (root.querySelector('#detail-title, [class*="note-content"], #detail-desc')) score += 45;
    if (root.querySelector('img, video, [style*="background"]')) score += 20;
    if (pageState.isNoteDetailUrl) score += 40;
    if (selector.includes('note-detail')) score += 40;
    if (rect.width > window.innerWidth * 0.45 && rect.height > window.innerHeight * 0.45) score += 20;
    if (root.closest('[class*="comment"]')) score -= 120;
    if (root === document.body || root.id === 'app') score -= 120;

    return score;
  }

  function findActiveNoteRootInfo() {
    const pageState = getPageState();
    const selectors = [
      '.note-detail-mask',
      '.note-detail-container',
      '.note-detail',
      '[class*="note-detail"]',
      '.note-container',
      '[class*="note-container"]',
      '[class*="media-container"]',
      '[class*="interaction-container"]',
      '[class*="note-content"]',
    ];

    const candidates = [];

    selectors.forEach(selector => {
      queryAllSafe(document, selector).forEach(node => {
        const normalized = normalizeCandidateRoot(node, selector);
        if (!normalized?.root) return;
        if (normalized.root === rootEl || normalized.root.closest(`#${ROOT_ID}`)) return;
        if (pageState.isFeedHome && !hasDetailLayerIndicator(normalized.root)) return;

        candidates.push({
          root: normalized.root,
          selector: normalized.selector,
          score: scoreActiveRoot(normalized.root, normalized.selector, pageState),
        });
      });
    });

    const unique = uniqueElements(candidates.map(item => item.root))
      .map(root => candidates.find(item => item.root === root))
      .filter(item => item.score > -Infinity)
      .sort((a, b) => b.score - a.score);

    if (unique.length && unique[0].score >= 35) {
      return {
        root: unique[0].root,
        selector: unique[0].selector,
        score: unique[0].score,
        source: 'candidate',
        pageState,
      };
    }

    // 单篇详情 URL 下允许使用较大的页面容器兜底；首页 feed 不允许兜底到全局容器。
    // On detail URLs, allow a larger page container fallback; never fall back to global containers on the feed page.
    if (pageState.isNoteDetailUrl) {
      const fallback = document.querySelector('main') || document.querySelector('#app') || document.body;
      return {
        root: fallback,
        selector: getNodeSelectorHint(fallback, fallback === document.body ? 'body' : ''),
        score: 0,
        source: 'detail-url-fallback',
        pageState,
      };
    }

    return {
      root: null,
      selector: '',
      score: 0,
      source: 'no-active-note-detail',
      pageState,
    };
  }

  function getActiveNoteRoot() {
    return findActiveNoteRootInfo().root;
  }

  // 笔记文字采集
  // Note text collection
  function pickTextBySelectors(root, selectors, options = {}) {
    const {
      keepLineBreaks = false,
      maxLength = 1000,
      minLength = 1,
      reject = () => false,
    } = options;

    for (const selector of selectors) {
      const nodes = queryAllSafe(root, selector);
      for (const node of nodes) {
        if (!isVisible(node)) continue;
        const text = normalizeText(node.innerText || node.textContent, keepLineBreaks);
        if (!text) continue;
        if (text.length < minLength || text.length > maxLength) continue;
        if (reject(text, node)) continue;
        return text;
      }
    }

    return '';
  }

  function getNoteRoot() {
    const activeRoot = getActiveNoteRoot();
    if (activeRoot) return activeRoot;

    const selectors = [
      '.note-detail-mask',
      '.note-detail-container',
      '.note-detail',
      '.note-container',
      '[class*="note-detail"]',
      '[class*="note-container"]',
      'main',
      '#app',
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node && isVisible(node)) return node;
    }

    return document.body;
  }

  function getTitle(root) {
    const title = pickTextBySelectors(root, [
      '#detail-title',
      '.note-content .title',
      '[class*="note-content"] [class*="title"]',
      '[class*="title"]',
    ], {
      maxLength: 120,
      reject: text => /关注|评论|点赞|收藏|分享|说点什么/.test(text),
    });

    return title;
  }

  function getAuthor(root) {
    const rejectAuthor = text => {
      return (
        !text ||
        text.length > 60 ||
        /关注|粉丝|获赞|评论|收藏|分享|说点什么|展开/.test(text)
      );
    };

    const author = pickTextBySelectors(root, [
      '.author-container .username',
      '.author-container .name',
      '.author-wrapper .username',
      '.author-wrapper .name',
      '[class*="author"] [class*="username"]',
      '[class*="author"] [class*="name"]',
      'a[href*="/user/profile"] .username',
      'a[href*="/user/profile"] .name',
      'a[href*="/user/profile"] span',
      'a[href*="/user/profile"]',
      '.username',
      '.user-name',
      '.nickname',
    ], {
      maxLength: 60,
      reject: rejectAuthor,
    });

    return author;
  }

  function getPublishTime(root) {
    const nodes = Array.from(root.querySelectorAll('span, div, p'));
    const candidates = [];

    nodes.forEach((node, index) => {
      if (!isVisible(node)) return;

      const text = normalizeText(node.innerText || node.textContent);
      if (!text || text.length > 80) return;

      const looksLikeTime =
        /(编辑于|发布于|发表于|刚刚|今天|昨天|前天|分钟前|小时前|\d{1,2}:\d{2}|\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2})/.test(text);

      if (!looksLikeTime) return;

      if (/回复|展开|评论|点赞|收藏|说点什么|关注/.test(text)) return;

      let score = 0;
      const cls = String(node.className || '');
      const parentCls = String(node.parentElement?.className || '');

      if (/编辑于|发布于|发表于/.test(text)) score += 100;
      if (/date|time/i.test(cls)) score += 40;
      if (/date|time/i.test(parentCls)) score += 20;
      if (node.closest('.note-content, [class*="note-content"]')) score += 40;
      if (node.closest('[class*="comment"]')) score -= 100;

      candidates.push({ text, score, index });
    });

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    return candidates[0]?.text || '';
  }

  function getContent(root, title, time) {
    const content = pickTextBySelectors(root, [
      '#detail-desc',
      '.note-content .desc',
      '[class*="note-content"] [class*="desc"]',
      '.desc',
      '[class*="desc"]',
    ], {
      keepLineBreaks: true,
      maxLength: 10000,
      minLength: 1,
      reject: text => /说点什么|展开.*条回复|共\s*\d+\s*条评论/.test(text),
    });

    if (content) return content;

    const contentHost = root.querySelector('.note-content, [class*="note-content"]');
    if (contentHost && isVisible(contentHost)) {
      let text = normalizeText(contentHost.innerText || contentHost.textContent, true);

      if (title) {
        text = text.replace(title, '').trim();
      }

      if (time) {
        text = text.replace(time, '').trim();
      }

      text = text
        .replace(/关注/g, '')
        .replace(/说点什么.*/g, '')
        .trim();

      if (text) return text;
    }

    return '';
  }

  function decorateBodyHtml(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/(^|\s)#([^#\s]+)/g, '$1<span style="color:#3366cc;">#$2</span>')
      .replace(/\n/g, '<br>');
  }

  function getCleanCurrentUrl() {
    return window.location.href;
  }

  function buildHtml(data) {
    const titleHtml = data.title
      ? `<h1 style="font-size:20px; font-weight:700; line-height:1.4; margin:0 0 12px 0;">${escapeHtml(data.title)}</h1>`
      : '';

    const authorHtml = data.author
      ? `<div style="font-size:13px; color:#555; margin:4px 0;">作者：${escapeHtml(data.author)}</div>`
      : '';

    const timeHtml = data.time
      ? `<div style="font-size:13px; color:#777; margin:4px 0;">时间：${escapeHtml(data.time)}</div>`
      : '';

    const bodyHtml = data.content
      ? `<div style="font-size:15px; line-height:1.8; margin:16px 0 18px 0; white-space:normal;">${decorateBodyHtml(data.content)}</div>`
      : '';

    const urlHtml = data.url
      ? `<div style="font-size:12px; color:#777; margin-top:12px; border-top:1px solid #ddd; padding-top:8px;">
          原文链接：
          <a href="${escapeHtml(data.url)}" style="color:#3366cc;">${escapeHtml(data.url)}</a>
        </div>`
      : '';

    return `
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
        'Microsoft YaHei', Arial, sans-serif;
        color:#111;
        max-width:760px;
        line-height:1.7;
      ">
        ${titleHtml}
        ${authorHtml}
        ${timeHtml}
        ${bodyHtml}
        ${urlHtml}
      </div>
    `;
  }

  function buildPlainText(data) {
    return [
      data.title ? `【标题】\n${data.title}` : '',
      data.author ? `【作者】\n${data.author}` : '',
      data.time ? `【时间】\n${data.time}` : '',
      data.content ? `【正文】\n${data.content}` : '',
      data.url ? `【原文链接】\n${data.url}` : '',
    ].filter(Boolean).join('\n\n');
  }

  function collectNoteData(rootOverride = null) {
    const root = rootOverride || getNoteRoot();
    const title = getTitle(root);
    const author = getAuthor(root);
    const time = getPublishTime(root);
    const content = getContent(root, title, time);
    const url = getCleanCurrentUrl();

    const data = {
      title,
      author,
      time,
      content,
      url,
    };

    data.html = buildHtml(data);
    data.plain = buildPlainText(data);

    if (DEBUG) {
      console.log('[XHS Note Collector] collected data:', data);
    }

    return data;
  }

  // 图片候选采集
  // Image candidate collection
  function getBestSrcFromSrcset(srcset) {
    if (!srcset) return '';

    const parts = srcset
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    if (!parts.length) return '';

    return parts[parts.length - 1].split(/\s+/)[0] || '';
  }

  function extractBackgroundUrls(bg) {
    if (!bg || bg === 'none') return [];

    const urls = [];
    const reg = /url\(["']?(.+?)["']?\)/g;
    let match;

    while ((match = reg.exec(bg)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }

  function getElementSize(el) {
    const rect = el.getBoundingClientRect();

    const naturalWidth = el.naturalWidth || el.videoWidth || 0;
    const naturalHeight = el.naturalHeight || el.videoHeight || 0;

    const width = Math.max(rect.width || 0, naturalWidth || 0);
    const height = Math.max(rect.height || 0, naturalHeight || 0);

    return {
      rect,
      width,
      height,
      area: width * height,
    };
  }

  function isBadImageUrl(url) {
    const lower = url.toLowerCase();

    return (
      lower.includes('avatar') ||
      lower.includes('icon') ||
      lower.includes('emoji') ||
      lower.includes('logo') ||
      lower.includes('favicon') ||
      lower.includes('sprite')
    );
  }

  function isBadElement(el) {
    const cls = String(el.className || '').toLowerCase();

    if (
      cls.includes('avatar') ||
      cls.includes('icon') ||
      cls.includes('emoji') ||
      cls.includes('logo')
    ) {
      return true;
    }

    if (
      el.closest('[class*="avatar"]') ||
      el.closest('[class*="comment"]') ||
      el.closest('[class*="author"]') ||
      el.closest('[class*="toolbar"]') ||
      el.closest('[class*="interaction"]')
    ) {
      return true;
    }

    return false;
  }

  function addCandidate(list, seen, url, el, source, visibleOnly) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    if (isBadImageUrl(normalized)) return;
    if (isBadElement(el)) return;

    const { rect, width, height, area } = getElementSize(el);

    if (width < MIN_WIDTH || height < MIN_HEIGHT) return;
    if (area < MIN_WIDTH * MIN_HEIGHT) return;

    if (visibleOnly) {
      if (!isDisplayed(el)) return;
      if (!isInViewport(rect)) return;
      if (rect.width < MIN_WIDTH || rect.height < MIN_HEIGHT) return;
    }

    seen.add(normalized);

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    const distanceToCenter = Math.hypot(centerX - screenCenterX, centerY - screenCenterY);

    list.push({
      url: normalized,
      source,
      width: Math.round(width),
      height: Math.round(height),
      area: Math.round(area),
      top: Math.round(rect.top + window.scrollY),
      left: Math.round(rect.left + window.scrollX),
      visible: isInViewport(rect),
      distanceToCenter,
    });
  }

  function collectImagesFromRoot(scanRoot, options = {}) {
    const { visibleOnly = false } = options;
    if (!scanRoot) return [];

    const list = [];
    const seen = new Set();

    const imgNodes = Array.from(scanRoot.querySelectorAll('img'));

    imgNodes.forEach(img => {
      const attrs = [
        getBestSrcFromSrcset(img.getAttribute('srcset')),
        img.currentSrc,
        img.src,
        img.getAttribute('src'),
        img.getAttribute('data-src'),
        img.getAttribute('data-original'),
        img.getAttribute('data-url'),
      ];

      attrs.forEach(url => {
        addCandidate(list, seen, url, img, 'img', visibleOnly);
      });
    });

    const videoNodes = Array.from(scanRoot.querySelectorAll('video'));

    videoNodes.forEach(video => {
      const poster = video.getAttribute('poster');
      addCandidate(list, seen, poster, video, 'video-poster', visibleOnly);
    });

    const allNodes = Array.from(scanRoot.querySelectorAll('*'));

    allNodes.forEach(el => {
      if (!isDisplayed(el)) return;

      const style = window.getComputedStyle(el);
      const bgUrls = extractBackgroundUrls(style.backgroundImage);

      bgUrls.forEach(url => {
        addCandidate(list, seen, url, el, 'background', visibleOnly);
      });
    });

    list.sort((a, b) => {
      if (visibleOnly) {
        if (b.area !== a.area) return b.area - a.area;
        return a.distanceToCenter - b.distanceToCenter;
      }

      if (a.top !== b.top) return a.top - b.top;
      if (a.left !== b.left) return a.left - b.left;
      return b.area - a.area;
    });

    return list;
  }

  function collectImages(options = {}) {
    const { visibleOnly = false, root = null } = options;
    const activeRoot = root || getActiveNoteRoot();
    if (!activeRoot) return [];
    return collectImagesFromRoot(activeRoot, { visibleOnly });
  }

  function getExtFromUrl(url) {
    const lower = url.toLowerCase();

    if (lower.includes('.png')) return 'png';
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'jpg';
    if (lower.includes('.webp') || lower.includes('webp')) return 'webp';
    if (lower.includes('.avif') || lower.includes('avif')) return 'avif';

    return 'jpg';
  }

  function getDownloadPrefix(root) {
    const data = collectNoteData(root);
    const noteId = getNoteId();
    return sanitizeFilePrefix(data.title || noteId || 'rednote_image');
  }

  // Probe 调试报告
  // Probe debug report
  /**
   * 生成当前页面结构调试报告
   * Build current page structure debug report
   */
  function summarizeImages(images) {
    return images.slice(0, 30).map((img, index) => ({
      index: index + 1,
      source: img.source,
      width: img.width,
      height: img.height,
      area: img.area,
      visible: img.visible,
      distanceToCenter: Math.round(img.distanceToCenter),
      url: img.url,
    }));
  }

  /**
   * 汇总 URL、笔记 root、标题作者和图片候选
   * Summarize URL, note root, title/author, and image candidates
   */
  function buildProbeReport() {
    const rootInfo = findActiveNoteRootInfo();
    const root = rootInfo.root;
    const pageState = rootInfo.pageState;
    const noteData = root ? collectNoteData(root) : { title: '', author: '' };
    const rootImages = root ? collectImagesFromRoot(root, { visibleOnly: false }) : [];
    const globalImages = collectImagesFromRoot(document, { visibleOnly: false });

    return {
      generatedAt: new Date().toISOString(),
      url: pageState.url,
      noteId: pageState.noteId,
      title: noteData.title || '',
      author: noteData.author || '',
      page: {
        pathname: pageState.pathname,
        isFeedHome: pageState.isFeedHome,
        isExploreDetail: pageState.isExploreDetail,
        isDiscoveryItem: pageState.isDiscoveryItem,
        isNoteDetailUrl: pageState.isNoteDetailUrl,
        isNoteDetailState: Boolean(root),
      },
      activeNoteRoot: root ? {
        selector: rootInfo.selector,
        className: classText(root),
        tagName: root.tagName.toLowerCase(),
        id: root.id || '',
        source: rootInfo.source,
        score: rootInfo.score,
        textPreview: truncateText(normalizeText(root.innerText || root.textContent), 260),
      } : {
        selector: '',
        className: '',
        source: rootInfo.source,
        note: 'no active note detail',
      },
      imageCounts: {
        documentGlobalCandidates: globalImages.length,
        activeNoteRootCandidates: rootImages.length,
      },
      activeNoteRootImageCandidates: summarizeImages(rootImages),
    };
  }

  // 剪贴板与下载
  // Clipboard and download
  /**
   * 复制 Word 友好 HTML 与 AI 友好纯文本
   * Copy Word-friendly HTML and AI-friendly plain text
   */
  async function copyRichText(html, plain) {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });

      await navigator.clipboard.write([item]);
      return;
    }

    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(plain, 'text');
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = plain;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function copyPlainText(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return Promise.resolve();
    }

    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    return Promise.resolve();
  }

  function downloadOne(url, filename) {
    return new Promise(resolve => {
      if (typeof GM_download !== 'function') {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
        resolve({ ok: true, fallback: true });
        return;
      }

      GM_download({
        url,
        name: filename,
        saveAs: false,
        onload: () => resolve({ ok: true }),
        onerror: error => resolve({ ok: false, error }),
        ontimeout: error => resolve({ ok: false, error }),
      });
    });
  }

  /**
   * 顺序下载图片并生成安全文件名
   * Download images sequentially with safe filenames
   */
  async function downloadImages(images, prefix) {
    if (!images.length) {
      showToast(t('noDownloadable'), 'error');
      return;
    }

    let success = 0;
    let fail = 0;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = getExtFromUrl(img.url);
      const filename = `${prefix}_${String(i + 1).padStart(2, '0')}.${ext}`;

      showToast(t('downloading', { current: i + 1, total: images.length }));

      const result = await downloadOne(img.url, filename);

      if (result.ok) {
        success++;
      } else {
        fail++;
        console.warn('[XHS Note Collector] download failed:', img.url, result.error);
      }

      await new Promise(r => setTimeout(r, 350));
    }

    if (fail > 0) {
      await copyLinks(images);
      showToast(t('downloadPartial', { success, fail }), 'error');
    } else {
      showToast(t('downloadDone', { count: success }), 'success');
    }
  }

  async function copyLinks(images) {
    const text = images.map((img, index) => {
      return `图片${index + 1}：${img.url}`;
    }).join('\n');

    await copyPlainText(text);
  }

  function requireActiveNoteRoot() {
    const rootInfo = findActiveNoteRootInfo();
    if (!rootInfo.root) {
      showToast(t('openNoteFirst'), 'error');
      return null;
    }
    return rootInfo;
  }

  /**
   * 复制当前笔记文字
   * Copy current note text
   */
  async function handleCopy() {
    try {
      const rootInfo = findActiveNoteRootInfo();
      const data = collectNoteData(rootInfo.root || null);

      if (!data.title && !data.content) {
        showToast(t('noNoteContent'), 'error');
        return;
      }

      await copyRichText(data.html, data.plain);
      showToast(t('copiedText'), 'success');
    } catch (error) {
      console.error('[XHS Note Collector] copy failed:', error);
      showToast(t('copyFail'), 'error');
    }
  }

  /**
   * 下载当前笔记中当前可见的大图
   * Download the visible large image from the current note
   */
  async function handleDownloadCurrent() {
    const rootInfo = requireActiveNoteRoot();
    if (!rootInfo) return;

    const images = collectImages({ root: rootInfo.root, visibleOnly: true });

    if (!images.length) {
      showToast(t('noImageCurrent'), 'error');
      return;
    }

    const prefix = getDownloadPrefix(rootInfo.root);
    await downloadImages([images[0]], prefix);
  }

  /**
   * 下载当前笔记中已加载的大图
   * Download loaded large images from the current note
   */
  async function handleDownloadAll() {
    const rootInfo = requireActiveNoteRoot();
    if (!rootInfo) return;

    const images = collectImages({ root: rootInfo.root, visibleOnly: false });

    if (!images.length) {
      showToast(t('noImageAll'), 'error');
      return;
    }

    const prefix = getDownloadPrefix(rootInfo.root);
    await downloadImages(images.slice(0, 30), prefix);
  }

  /**
   * 复制当前笔记图片链接
   * Copy current note image links
   */
  async function handleCopyLinks() {
    const rootInfo = requireActiveNoteRoot();
    if (!rootInfo) return;

    const images = collectImages({ root: rootInfo.root, visibleOnly: false });

    if (!images.length) {
      showToast(t('noImageLinks'), 'error');
      return;
    }

    await copyLinks(images);
    showToast(t('linksCopied', { count: images.length }), 'success');
  }

  /**
   * 复制 Probe JSON，供开发调试使用
   * Copy Probe JSON for development debugging
   */
  async function handleCopyProbe() {
    try {
      const report = buildProbeReport();
      await copyPlainText(JSON.stringify(report, null, 2));
      showToast(t('probeCopied'), 'success');
      if (DEBUG) console.log('[XHS Note Collector] probe:', report);
    } catch (error) {
      console.error('[XHS Note Collector] probe failed:', error);
      showToast(t('probeFail'), 'error');
    }
  }

  // 语言与主题
  // Language and theme
  /**
   * 检测小红书页面当前浅色/深色状态
   * Detect whether the current RedNote page is light or dark
   */
  function detectPageTheme() {
    const nodes = [
      document.body,
      document.documentElement,
      document.querySelector('#app'),
      document.querySelector('main'),
    ].filter(Boolean);

    for (const node of nodes) {
      const bg = parseRgb(window.getComputedStyle(node).backgroundColor);
      if (!bg) continue;
      return luminance(bg) < 90 ? 'dark' : 'light';
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    detectedTheme = detectPageTheme();
    const actualTheme = themePref === 'auto' ? detectedTheme : themePref;
    if (rootEl) {
      rootEl.dataset.theme = actualTheme;
      rootEl.dataset.themePref = themePref;
    }
  }

  // UI 创建、主面板拖动与收起状态
  // UI creation, main panel dragging, and collapsed state
  /**
   * 注入插件样式
   * Inject userscript styles
   */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        z-index: 2147483647;
        font-family: inherit;
        user-select: none;
        --xhs-red: #ff2442;
      }

      #${ROOT_ID}[data-theme="light"] {
        --xhs-panel-bg: #ffffff;
        --xhs-header-bg: #f6f6f7;
        --xhs-header-text: #111111;
        --xhs-text: #111111;
        --xhs-sub-text: #555555;
        --xhs-border: rgba(0, 0, 0, 0.10);
        --xhs-btn-bg: #fff5f6;
        --xhs-btn-text: #8f1023;
        --xhs-main-btn-bg: #f7f7f8;
        --xhs-main-btn-hover-bg: #eeeeef;
        --xhs-main-btn-border: rgba(0, 0, 0, 0.12);
        --xhs-main-btn-hover-border: rgba(0, 0, 0, 0.22);
        --xhs-main-btn-text: #222222;
        --xhs-secondary-bg: #f4f4f5;
        --xhs-secondary-text: #333333;
        --xhs-mini-bg: rgba(255, 36, 66, 0.68);
        --xhs-mini-hover-bg: #ff2442;
        --xhs-mini-border: rgba(255, 255, 255, 0.52);
        --xhs-mini-shadow: 0 4px 12px rgba(255, 36, 66, 0.20);
        --xhs-mini-hover-shadow: 0 8px 18px rgba(255, 36, 66, 0.32);
        --xhs-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
      }

      #${ROOT_ID}[data-theme="dark"] {
        --xhs-panel-bg: #202026;
        --xhs-header-bg: #111114;
        --xhs-header-text: #f4f4f5;
        --xhs-text: #f4f4f5;
        --xhs-sub-text: #b9b9c0;
        --xhs-border: rgba(255, 255, 255, 0.12);
        --xhs-btn-bg: #27272e;
        --xhs-btn-text: #f4f4f5;
        --xhs-main-btn-bg: #2d2d34;
        --xhs-main-btn-hover-bg: #36363e;
        --xhs-main-btn-border: rgba(255, 255, 255, 0.18);
        --xhs-main-btn-hover-border: rgba(255, 255, 255, 0.28);
        --xhs-main-btn-text: #f4f4f5;
        --xhs-secondary-bg: #2d2d34;
        --xhs-secondary-text: #d8d8de;
        --xhs-mini-bg: rgba(255, 36, 66, 0.48);
        --xhs-mini-hover-bg: #ff2442;
        --xhs-mini-border: rgba(255, 255, 255, 0.16);
        --xhs-mini-shadow: 0 4px 12px rgba(0, 0, 0, 0.26);
        --xhs-mini-hover-shadow: 0 8px 20px rgba(255, 36, 66, 0.30);
        --xhs-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
      }

      #${PANEL_ID} {
        width: 196px;
        overflow: hidden;
        border-radius: 10px;
        background: var(--xhs-panel-bg);
        color: var(--xhs-text);
        border: 1px solid var(--xhs-border);
        box-shadow: var(--xhs-shadow);
      }

      .xhs-note-collector-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 36px;
        gap: 8px;
        padding: 0 8px 0 10px;
        color: var(--xhs-header-text);
        background: var(--xhs-header-bg);
        border-bottom: 1px solid var(--xhs-border);
        cursor: grab;
      }

      .xhs-note-collector-header:active {
        cursor: grabbing;
      }

      .xhs-note-collector-heading {
        min-width: 0;
        flex: 1;
        font-size: 13px;
        font-weight: 750;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .xhs-note-collector-header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .xhs-note-collector-header-btn {
        min-width: 36px;
        height: 24px;
        border: 1px solid var(--xhs-border);
        border-radius: 7px;
        padding: 0 7px;
        background: transparent;
        color: var(--xhs-header-text);
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
      }

      .xhs-note-collector-header-btn:hover {
        border-color: var(--xhs-red);
        color: var(--xhs-red);
      }

      .xhs-note-collector-content {
        display: flex;
        flex-direction: column;
        gap: 7px;
        padding: 9px;
      }

      .xhs-note-collector-btn {
        width: 100%;
        min-height: 32px;
        border: 1px solid rgba(255, 36, 66, 0.32);
        border-radius: 8px;
        padding: 7px 9px;
        background: var(--xhs-btn-bg);
        color: var(--xhs-btn-text);
        font-family: inherit;
        font-size: 13px;
        font-weight: 650;
        line-height: 1.2;
        cursor: pointer;
        white-space: nowrap;
      }

      .xhs-note-collector-btn:hover,
      .xhs-note-collector-option-active {
        background: var(--xhs-red);
        border-color: var(--xhs-red);
        color: #ffffff;
      }

      .xhs-note-collector-main-btn {
        background: var(--xhs-main-btn-bg);
        border-color: var(--xhs-main-btn-border);
        color: var(--xhs-main-btn-text);
      }

      .xhs-note-collector-main-btn:hover {
        background: var(--xhs-main-btn-hover-bg);
        border-color: var(--xhs-main-btn-hover-border);
        color: var(--xhs-main-btn-text);
      }

      .xhs-note-collector-btn-secondary {
        background: var(--xhs-secondary-bg);
        color: var(--xhs-secondary-text);
        border-color: var(--xhs-border);
      }

      .xhs-note-collector-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 3px 0;
      }

      .xhs-note-collector-label {
        color: var(--xhs-sub-text);
        font-size: 12px;
        line-height: 1.25;
      }

      .xhs-note-collector-options {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 5px;
      }

      .xhs-note-collector-options.two {
        grid-template-columns: 1fr 1fr;
      }

      .xhs-note-collector-mini {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 82px;
        height: 34px;
        border: 1px solid var(--xhs-mini-border);
        border-radius: 999px;
        padding: 0 11px 0 10px;
        background: var(--xhs-mini-bg);
        color: #fff;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        box-shadow: var(--xhs-mini-shadow);
        opacity: 0.88;
        transition: background-color .18s ease, box-shadow .18s ease, opacity .18s ease, transform .18s ease;
      }

      .xhs-note-collector-mini:hover {
        background: var(--xhs-mini-hover-bg);
        box-shadow: var(--xhs-mini-hover-shadow);
        opacity: 1;
        transform: translateY(-1px);
      }

      .xhs-note-collector-mini-icon,
      .xhs-note-collector-mini-text {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }

      .xhs-note-collector-mini-icon svg {
        width: 15px;
        height: 15px;
        display: block;
        stroke: currentColor;
      }

      #${TOAST_ID} {
        position: fixed;
        z-index: 2147483647;
        max-width: min(360px, calc(100vw - 32px));
        padding: 10px 14px;
        border-radius: 10px;
        color: #fff;
        background: #111;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease;
      }
    `;

    document.documentElement.appendChild(style);
  }

  function stopButtonPointer(event) {
    event.stopPropagation();
  }

  function makeButton(text, onClick, extraClass = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `xhs-note-collector-btn ${extraClass}`.trim();
    btn.textContent = text;
    btn.addEventListener('pointerdown', stopButtonPointer);
    btn.addEventListener('click', event => {
      event.stopPropagation();
      onClick();
    });
    return btn;
  }

  function makeHeaderButton(text, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xhs-note-collector-header-btn';
    btn.textContent = text;
    btn.addEventListener('pointerdown', stopButtonPointer);
    btn.addEventListener('click', event => {
      event.stopPropagation();
      onClick();
    });
    return btn;
  }

  function makeOptionButton(text, value, current, onChange) {
    const btn = makeButton(text, () => onChange(value), current === value ? 'xhs-note-collector-option-active' : 'xhs-note-collector-btn-secondary');
    return btn;
  }

  function getCurrentRootPos() {
    const rect = rootEl.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
    };
  }

  function getSavedPos(key) {
    const saved = safeJsonParse(localStorage.getItem(key), null);
    if (
      saved &&
      Number.isFinite(saved.left) &&
      Number.isFinite(saved.top)
    ) {
      return saved;
    }

    if (key === PANEL_POS_KEY) {
      const legacy = safeJsonParse(localStorage.getItem(LEGACY_POS_KEY), null);
      if (
        legacy &&
        Number.isFinite(legacy.left) &&
        Number.isFinite(legacy.top)
      ) {
        return legacy;
      }
    }

    return null;
  }

  function getDefaultPanelPos() {
    const width = rootEl?.offsetWidth || 196;
    const height = rootEl?.offsetHeight || 230;
    return {
      left: window.innerWidth - width - 24,
      top: window.innerHeight - height - 96,
    };
  }

  /**
   * 应用并可选保存主面板位置
   * Apply and optionally save main panel position
   */
  function applyPosition(pos, shouldSave = false) {
    if (!rootEl) return;

    const width = rootEl.offsetWidth || 44;
    const height = rootEl.offsetHeight || 44;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    const left = clamp(Number(pos.left) || 8, 8, maxLeft);
    const top = clamp(Number(pos.top) || 8, 8, maxTop);

    rootEl.style.left = `${Math.round(left)}px`;
    rootEl.style.top = `${Math.round(top)}px`;
    rootEl.style.right = 'auto';
    rootEl.style.bottom = 'auto';

    if (shouldSave) {
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left, top }));
    }
  }

  /**
   * 恢复主面板保存的位置
   * Restore saved main panel position
   */
  function restorePanelPosition() {
    requestAnimationFrame(() => {
      const pos = getSavedPos(PANEL_POS_KEY) || getDefaultPanelPos();
      applyPosition(pos, Boolean(getSavedPos(PANEL_POS_KEY)));
    });
  }

  /**
   * 收集兼容协议的小红书右侧浮动入口按钮
   * Collect visible right-rail launchers from compatible XHS userscripts
   */
  function collectFloatingLaunchers() {
    const nodes = [
      ...document.querySelectorAll('[data-xhs-floating-launcher="true"]'),
      ...document.querySelectorAll('#xhs-caption-reader-fab'),
      ...document.querySelectorAll(`#${ROOT_ID} .xhs-note-collector-mini`),
    ];
    const seen = new Set();

    return nodes
      .filter(el => {
        if (!el || seen.has(el)) return false;
        seen.add(el);
        if (!(el instanceof Element)) return false;
        if (!isDisplayed(el)) return false;

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (!isInViewport(rect)) return false;

        return true;
      })
      .map(el => {
        const app =
          el.dataset.xhsFloatingApp ||
          (el.id === 'xhs-caption-reader-fab' ? 'caption-reader' : '') ||
          (el === miniEl ? 'image-copy' : 'unknown');

        const orderFromDataset = Number(el.dataset.xhsFloatingOrder);
        const order = Number.isFinite(orderFromDataset)
          ? orderFromDataset
          : app === 'image-copy'
            ? 10
            : app === 'caption-reader'
              ? 20
              : 100;

        return {
          element: el,
          app,
          order,
          rect: el.getBoundingClientRect(),
        };
      });
  }

  /**
   * 根据所有右侧浮动入口的 order，计算当前图文入口应该占用的 slot
   * Compute the right-rail slot rect for the current mini launcher
   */
  function computeMiniLauncherSlot() {
    const config = RAIL_SLOT_CONFIG;
    const launchers = collectFloatingLaunchers();

    if (miniEl && !launchers.some(item => item.element === miniEl)) {
      launchers.push({
        element: miniEl,
        app: 'image-copy',
        order: 10,
        rect: miniEl.getBoundingClientRect(),
      });
    }

    launchers.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return String(a.app).localeCompare(String(b.app));
    });

    const slotIndex = Math.max(0, launchers.findIndex(item => item.element === miniEl || item.app === 'image-copy'));
    const bottom = config.baseBottom + slotIndex * (config.height + config.gap);
    const rawLeft = window.innerWidth - config.right - config.width;
    const rawTop = window.innerHeight - bottom - config.height;
    const left = clamp(rawLeft, config.margin, Math.max(config.margin, window.innerWidth - config.width - config.margin));
    const top = clamp(rawTop, config.margin, Math.max(config.margin, window.innerHeight - config.height - config.margin));

    return {
      left,
      top,
      width: config.width,
      height: config.height,
      slotIndex,
      launchers,
    };
  }

  /**
   * 将收起态迷你入口固定到确定的右侧栏 slot，避免多个插件入口重叠
   * Pin the collapsed mini launcher into a deterministic right-rail slot
   */
  function applyMiniLauncherPosition() {
    if (!rootEl) return;

    const slot = computeMiniLauncherSlot();

    rootEl.style.left = `${Math.round(slot.left)}px`;
    rootEl.style.top = `${Math.round(slot.top)}px`;
    rootEl.style.right = 'auto';
    rootEl.style.bottom = 'auto';
  }

  /**
   * 收起态轻量重算右侧栏 slot；展开态不覆盖主面板位置
   * Recalculate the right-rail slot only when collapsed; never override expanded panel position
   */
  function scheduleMiniPositionUpdate() {
    if (!isCollapsed) return;
    window.clearTimeout(miniPositionTimer);
    miniPositionTimer = window.setTimeout(() => {
      if (isCollapsed) applyMiniLauncherPosition();
    }, 60);
  }

  function clampCurrentPosition() {
    if (!rootEl) return;
    requestAnimationFrame(() => {
      if (isCollapsed) {
        applyMiniLauncherPosition();
      } else {
        applyPosition(getCurrentRootPos(), true);
      }
    });
  }

  function renderCollapsedState() {
    if (panelEl) panelEl.style.display = isCollapsed ? 'none' : 'block';
    if (miniEl) miniEl.style.display = isCollapsed ? 'flex' : 'none';
  }

  /**
   * 切换主面板展开/收起状态
   * Toggle expanded/collapsed panel state
   */
  function setCollapsed(nextCollapsed) {
    if (rootEl && !isCollapsed) {
      applyPosition(getCurrentRootPos(), true);
    }

    isCollapsed = Boolean(nextCollapsed);
    localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));

    renderCollapsedState();
    if (isCollapsed) {
      scheduleMiniPositionUpdate();
    } else {
      // 恢复主面板显示状态
      // Restore main panel visibility state
      restorePanelPosition();
    }
  }

  /**
   * 只用于主面板标题栏拖动
   * Enable dragging for the main panel header only
   */
  function makeDraggable(handle) {
    handle.addEventListener('pointerdown', event => {
      if (!rootEl) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;

      const startX = event.clientX;
      const startY = event.clientY;
      const startPos = getCurrentRootPos();
      let dragging = false;

      const onMove = moveEvent => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const moved = Math.hypot(dx, dy);

        if (!dragging && moved <= 5) return;

        dragging = true;
        document.body.style.userSelect = 'none';
        applyPosition({
          left: startPos.left + dx,
          top: startPos.top + dy,
        });
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('pointercancel', onUp, true);
        document.body.style.userSelect = '';

        if (dragging) {
          applyPosition(getCurrentRootPos(), true);
        }
      };

      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onUp, true);
    });
  }

  function showToast(message, type = 'normal') {
    let toast = document.getElementById(TOAST_ID);

    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }

    const panelRect = rootEl?.getBoundingClientRect();
    const toastWidth = Math.min(360, window.innerWidth - 32);
    let left = window.innerWidth - toastWidth - 24;
    let top = window.innerHeight - 132;

    if (panelRect) {
      left = clamp(panelRect.left, 16, window.innerWidth - toastWidth - 16);
      top = clamp(panelRect.top - 52, 16, window.innerHeight - 58);
    }

    toast.style.left = `${Math.round(left)}px`;
    toast.style.top = `${Math.round(top)}px`;
    toast.style.right = 'auto';
    toast.style.bottom = 'auto';
    toast.style.width = `${Math.round(toastWidth)}px`;
    toast.style.background = type === 'error' ? '#3b3b3b' : type === 'success' ? '#111' : '#222';
    toast.textContent = message;
    toast.style.opacity = '1';

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.style.opacity = '0';
    }, 2400);
  }

  // 主面板视图
  // Main panel view
  /**
   * 渲染主功能按钮
   * Render main action buttons
   */
  function renderMainView(content) {
    content.appendChild(makeButton(t('copyText'), handleCopy, 'xhs-note-collector-main-btn'));
    content.appendChild(makeButton(t('downloadCurrent'), handleDownloadCurrent, 'xhs-note-collector-main-btn'));
    content.appendChild(makeButton(t('downloadAll'), handleDownloadAll, 'xhs-note-collector-main-btn'));
    content.appendChild(makeButton(t('copyLinks'), handleCopyLinks, 'xhs-note-collector-main-btn'));

    if (devMode) {
      content.appendChild(makeButton(t('copyProbe'), handleCopyProbe, 'xhs-note-collector-main-btn'));
    }
  }

  // 设置视图
  // Settings view
  /**
   * 渲染语言、主题和开发者测试设置
   * Render language, theme, and developer-test settings
   */
  function renderSettingsView(content) {
    content.appendChild(makeButton(t('back'), () => {
      currentView = 'main';
      renderPanel();
    }, 'xhs-note-collector-btn-secondary'));

    const langRow = document.createElement('div');
    langRow.className = 'xhs-note-collector-row';
    const langLabel = document.createElement('div');
    langLabel.className = 'xhs-note-collector-label';
    langLabel.textContent = t('language');
    const langOptions = document.createElement('div');
    langOptions.className = 'xhs-note-collector-options two';
    langOptions.appendChild(makeOptionButton('中文', 'zh', uiLang, value => {
      uiLang = value;
      localStorage.setItem(LANG_KEY, uiLang);
      renderPanel();
      updateMiniText();
      showToast(t('langChanged'), 'success');
    }));
    langOptions.appendChild(makeOptionButton('English', 'en', uiLang, value => {
      uiLang = value;
      localStorage.setItem(LANG_KEY, uiLang);
      renderPanel();
      updateMiniText();
      showToast(t('langChanged'), 'success');
    }));
    langRow.appendChild(langLabel);
    langRow.appendChild(langOptions);
    content.appendChild(langRow);

    const themeRow = document.createElement('div');
    themeRow.className = 'xhs-note-collector-row';
    const themeLabel = document.createElement('div');
    themeLabel.className = 'xhs-note-collector-label';
    themeLabel.textContent = `${t('theme')} · ${t('detectedTheme')}: ${detectedTheme}`;
    const themeOptions = document.createElement('div');
    themeOptions.className = 'xhs-note-collector-options';
    [
      ['auto', t('auto')],
      ['light', t('light')],
      ['dark', t('dark')],
    ].forEach(([value, label]) => {
      themeOptions.appendChild(makeOptionButton(label, value, themePref, next => {
        themePref = next;
        localStorage.setItem(THEME_KEY, themePref);
        applyTheme();
        renderPanel();
        showToast(t('themeChanged'), 'success');
      }));
    });
    themeRow.appendChild(themeLabel);
    themeRow.appendChild(themeOptions);
    content.appendChild(themeRow);

    const devRow = document.createElement('div');
    devRow.className = 'xhs-note-collector-row';
    const devLabel = document.createElement('div');
    devLabel.className = 'xhs-note-collector-label';
    devLabel.textContent = t('developerTest');
    const devOptions = document.createElement('div');
    devOptions.className = 'xhs-note-collector-options two';
    devOptions.appendChild(makeOptionButton(t('off'), false, devMode, value => {
      saveDevMode(value);
      renderPanel();
    }));
    devOptions.appendChild(makeOptionButton(t('on'), true, devMode, value => {
      saveDevMode(value);
      renderPanel();
    }));
    devRow.appendChild(devLabel);
    devRow.appendChild(devOptions);
    content.appendChild(devRow);
  }

  /**
   * 重新渲染完整主面板
   * Re-render the full main panel
   */
  function renderPanel() {
    if (!panelEl) return;
    panelEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'xhs-note-collector-header';

    const heading = document.createElement('div');
    heading.className = 'xhs-note-collector-heading';
    heading.textContent = t('title');

    const headerActions = document.createElement('div');
    headerActions.className = 'xhs-note-collector-header-actions';
    if (currentView !== 'settings') {
      headerActions.appendChild(makeHeaderButton(t('settings'), () => {
        currentView = 'settings';
        renderPanel();
      }));
    }
    headerActions.appendChild(makeHeaderButton(t('hide'), () => setCollapsed(true)));

    header.appendChild(heading);
    header.appendChild(headerActions);
    makeDraggable(header);

    const content = document.createElement('div');
    content.className = 'xhs-note-collector-content';

    if (currentView === 'settings') {
      renderSettingsView(content);
    } else {
      renderMainView(content);
    }

    panelEl.appendChild(header);
    panelEl.appendChild(content);
  }

  // 迷你入口按钮
  // Mini launcher button
  /**
   * 根据当前语言更新迷你入口文案
   * Update mini launcher label from current language
   */
  function updateMiniText() {
    if (!miniEl) return;
    const textEl = miniEl.querySelector('.xhs-note-collector-mini-text');
    if (textEl) textEl.textContent = t('mini');
    miniEl.title = t('miniTitle');
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    return panel;
  }

  /**
   * 创建固定右侧的胶囊形迷你入口按钮
   * Create fixed right-side capsule mini launcher
   */
  function createMiniButton() {
    const mini = document.createElement('button');
    mini.type = 'button';
    mini.className = 'xhs-note-collector-mini';
    mini.dataset.xhsFloatingLauncher = 'true';
    mini.dataset.xhsFloatingApp = 'image-copy';
    mini.dataset.xhsFloatingOrder = '10';

    const icon = document.createElement('span');
    icon.className = 'xhs-note-collector-mini-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="2.8" width="10" height="10.4" rx="2"></rect>
        <path d="M5.6 6.1h4.8"></path>
        <path d="M5.6 8.3h3.4"></path>
        <path d="M5.6 10.5h2.4"></path>
      </svg>
    `;

    const text = document.createElement('span');
    text.className = 'xhs-note-collector-mini-text';

    mini.appendChild(icon);
    mini.appendChild(text);
    mini.addEventListener('click', event => {
      event.stopPropagation();
      // 点击迷你入口后恢复主面板
      // Restore main panel when the mini launcher is clicked
      setCollapsed(false);
    });

    return mini;
  }

  // 初始化逻辑
  // Initialization logic
  /**
   * 确保插件 UI 存在并恢复当前状态
   * Ensure plugin UI exists and restore current state
   */
  function ensureRoot() {
    if (!document.body) return;
    injectStyle();

    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      rootEl = existing;
      panelEl = document.getElementById(PANEL_ID);
      miniEl = rootEl.querySelector('.xhs-note-collector-mini');
      applyTheme();
      scheduleMiniPositionUpdate();
      return;
    }

    rootEl = document.createElement('div');
    rootEl.id = ROOT_ID;
    panelEl = createPanel();
    miniEl = createMiniButton();

    rootEl.appendChild(panelEl);
    rootEl.appendChild(miniEl);
    document.body.appendChild(rootEl);

    applyTheme();
    renderPanel();
    updateMiniText();
    renderCollapsedState();
    if (isCollapsed) {
      scheduleMiniPositionUpdate();
    } else {
      restorePanelPosition();
    }
  }

  /**
   * 初始化脚本并监听小红书 SPA DOM 变化
   * Initialize script and watch RedNote SPA DOM changes
   */
  function init() {
    ensureRoot();

    const observer = new MutationObserver(() => {
      ensureRoot();
      scheduleMiniPositionUpdate();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('resize', clampCurrentPosition);
    window.setInterval(() => {
      const before = detectedTheme;
      applyTheme();
      if (themePref === 'auto' && currentView === 'settings' && before !== detectedTheme) {
        renderPanel();
      }
      ensureRoot();
      scheduleMiniPositionUpdate();
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
