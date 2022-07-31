/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const assert = require("assert");
const { parseNginxConfig, interpret, parser } = require("../lib/parser");
const { NGINX_FULL_EXAMPLE_FILES } = require("./nginx_full_example");
const { format } = require("../lib/formatter");

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
      const conf = NGINX_FULL_EXAMPLE_FILES[0];
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
user www www # a malicious inline comment
# a malicious standalone comment
; ## Default: nobody
`
      );
    });
  });
});
