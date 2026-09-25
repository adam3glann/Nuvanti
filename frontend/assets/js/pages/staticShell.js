import { initShell } from '../main.js';

const page = location.pathname.split('/').pop()?.replace(/\.html$/, '') || '';
initShell(page && page !== '404' ? { currentPage: page } : {});
