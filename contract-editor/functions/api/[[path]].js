// Cloudflare Pages Functions：/api/* 全部交給 server/router.js（實作都在 server/）。
import { handleApi } from "../../server/router.js";

export const onRequest = (context) => handleApi(context);
