export function scrollToCard(permitName: string) {
  const el = document.getElementById(`permit-card-${permitName}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      el.classList.add("highlight-flash");
      el.addEventListener("animationend", () => el.classList.remove("highlight-flash"), { once: true });
    }, 400);
  }
}
