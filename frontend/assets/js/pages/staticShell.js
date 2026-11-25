import { initShell } from "../main.js?v=store-logo-dark-2";

const page =
  location.pathname
    .split("/")
    .pop()
    ?.replace(/\.html$/, "") || "";
initShell(page && page !== "404" ? { currentPage: page } : {});
