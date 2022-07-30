/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const assert = require("assert");
const { parseNginxConfig, interpret, parser } = require("../lib/parser");
const { NGINX_FULL_EXAMPLE_FILES } = require("./nginx_full_example");

describe("Nginx configuration formatter", () => {
  describe("Parse https://www.nginx.com/resources/wiki/start/topics/examples/full/", () => {
    it("parses", () => {
      const parse = (input) => {
        const parseResult = parseNginxConfig(input);
        assert.equal(parseResult.lexErrors.length, 0);
        console.log(parseResult.parseErrors);
        assert.equal(parseResult.parseErrors.length, 0);
      };
      NGINX_FULL_EXAMPLE_FILES.forEach(parse);
    });
    it("interprets", () => {
      const conf = NGINX_FULL_EXAMPLE_FILES[0];
      const node = interpret(conf).value;
      assert.equal(node.directives.length, 7);
      assert.equal(node.directives[6].subNode.directives.length, 14);
      console.log(node.directives[1].semi);
      assert.equal(node.directives[1].semi.commentAfter, '## Default: 1');
    });
  });
});
