// app://carol/<path> serves the app's own files, and only from a few folders. Pages never load anything else.

import { protocol, net } from "electron";
import { pathToFileURL } from "node:url";
import { resolveAppUrl, ORIGIN } from "./app-url.js";

export { ORIGIN };
export const SCHEME = "app";

/** Must run before the app is ready. */
export function registerScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }]);
}

export function handleScheme(root) {
  protocol.handle(SCHEME, (req) => {
    const abs = resolveAppUrl(req.url, root);
    if (!abs) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(abs).toString());
  });
}
