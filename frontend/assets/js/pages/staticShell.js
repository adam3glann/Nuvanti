import { initShell } from "../main.js?v=permanent-dark-3";

const page =
  location.pathname
    .split("/")
    .pop()
    ?.replace(/\.html$/, "") || "";
initShell(page && page !== "404" ? { currentPage: page } : {});
