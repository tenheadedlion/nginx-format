/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const assert = require("assert");
const { parseNginxConfig, interpret, parser } = require("../dist/parser");
const { NGINX_FULL_EXAMPLE_FILES } = require("./nginx_full_example");
const { concatFormUnits, FormatUnit } = require("../dist/formatter");
const { nginxfmt: format } = require("../dist/lib");

describe("Nginx configuration formatter", () => {
  describe("Parse https://www.nginx.com/resources/wiki/start/topics/examples/full/", () => {
    it("parses", () => {
      const parse = (input) => {
        const parseResult = parseNginxConfig(input);
        assert.equal(parseResult.lexErrors.length, 0);
        assert.equal(parseResult.parseErrors.length, 0);
      };
      NGINX_FULL_EXAMPLE_FILES.forEach(parse);
    });
    it("interprets", () => {
      const conf = NGINX_FULL_EXAMPLE_FILES[0];
      const node = interpret(conf).value;
      assert.equal(node.directives.length, 7);
      assert.equal(node.directives[6].subNode.directives.length, 14);
      assert.equal(node.directives[1].semi.commentAfter, "## Default: 1");
    });

    it("formats a simple config", () => {
      assert.equal(
        format(
          `

        
# Syntax: worker_aio_requests number;
       # Default:
# worker_aio_requests 32;
# Context:  events
    




# This directive appeared in versions 1.1.4 and 1.0.7.
user       www 
www # a malicious inline comment









# a malicious standalone comment
; ## Default: nobody
`
        ),
        `# Syntax: worker_aio_requests number;
# Default:
# worker_aio_requests 32;
# Context:  events
# This directive appeared in versions 1.1.4 and 1.0.7.
user  www  www # a malicious inline comment
# a malicious standalone comment
; ## Default: nobody
`
      );
    });
    it("correctly concatenates two formatUnit", () => {
      let left = new FormatUnit();
      left.pushLine("a");
      left.canBeAppendedTo = true;
      const right = new FormatUnit();
      right.pushLine("b");
      right.shouldStartInNewLine = false;
      const opts = { wordgap: "\t" };
      left = concatFormUnits(left, right, opts);
      assert.equal(left.value[0], "a\tb");
    });

    it("formats complicated config", () => {
      assert.equal(
        format(
          String.raw`
http {
server_names_hash_bucket_size 128; # this seems to be required for some vhosts
server { # php/fastcgi
    listen       {{ PORT }};
    server_name  domain1.com {{ www_domain1_com }};
    access_log   logs/domain1.access.log  main;
    root         html;

    location ~ \.php$ {
      fastcgi_pass   127.0.0.1:1025;
    }
    location / {
      fastcgi_pass   127.0.0.1:1025;
    }
  }
}
`
        ),
        String.raw`http  {
    server_names_hash_bucket_size  128; # this seems to be required for some vhosts
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
}
`
      );
    });
    it("correctly break lines longer than configured", () => {
      assert.equal(
        format(
          String.raw`
http {
  include    conf/mime.types;
  include    /etc/nginx/proxy.conf;
  include    /etc/nginx/fastcgi.conf;
  index    index.html index.htm index.php;

  default_type application/octet-stream;
  # long line
  # should be broken
  log_format   main '$remote_addr - $remote_user [$time_local]  $status ' '"$request" $body_bytes_sent "$http_referer" ' '"$http_user_agent" "$http_x_forwarded_for"';
  access_log   logs/access.log  main;
}
`, { textWidth: 80 }),

        String.raw`http  {
    include  conf/mime.types;
    include  /etc/nginx/proxy.conf;
    include  /etc/nginx/fastcgi.conf;
    index  index.html  index.htm  index.php;
    default_type  application/octet-stream;
    # long line
    # should be broken
    log_format  main  '$remote_addr - $remote_user [$time_local]  $status '
        '"$request" $body_bytes_sent "$http_referer" '
        '"$http_user_agent" "$http_x_forwarded_for"';
    access_log  logs/access.log  main;
}
`
      );
    });
        it("correctly break lines longer than configured in a weird way", () => {
          assert.equal(
            format(
              String.raw`
http {
  include    conf/mime.types;
  include    /etc/nginx/proxy.conf;
  include    /etc/nginx/fastcgi.conf;
  index    index.html index.htm index.php;

  default_type application/octet-stream;
  # long line
  # should be broken
  log_format   main '$remote_addr - $remote_user [$time_local]  $status ' '"$request" $body_bytes_sent "$http_referer" ' '"$http_user_agent" "$http_x_forwarded_for"';
  access_log   logs/access.log  main;
}
`,
              { textWidth: 1, indent: "--" }
            ),

            String.raw`http
--{
--include
----conf/mime.types
----;
--include
----/etc/nginx/proxy.conf
----;
--include
----/etc/nginx/fastcgi.conf
----;
--index
----index.html
----index.htm
----index.php
----;
--default_type
----application/octet-stream
----;
--# long line
--# should be broken
--log_format
----main
----'$remote_addr - $remote_user [$time_local]  $status '
----'"$request" $body_bytes_sent "$http_referer" '
----'"$http_user_agent" "$http_x_forwarded_for"'
----;
--access_log
----logs/access.log
----main
----;
}
`
          );
        });
  });
});
