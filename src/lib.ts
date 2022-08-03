import { format, FormatOptions } from './formatter';

export default function nginxfmt(text: string, opts?: FormatOptions): string {
    opts = { ...nginxfmt.defaults, ...opts }
    return format(text, opts);
}

nginxfmt.defaults = {
    indent: "    ",
    textWidth: 80,
    wordgapsm: " ",
    wordgap: "  "
}
