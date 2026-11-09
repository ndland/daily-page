// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { richTextRenderer } from "../src/render/richText";

/** A host renderer that finishes when the test says so, with the HTML it is given. */
function fakeHost(html: string) {
  let finish: () => void = () => {};
  const render = vi.fn((_markdown: string, into: HTMLElement) => {
    into.innerHTML = html;
    return new Promise<void>((resolve) => (finish = resolve));
  });
  return { render, finish: () => finish() };
}

// Animation frames are run by the test, so the order of events never depends on timers.
let frames: Array<() => void> = [];
/** Lets the host's promise finish, then runs the frames that were asked for. */
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  frames.splice(0).forEach((frame) => frame());
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => frames.push(fn));
});
afterEach(() => vi.unstubAllGlobals());

function drawInto(text: string, host: ReturnType<typeof fakeHost>, onRendered = vi.fn()) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const parent = document.createElement("span");
  parent.append("11:56  ");
  root.appendChild(parent);
  richTextRenderer(host.render, onRendered)(parent, text);
  return { root, parent, onRendered };
}

describe("richTextRenderer", () => {
  it("draws the built-in markdown at once, so the text is there before the host finishes", () => {
    const { parent } = drawInto("so _very_ fast", fakeHost("<p>unused</p>"));
    expect(parent.textContent).toBe("11:56  so very fast");
    expect(parent.querySelector("em")).not.toBeNull();
  });

  it("swaps in the host's drawing when it finishes, keeping what came before the text", async () => {
    const host = fakeHost('<p>so <em class="host">very</em> fast</p>');
    const { parent, onRendered } = drawInto("so _very_ fast", host);
    host.finish();
    await settle();
    expect(parent.textContent).toBe("11:56  so very fast");
    expect(parent.querySelector("em.host")).not.toBeNull();
    expect(onRendered).toHaveBeenCalledTimes(1);
  });

  it("does not ask the host about text with no markdown in it", () => {
    const host = fakeHost("<p>x</p>");
    const { parent } = drawInto("plain words", host);
    expect(host.render).not.toHaveBeenCalled();
    expect(parent.textContent).toBe("11:56  plain words");
  });

  it("keeps the built-in drawing when the host's result is not a single paragraph", async () => {
    const host = fakeHost("<ul><li>x</li></ul>");
    const { parent, onRendered } = drawInto("*x", host);
    host.finish();
    await settle();
    expect(parent.textContent).toBe("11:56  *x");
    expect(onRendered).not.toHaveBeenCalled();
  });

  it("keeps the built-in drawing when the host fails", async () => {
    const render = vi.fn(() => Promise.reject(new Error("no")));
    const parent = document.createElement("span");
    document.body.appendChild(parent);
    richTextRenderer(render, vi.fn())(parent, "_x_");
    await settle();
    expect(parent.querySelector("em")?.textContent).toBe("x");
  });

  it("leaves a page that has since been replaced alone", async () => {
    const host = fakeHost("<p>late</p>");
    const { root, onRendered } = drawInto("_x_", host);
    root.remove();
    host.finish();
    await settle();
    expect(onRendered).not.toHaveBeenCalled();
  });

  it("asks for one refit when many texts finish together", async () => {
    const onRendered = vi.fn();
    const hosts = [fakeHost("<p>a</p>"), fakeHost("<p>b</p>"), fakeHost("<p>c</p>")];
    for (const host of hosts) drawInto("_x_", host, onRendered);
    expect(onRendered).not.toHaveBeenCalled();
    hosts.forEach((host) => host.finish());
    await settle();
    // Each drawInto made its own renderer, so each refits once; one renderer shared by a page refits once.
    expect(onRendered).toHaveBeenCalledTimes(3);
  });

  it("shares one refit between the texts of one page", async () => {
    const onRendered = vi.fn();
    const hostA = fakeHost("<p>a</p>");
    const hostB = fakeHost("<p>b</p>");
    const draw = richTextRenderer((markdown, into) => (markdown === "_a_" ? hostA : hostB).render(markdown, into), onRendered);
    const root = document.createElement("div");
    document.body.appendChild(root);
    for (const text of ["_a_", "_b_"]) {
      const parent = document.createElement("span");
      root.appendChild(parent);
      draw(parent, text);
    }
    hostA.finish();
    hostB.finish();
    await settle();
    expect(onRendered).toHaveBeenCalledTimes(1);
  });

  it("keeps a click on a rendered link from reaching the row", async () => {
    const host = fakeHost('<p><a href="#x">x</a></p>');
    const { root, parent } = drawInto("[[x]]", host);
    const onRow = vi.fn();
    root.addEventListener("click", onRow);
    host.finish();
    await settle();
    parent.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onRow).not.toHaveBeenCalled();
  });
});
