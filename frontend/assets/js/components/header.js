import { icon } from './icons.js';
import { mainNav } from '../data/navigation.js';
import { cartCount } from '../services/cartService.js';
import { getWishlist } from '../services/wishlistService.js';
import { openCartDrawer } from './cartDrawer.js';
import { openSearchOverlay } from './searchOverlay.js';
import { fetchMenuLinks } from '../services/productService.js';
import { startLiveRefresh } from '../services/liveRefresh.js';

export function renderHeader({ transparentOnHero = false, currentPage = '' } = {}) {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  mount.innerHTML = `
    <header class="site-header ${transparentOnHero ? 'is-transparent' : ''}" id="siteHeader">
      <div class="container site-header__inner">
        <div class="site-header__side">
          <button class="icon-btn hamburger" id="openMobileNav" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
            ${icon('menu')}
          </button>
          <nav class="primary-nav" aria-label="Main">
            <ul class="primary-nav__list">
              ${mainNav.map((item) => `<li><a class="primary-nav__link${item.label.includes('SUMMER') ? ' primary-nav__link--summer' : ''}" href="${item.href}" ${isCurrent(item, currentPage) ? 'aria-current="page"' : ''}>${item.label}</a></li>`).join('')}
            </ul>
          </nav>
        </div>
        <a href="index.html" class="site-logo" aria-label="Nuvanti — Home"><img src="assets/img/brand/nuvanti-logo.png" alt="Nuvanti" class="site-logo__mark" id="headerLogoImg" /></a>
        <div class="site-header__side site-header__side--end">
          <button class="icon-btn" id="openSearch" aria-label="Search">${icon('search')}</button>
          <a class="icon-btn" href="account.html" aria-label="Account">${icon('user')}</a>
          <a class="icon-btn" href="wishlist.html" aria-label="Wishlist" style="position:relative">
            ${icon('heart')}
            <span class="cart-count" id="wishlistCount" style="display:none">0</span>
          </a>
          <button class="icon-btn" id="openCart" aria-label="Open cart" style="position:relative">
            ${icon('bag')}
            <span class="cart-count" id="cartCount" style="display:none">0</span>
          </button>
        </div>
      </div>
    </header>

    <div class="scrim" id="navScrim"></div>

    <nav class="mobile-nav" id="mobileNav" aria-label="Mobile" data-open="false">
      <div class="mobile-nav__top">
        <a href="index.html" class="site-logo" aria-label="Nuvanti — Home"><img src="assets/img/brand/nuvanti-logo.png" alt="Nuvanti" class="site-logo__mark" /></a>
        <button class="icon-btn" id="closeMobileNav" aria-label="Close menu">${icon('close')}</button>
      </div>
      <ul class="mobile-nav__list">
        ${mainNav.filter((item) => !item.href.includes('collection=')).map((item) => `<li><a class="mobile-nav__link" href="${item.href}">${item.label}</a></li>`).join('')}
        ${renderMenuGroup('collection', 'Collections')}
        ${renderMenuGroup('category', 'Categories')}
      </ul>
      <div class="mobile-nav__foot">
        <a href="account.html" class="btn btn-outline btn-block">Account</a>
        <a href="wishlist.html" class="btn btn-text">Wishlist</a>
      </div>
    </nav>
  `;

  const header = document.getElementById('siteHeader');
  const mobileNav = document.getElementById('mobileNav');
  const scrim = document.getElementById('navScrim');

  function openNav() {
    mobileNav.dataset.open = 'true';
    scrim.dataset.open = 'true';
    document.getElementById('openMobileNav').setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeNav() {
    mobileNav.dataset.open = 'false';
    scrim.dataset.open = 'false';
    document.getElementById('openMobileNav').setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  document.getElementById('openMobileNav').addEventListener('click', openNav);
  document.getElementById('closeMobileNav').addEventListener('click', closeNav);
  scrim.addEventListener('click', closeNav);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeNav();
    document.querySelectorAll('[data-menu-group][data-open="true"]').forEach((group) => {
      group.dataset.open = 'false';
      group.querySelector('[data-menu-group-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-menu-group]')) return;
    document.querySelectorAll('[data-menu-group][data-open="true"]').forEach((group) => {
      group.dataset.open = 'false';
      group.querySelector('[data-menu-group-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  });
  document.querySelectorAll('[data-menu-group-toggle]').forEach((button) => button.addEventListener('click', () => {
    const group = button.closest('[data-menu-group]');
    const isOpen = group.dataset.open === 'true';
    group.dataset.open = String(!isOpen);
    button.setAttribute('aria-expanded', String(!isOpen));
  }));

  const refreshMenuLinks = async () => {
    const items = await fetchMenuLinks();
    const signature = JSON.stringify(items);
    const primaryList = document.querySelector('.primary-nav__list');
    if (primaryList && primaryList.dataset.primaryCollectionsSignature !== signature) {
      primaryList.querySelectorAll('[data-configured-primary-collection]').forEach((item) => item.remove());
      const collections = Array.isArray(items) ? items.filter((item) => item.type === 'collection') : [];
      primaryList.insertAdjacentHTML('beforeend', collections.map((item) => renderPrimaryCollectionItem(item, currentPage)).join(''));
      primaryList.dataset.primaryCollectionsSignature = signature;
    }
    syncPrimaryCollectionStyles(items);
    [
      ['collection', 'mobile'], ['category', 'mobile'],
    ].forEach(([type, target]) => {
      const group = document.querySelector(`[data-menu-group="${type}"][data-menu-target="${target}"]`);
      const list = group?.querySelector('[data-menu-items]');
      if (!list || list.dataset.menuItemsSignature === signature) return;
      if (Array.isArray(items)) list.querySelectorAll('[data-default-menu-link]').forEach((item) => item.remove());
      list.querySelectorAll('[data-configured-menu-item]').forEach((item) => item.remove());
      const groupItems = Array.isArray(items) ? items.filter((item) => item.type === type && item.menuShow === true) : [];
      if (groupItems.length) {
        list.insertAdjacentHTML('beforeend', groupItems.map(renderMenuItem).join(''));
      }
      group.hidden = Array.isArray(items) && groupItems.length === 0;
      list.dataset.menuItemsSignature = signature;
    });
  };
  refreshMenuLinks().catch((error) => console.warn('Store menu links unavailable:', error));
  startLiveRefresh(refreshMenuLinks, 5000);

  document.getElementById('openCart').addEventListener('click', () => openCartDrawer());
  document.getElementById('openSearch').addEventListener('click', () => openSearchOverlay());

  const logoImg = document.getElementById('headerLogoImg');
  if (transparentOnHero) {
    const onScroll = () => {
      const scrolled = window.scrollY > 40;
      header.classList.toggle('is-scrolled', scrolled);
      if (logoImg) logoImg.src = scrolled ? 'assets/img/brand/nuvanti-logo.png' : 'assets/img/brand/nuvanti-logo-white.png';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else {
    header.classList.add('is-scrolled');
  }

  refreshHeaderCounts();
}

function renderPrimaryCollectionItem(item) {
  if (!/^[a-z0-9-]{1,80}$/.test(item.slug || '')) return '';
  const label = escapeMenuText(item.menuLabel || item.name);
  const href = `shop.html?collection=${encodeURIComponent(item.slug)}`;
  const currentSlug = new URLSearchParams(window.location.search).get('collection');
  const isActive = currentSlug === item.slug;
  return `<li data-configured-primary-collection><a class="primary-nav__link" href="${href}"${isActive ? ' aria-current="page"' : ''}>${label}</a></li>`;
}

function syncPrimaryCollectionStyles(items) {
  const collections = new Map((Array.isArray(items) ? items : [])
    .filter((item) => item.type === 'collection')
    .map((item) => [item.slug, item]));
  document.querySelectorAll('.primary-nav__link[href*="collection="]').forEach((link) => {
    const slug = new URL(link.href, window.location.href).searchParams.get('collection');
    const item = collections.get(slug);
    const baseLabel = link.dataset.baseMenuLabel || (link.dataset.baseMenuLabel = link.textContent.trim());
    const label = escapeMenuText(item?.menuLabel || baseLabel);
    const appearance = menuAppearanceFor(item, 'desktop');
    const glyph = getMenuGlyph(appearance.icon);
    const animation = appearance.animation;
    link.classList.remove(...menuAnimations.map((name) => `menu-effect--${name}`));
    link.classList.remove(...menuStyles.map((name) => `menu-style--${name}`));
    link.classList.remove(...menuShapes.map((name) => `menu-shape--${name}`));
    link.classList.remove(...menuIconPositions.map((name) => `menu-icon-position--${name}`));
    link.classList.remove('menu-box-fill');
    if (item) link.classList.remove('primary-nav__link--summer');
    if (animation !== 'none') link.classList.add(`menu-effect--${animation}`);
    const detail = glyph ? `<span class="menu-button__icon" aria-hidden="true">${glyph}</span>` : '';
    link.innerHTML = `<span class="menu-button__content">${appearance.iconPosition === 'right' ? `<span class="menu-button__label">${label}</span>${detail}` : `${detail}<span class="menu-button__label">${label}</span>`}</span>`;
    ['background', 'color', 'border-radius', 'padding', '--menu-bg', '--menu-bg-start', '--menu-bg-end', '--menu-text'].forEach((property) => link.style.removeProperty(property));
    const style = appearance.style;
    const start = appearance.backgroundColor;
    const end = appearance.backgroundEndColor || null;
    const background = menuFill(start, end, appearance.gradientDirection);
    const text = appearance.textColor;
    link.style.setProperty('--menu-bg', background);
    link.style.setProperty('--menu-bg-start', start);
    link.style.setProperty('--menu-bg-end', end || start);
    link.style.setProperty('--menu-text', text);
    link.style.setProperty('color', text, 'important');
    if (appearance.shape !== 'design') link.classList.add(`menu-shape--${appearance.shape}`);
    link.classList.add(`menu-icon-position--${appearance.iconPosition}`);
    if (appearance.fill && menuTransparentStyles.includes(style)) link.classList.add('menu-box-fill');
    if (style === 'link') {
      if (item) link.style.background = 'transparent';
      return;
    }
    link.classList.add(`menu-style--${style}`);
    link.style.padding = style === 'underline' ? '.35rem .15rem'
      : style === 'tag' ? '.45rem 1.45rem .45rem 1.25rem' : '.45rem 1rem';
  });
}

function renderMenuGroup(type, label) {
  const staticCollections = type === 'collection'
    ? mainNav.filter((item) => item.href.includes('collection=')).map((item) => {
      const className = item.label.includes('SUMMER') ? ' mobile-nav__link--summer' : '';
      return `<li data-default-menu-link><a class="mobile-nav__link${className}" href="${item.href}">${item.label}</a></li>`;
    }).join('')
    : '';
  return `<li class="mobile-nav__group" data-menu-group="${type}" data-menu-target="mobile"${type === 'category' ? ' hidden' : ''}>
    <button type="button" class="mobile-nav__group-toggle" data-menu-group-toggle aria-controls="mobile-${type}-submenu" aria-expanded="false">${label}<span aria-hidden="true">⌄</span></button>
    <ul class="mobile-nav__submenu" id="mobile-${type}-submenu" data-menu-items>${staticCollections}</ul>
  </li>`;
}

function renderMenuItem(item) {
  if (!['category', 'collection'].includes(item.type) || !/^[a-z0-9-]{1,80}$/.test(item.slug || '')) return '';
  const label = escapeMenuText(item.menuLabel || item.name);
  const href = `shop.html?${item.type}=${encodeURIComponent(item.slug)}`;
  const appearance = menuAppearanceFor(item, 'mobile');
  const style = appearance.style;
  const color = appearance.backgroundColor;
  const endColor = appearance.backgroundEndColor || null;
  const textColor = appearance.textColor;
  const customStyle = ` style="--menu-bg:${menuFill(color, endColor, appearance.gradientDirection)};--menu-bg-start:${color};--menu-bg-end:${endColor || color};--menu-text:${textColor};color:${textColor}!important"`;
  const glyph = getMenuGlyph(appearance.icon);
  const animation = appearance.animation !== 'none' ? ` menu-effect--${appearance.animation}` : '';
  const design = style === 'link' ? '' : ` menu-style--${style}`;
  const shape = appearance.shape === 'design' ? '' : ` menu-shape--${appearance.shape}`;
  const fill = appearance.fill && menuTransparentStyles.includes(style) ? ' menu-box-fill' : '';
  const detail = glyph ? `<span class="menu-button__icon" aria-hidden="true">${glyph}</span>` : '';
  const contents = appearance.iconPosition === 'right' ? `<span class="menu-button__label">${label}</span>${detail}` : `${detail}<span class="menu-button__label">${label}</span>`;
  return `<li data-configured-menu-item><a class="mobile-nav__link mobile-nav__link--${style}${design}${shape}${fill} menu-icon-position--${appearance.iconPosition}${animation}" href="${href}"${customStyle}><span class="menu-button__content">${contents}</span></a></li>`;
}

function menuFill(start, end, direction) {
  if (!end) return start;
  return direction === 'circle' ? `radial-gradient(circle,${start},${end})` : `linear-gradient(${['110deg', '135deg', 'to bottom'].includes(direction) ? direction : '110deg'},${start},${end})`;
}

function getMenuGlyph(name) {
  return ({ sparkle: '✦', star: '★', heart: '♥', arrow: '→', leaf: '❧', diamond: '◆', bolt: 'ϟ', flower: '✿', crown: '♛', dot: '•', sun: '☼', moon: '☾', wave: '〰', check: '✓', smile: '☺', plus: '+', ribbon: '♧', flame: '♨', music: '♫', infinity: '∞', clover: '☘', flag: '⚑', snowflake: '❄', 'ice-crystal': '❈', comet: '☄', planet: '♄', butterfly: '🦋', lightning: 'ϟ', sparkles: '✨', 'flower-star': '❋', eye: '◉', mountain: '▲', sunrise: '☀', cloud: '☁', drop: '◆', 'circular-arrow': '⟳', 'check-circle': '●✓', cross: '✚', 'crown-small': '♕', peace: '☮', 'diamond-ring': '◇', crescent: '☽', snowman: '☃', asterisk: '✳', 'ice-cube': '🧊', icicle: '❅', 'frost-star': '❉', snowfall: '❆', iceberg: '◢', mittens: '🧤', 'mountain-snow': '♧', evergreen: '♣', 'north-star': '✧' })[name] || '';
}

const menuStyles = ['link','pill','card','outline','soft','glass','gradient','elevated','glow','cut','underline','double','sticker','gradient-outline','neon','dashed','tag','corner','inset','bevel','bubble','ribbon','hollow','gloss','aurora','frost','chrome','rainbow-edge','satin','ticket','pixel','mesh','halo','stamp','arch','notched','pearl','slime','starlight','ice-glass','ice-border','prism','foil','split','frost-corner','badge','orbit','paper'];
const menuShapes = ['pill','rounded','square','cut','arch','capsule','organic'];
const menuIconPositions = ['left','right','top'];
const menuTransparentStyles = ['link','outline','underline','double','gradient-outline','dashed','hollow','pixel','halo','stamp','arch','notched','ice-border','badge','orbit','paper'];
const menuAnimations = ['ice','ice-rain','icicle-drop','ice-drip','snowfall','snowstorm','blizzard','sleet','snowflake-spin','ice-crack','frost','glacier-glow','polar-lights','frozen','aurora','comet-trail','confetti','spark-rain','pulse','float','glow','bounce','sweep','shine','tilt','orbit','twinkle','wave','pop','wiggle','heartbeat','spin','jelly','ripple','neon-flicker','flame','shimmer','drift','march','breathe','sparkle-burst','swing','flip','magnet','glitch','rainbow'];
const menuIcons = ['none','sparkle','star','heart','arrow','leaf','diamond','bolt','flower','crown','dot','sun','moon','wave','check','smile','plus','ribbon','flame','music','infinity','clover','flag','snowflake','ice-crystal','comet','planet','butterfly','lightning','sparkles','flower-star','eye','mountain','sunrise','cloud','drop','circular-arrow','check-circle','cross','crown-small','peace','diamond-ring','crescent','snowman','asterisk','ice-cube','icicle','frost-star','snowfall','iceberg','mittens','mountain-snow','evergreen','north-star'];
function menuAppearanceFor(item, device) {
  const saved = item?.[device === 'desktop' ? 'menuDesktopAppearance' : 'menuMobileAppearance'];
  const profile = saved && typeof saved === 'object' && !Array.isArray(saved) && Object.keys(saved).length
    ? saved
    : { style: item?.menuStyle, backgroundColor: item?.menuBackgroundColor, backgroundEndColor: item?.menuBackgroundEndColor, textColor: item?.menuTextColor, icon: item?.menuIcon, animation: item?.menuAnimation };
  const color = (value, fallback) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback;
  return {
    style: menuStyles.includes(profile.style) ? profile.style : (device === 'desktop' || !item ? 'link' : 'pill'),
    shape: ['design', ...menuShapes].includes(profile.shape) ? profile.shape : 'design',
    fill: profile.fill !== false,
    backgroundColor: color(profile.backgroundColor, '#35604a'),
    backgroundEndColor: color(profile.backgroundEndColor, ''),
    gradientDirection: ['110deg', '135deg', 'to bottom', 'circle'].includes(profile.gradientDirection) ? profile.gradientDirection : '110deg',
    textColor: color(profile.textColor, '#ffffff'),
    icon: menuIcons.includes(profile.icon) ? profile.icon : 'none',
    iconPosition: menuIconPositions.includes(profile.iconPosition) ? profile.iconPosition : 'left',
    animation: menuAnimations.includes(profile.animation) ? profile.animation : 'none',
  };
}

function escapeMenuText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function refreshHeaderCounts() {
  const cartEl = document.getElementById('cartCount');
  const wishEl = document.getElementById('wishlistCount');
  if (cartEl) {
    const n = cartCount();
    cartEl.textContent = String(n);
    cartEl.style.display = n > 0 ? 'flex' : 'none';
  }
  if (wishEl) {
    const n = getWishlist().length;
    wishEl.textContent = String(n);
    wishEl.style.display = n > 0 ? 'flex' : 'none';
  }
}

function isCurrent(item, currentPage) {
  return currentPage && item.href.startsWith(currentPage);
}
