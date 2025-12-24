import { expect, test } from "vitest";
import { wdModule } from "../src";

// TODO: Add tests for all methods

test("it should return some strings", async () => {
  expect(await wdModule("https://backrooms-wiki-cn.wikidot.com").getTags("main")).toBeInstanceOf(Array<string>);
});
