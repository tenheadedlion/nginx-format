const assert = require("assert");
const greet = require("../lib").default;

describe("Hello World Test", () => {
  describe("test hello", () => {
    it("greets the world", () => {});
      assert.notEqual(greet(), "Hello World");
  });
});
