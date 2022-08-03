# Nginx Configuration Formatter

Installation:

```shell
npm install nginxfmt -g
```

```shell
Usage:
        nginxfmt <target> [-o output] : format <target> into [output]
             if [-o output] is not specified, <target> will be overridden
        nginxfmt -h                   : show help information
```

Example:

```shell
nginxfmt old.conf -o new.conf
```

The formatter also supports nginx configuration templates commonly seen in ansible:

```conf
server  { # php/fastcgi
    listen  {{ PORT }};
    server_name  domain1.com  {{ www_domain1_com }};
    access_log  logs/domain1.access.log  main;
    root  html;
    location  ~  \.php$  {
        fastcgi_pass  127.0.0.1:1025;
    }
    location  /  {
        fastcgi_pass  127.0.0.1:1025;
    }
}
```

It can be used as a library:

```shell
npm install nginxfmt --save
```

Then

```js
const { nginxfmt: format } = require("nginxfmt");
// pass the configuration file as string to the function `format`
const output = format(input);
```
