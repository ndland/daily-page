/**
 * Makes an element that the reader can click also usable from the keyboard: it can be reached with
 * Tab, it is announced with its role, and Enter or Space activates it, as a click would.
 */
export function makeClickable(el: HTMLElement, onActivate: () => void, role = "button"): void {
  el.classList.add("is-clickable");
  el.setAttribute("role", role);
  el.tabIndex = 0;
  el.addEventListener("click", onActivate);
  el.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivate();
  });
}
