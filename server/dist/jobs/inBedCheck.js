
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="fc9ef4a2-b362-5398-928f-83b5453db042")}catch(e){}}();
let registeredCheck;
export function registerInBedCheck(check) {
    registeredCheck = check;
}
// True only when the bed's sensors say someone is on that side right now
export function isSomeoneInBed(side) {
    return registeredCheck?.(side) ?? false;
}
//# sourceMappingURL=inBedCheck.js.map
//# debugId=fc9ef4a2-b362-5398-928f-83b5453db042
