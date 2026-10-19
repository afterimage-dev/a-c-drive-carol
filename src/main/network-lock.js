// Nothing leaves your computer. Every web request from every window is cancelled unless it's one of the app's own
// files, and Chromium can't resolve any host name at all. No analytics, no AI calls, no updates.

import { app, session } from "electron";
import { isAllowedUrl } from "./app-url.js";

/** Call before the app is ready: no host name will resolve, whatever asks. */
export function lockBeforeReady() {
  app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");
}

/** Call once the app is ready: cancel requests, refuse new windows, navigation and permissions. */
export function lockSession(ses = session.defaultSession) {
  ses.webRequest.onBeforeRequest((details, done) => done({ cancel: !isAllowedUrl(details.url) }));
  ses.setPermissionRequestHandler((_wc, _permission, done) => done(false));
  ses.setPermissionCheckHandler(() => false);
  app.on("web-contents-created", (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (e, url) => { if (!url.startsWith("app://")) e.preventDefault(); });
    contents.on("will-attach-webview", (e) => e.preventDefault());
  });
}
