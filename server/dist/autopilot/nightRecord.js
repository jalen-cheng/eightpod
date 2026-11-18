// Counts the times a sleeper stopped being asleep and later slept again

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="c1a0e9e2-faff-5c93-925e-2b442ee82d44")}catch(e){}}();
export function countWakeUps(minutes) {
    let wakeUps = 0;
    let hasSlept = false;
    let isBroken = false;
    for (const minute of minutes) {
        if (minute.stage === 'asleep') {
            if (isBroken)
                wakeUps++;
            hasSlept = true;
            isBroken = false;
        }
        else if (hasSlept) {
            isBroken = true;
        }
    }
    return wakeUps;
}
//# sourceMappingURL=nightRecord.js.map
//# debugId=c1a0e9e2-faff-5c93-925e-2b442ee82d44
