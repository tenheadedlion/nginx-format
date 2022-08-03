import { format, FormatOptions } from './formatter';

export function nginxfmt(text: string, opts?: FormatOptions): string {
    opts = { ...nginxfmt.defaults, ...opts }
    if (isNaN(Number(opts.textWidth))) {
        opts.textWidth = 80;
    }
    return format(text, opts);
}

nginxfmt.defaults = {
    indent: "    ",
    textWidth: 80,
}
