export function isUrl(value) {
    try {
        if (!value)
            return false;
        const url = new URL(value);
        return !!url.hostname;
    }
    catch {
        return false;
    }
}
export function isHttpsUrl(value) {
    try {
        if (!value)
            return false;
        const url = new URL(value);
        return url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
export function isRelativeUrl(value, base) {
    try {
        if (!value || !value.startsWith('/'))
            return false;
        const url = new URL(value, base || 'https://hyperlane.xyz');
        return !!url.pathname;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=url.js.map