import { icon } from './icons.js';
import { footerNav } from '../data/navigation.js';

export function renderFooter() {
  const mount = document.getElementById('site-footer');
  if (!mount) return;

  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col footer-brand">
            <a href="index.html" class="site-logo" aria-label="Nuvanti — Home"><img src="assets/img/brand/nuvanti-logo-white.png" alt="Nuvanti" class="site-logo__mark" /></a>
            <p>Considered clothing for people who dress with intent. Designed in-house, made to last.</p>
            <div class="footer-social">
              <a class="icon-btn btn-ink-outline" style="border:1px solid var(--color-border-inverse)" href="https://www.instagram.com/_.nuvanti._/" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}</a>
              <a class="icon-btn btn-ink-outline" style="border:1px solid var(--color-border-inverse)" href="https://www.tiktok.com/@nuvanti1" target="_blank" rel="noopener" aria-label="TikTok">${icon('tiktok')}</a>
            </div>
          </div>
          ${Object.entries(footerNav).map(([title, links]) => `
            <div class="footer-col">
              <h4>${title}</h4>
              <ul>${links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}</ul>
            </div>
          `).join('')}
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} Nuvanti. All rights reserved.</span>
          <div class="payment-row" aria-label="Accepted payment methods">
            <span class="payment-chip">CASH ON DELIVERY</span>
          </div>
          <span>Egypt (EGP ج.م)</span>
        </div>
      </div>
    </footer>
  `;
}
