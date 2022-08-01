#!/usr/bin/env node

import { argv } from 'node:process';
import fs from 'fs';
import readline from 'readline';
import format from './lib';

function help() {
    console.log("Usage:");
    console.log("\tnginx-format <target> [-o output] : format <target> into [output]");
    console.log("\t     if [-o output] is not specified, <target> will be overridden");
    console.log("\tnginx-format -h                   : show help information");
}

function main(argv: string[]) {
    const len = argv.length;
    if (len < 3) {
        help();
        return;
    }
    let i = 2;
    let output = '';
    let input = '';
    let text = '';
    for (i = 2; i < len; ++i) {
        if (argv[i] === '-h') {
            help();
            return;
        }
        else if (argv[i] === '-o') {
            i += 1;
            output = argv[i];
        } else {
            input = argv[i];
        }
    }
    try {
        text = fs.readFileSync(input, 'utf8');
    } catch {
        console.log("Error: no such file or directory: " + input);
        return;
    }
    if (output === '') {
        output = input;
    }
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.log("input:  " + input);
    console.log("output: " + output);
    rl.question("nginxfmt: write result to " + output + "?[Y/N]",
        function (confirmation) {
            if (confirmation === 'y' || confirmation === 'N') {
                try {
                    text = format(text);
                } catch {
                    console.log("Error: cannot format " + input);
                    rl.close();
                }
                try {
                    fs.writeFileSync(output, text);
                } catch (err) {
                    console.log("Error: cannot write to " + input);
                    rl.close();
                }
                rl.close();
            } else {
                console.log("nginxfmt exits.")
                rl.close();
            }
        }
    );
}

main(argv)
