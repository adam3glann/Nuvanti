import { getCurrentUser } from "../services/authService.js?v=account-cart-sync-1";

const DISMISSAL_KEY = "nuvanti_signup_offer_dismissed_until";
const DISMISSAL_MS = 7 * 24 * 60 * 60 * 1000;
let timer = null;
let scheduled = false;
let shownThisPage = false;

export function scheduleSignupOffer(settings) {
  if (!settings.signupOfferEnabled || shownThisPage) {
    clearTimeout(timer);
    timer = null;
    scheduled = false;
    return;
  }
  if (
    scheduled ||
    location.pathname.endsWith("/account.html") ||
    location.pathname === "/account.html"
  )
    return;
  if (wasRecentlyDismissed()) return;

  scheduled = true;
  const delay =
    Number.isInteger(settings.signupOfferDelaySeconds) &&
    settings.signupOfferDelaySeconds >= 1 &&
    settings.signupOfferDelaySeconds <= 120
      ? settings.signupOfferDelaySeconds
      : 8;
  timer = setTimeout(async () => {
    timer = null;
    if (wasRecentlyDismissed()) {
      scheduled = false;
      return;
    }
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      scheduled = false;
      return;
    }
    scheduled = false;
    if (user || wasRecentlyDismissed()) return;
    showOffer(settings);
  }, delay * 1000);
}

function wasRecentlyDismissed() {
  try {
    return Number(localStorage.getItem(DISMISSAL_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISSAL_KEY, String(Date.now() + DISMISSAL_MS));
  } catch {
    // The popup still works when browser storage is unavailable.
  }
}

function showOffer(settings) {
  if (document.getElementById("signupOfferDialog")) return;
  shownThisPage = true;
  rememberDismissal();

  const priorFocus = document.activeElement;
  const priorOverflow = document.body.style.overflow;
  const overlay = document.createElement("div");
  overlay.className = "signup-offer-overlay";
  overlay.id = "signupOfferOverlay";
  const dialog = document.createElement("section");
  dialog.className = "signup-offer-dialog";
  dialog.id = "signupOfferDialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const closeButton = document.createElement("button");
  closeButton.className = "signup-offer-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close offer");
  closeButton.textContent = "×";
  const eyebrow = document.createElement("p");
  eyebrow.className = "signup-offer-eyebrow";
  eyebrow.textContent = "A welcome offer from Nuvanti";
  const title = document.createElement("h2");
  title.className = "signup-offer-title";
  title.id = "signupOfferTitle";
  title.textContent = String(settings.signupOfferTitle || "Join Nuvanti").slice(
    0,
    120,
  );
  dialog.setAttribute("aria-labelledby", title.id);
  const message = document.createElement("p");
  message.className = "signup-offer-message";
  message.id = "signupOfferMessage";
  message.textContent = String(settings.signupOfferText || "").slice(0, 300);
  dialog.setAttribute("aria-describedby", message.id);
  const actions = document.createElement("div");
  actions.className = "signup-offer-actions";
  const createAccount = document.createElement("a");
  createAccount.className = "btn btn-primary";
  createAccount.href = "account.html?register=1";
  createAccount.textContent = "Create Account";
  const signIn = document.createElement("a");
  signIn.className = "btn btn-outline";
  signIn.href = "account.html";
  signIn.textContent = "Sign In";
  actions.append(createAccount, signIn);
  dialog.append(closeButton, eyebrow, title, message, actions);
  overlay.append(dialog);
  document.body.append(overlay);
  document.body.style.overflow = "hidden";

  const close = () => {
    overlay.remove();
    document.body.style.overflow = priorOverflow;
    document.removeEventListener("keydown", onKeyDown);
    if (priorFocus instanceof HTMLElement) priorFocus.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const controls = [
        ...dialog.querySelectorAll("a[href], button:not(:disabled)"),
      ];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKeyDown);
  createAccount.focus();
}
