import { initShell } from '../main.js?v=store-theme-1';

const page = location.pathname.split('/').pop()?.replace(/\.html$/, '') || '';
initShell(page && page !== '404' ? { currentPage: page } : {});
