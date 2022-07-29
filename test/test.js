/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const assert = require("assert");
const { parseNginxConfig } = require("../lib/parser");
const { NGINX_FULL_EXAMPLE_FILES } = require("./nginx_full_example");

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
  });
});
