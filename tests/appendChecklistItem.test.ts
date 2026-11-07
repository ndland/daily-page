import { describe, expect, it } from "vitest";
import { appendChecklistItem } from "../src/entries/edit";
import { readChecklist } from "../src/render/checklist";

describe("appendChecklistItem", () => {
  it("adds an open todo after the last item in the Checklist section", () => {
    const scope = ["## Timeline", "- 09:00- Email", "", "## Checklist", "- [ ] Walk", "- [x] Water"];
    const result = appendChecklistItem(scope, "Read ten pages");
    expect(result).toEqual({
      ok: true,
      lines: [
        "## Timeline",
        "- 09:00- Email",
        "",
        "## Checklist",
        "- [ ] Walk",
        "- [x] Water",
        "- [ ] Read ten pages",
      ],
    });
  });

  it("adds the first todo straight after an empty Checklist heading", () => {
    const scope = ["## Timeline", "", "## Checklist", ""];
    const result = appendChecklistItem(scope, "Walk");
    expect(result.ok && result.lines).toEqual(["## Timeline", "", "## Checklist", "- [ ] Walk", ""]);
  });

  it("creates the Checklist section when the block has none", () => {
    const scope = ["## Timeline", "- 09:00- Email"];
    const result = appendChecklistItem(scope, "Walk");
    expect(result.ok && result.lines).toEqual(["## Timeline", "- 09:00- Email", "## Checklist", "- [ ] Walk"]);
  });

  it("collapses whitespace and refuses empty text", () => {
    const scope = ["## Checklist"];
    expect(appendChecklistItem(scope, "  Buy\n milk  ")).toEqual({
      ok: true,
      lines: ["## Checklist", "- [ ] Buy milk"],
    });
    expect(appendChecklistItem(scope, "   ").ok).toBe(false);
  });

  it("the new todo is read back as an open item", () => {
    const result = appendChecklistItem(["## Checklist"], "Walk");
    const items = result.ok ? readChecklist(result.lines) : [];
    expect(items).toEqual([{ text: "Walk", checked: false, raw: "- [ ] Walk", index: 0 }]);
  });
});
