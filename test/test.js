const assert = require('assert');
const parser = require('../lib/parser');

describe('Hello World Test', () => {
  it('parses', () => {
    assert.deepEqual(parser.parse('hello **world** then, goodbye world'), [
      ['**world**'],
      ['hello', '**world**', 'then', ',', 'goodbye', 'world'],
    ]);
  });
})