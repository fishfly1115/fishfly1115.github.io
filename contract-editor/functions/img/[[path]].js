// Cloudflare Pages Functions：/img/* 交給 server/routes/images.js。
import { serveImage } from "../../server/routes/images.js";

export const onRequestGet = (context) => serveImage(context);
