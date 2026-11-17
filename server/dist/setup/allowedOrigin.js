// Decides which pages may call the API. Browsers send an Origin header with the app's own
// script files and API calls, so every name the Pod can be opened under has to be allowed here,
// or the app loads as a blank page. Anything else is refused, which stops a web page on the
// internet from driving the bed through a visitor's browser.
// Home network ranges, plus the range Tailscale gives its devices (100.64.0.0/10)

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="7633fd5b-543b-5f80-b7b6-027cb929673b")}catch(e){}}();
const PRIVATE_IPV4_PATTERNS = [
    /^10\.\d+\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/,
    /^127\.\d+\.\d+\.\d+$/,
];
const TAILSCALE_NAME_SUFFIX = '.ts.net';
// True when the host part of an origin is the Pod itself under one of its names:
// "eight-pod", "eight-pod.local", or "eight-pod.<tailnet>.ts.net".
function isPodName(originHostname, podHostname) {
    if (!podHostname)
        return false;
    return originHostname === podHostname
        || originHostname === `${podHostname}.local`
        || (originHostname.startsWith(`${podHostname}.`) && originHostname.endsWith(TAILSCALE_NAME_SUFFIX));
}
// Requests with no Origin header (curl, phone shortcuts, opening the page itself) are allowed
export function isAllowedOrigin(origin, rules) {
    if (!origin || rules.extraAllowedOrigin === '*')
        return true;
    if (rules.extraAllowedOrigin && origin.startsWith(rules.extraAllowedOrigin))
        return true;
    let originHostname;
    try {
        originHostname = new URL(origin).hostname.toLowerCase();
    }
    catch {
        return false;
    }
    return originHostname === 'localhost'
        || PRIVATE_IPV4_PATTERNS.some(pattern => pattern.test(originHostname))
        || isPodName(originHostname, rules.podHostname.toLowerCase());
}
//# sourceMappingURL=allowedOrigin.js.map
//# debugId=7633fd5b-543b-5f80-b7b6-027cb929673b
