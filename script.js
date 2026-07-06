const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const filters = document.querySelectorAll(".filter");
const materialCards = document.querySelectorAll(".material-card");
const resourceRows = document.querySelectorAll(".resource-row:not(.resource-head)");
const addMaterialButton = document.querySelector("#addMaterial");
const materialList = document.querySelector("#materialList");
const materialSubject = document.querySelector("#materialSubject");
const materialType = document.querySelector("#materialType");
const materialTitle = document.querySelector("#materialTitle");
const materialLink = document.querySelector("#materialLink");

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

siteNav?.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    siteNav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }
});

filters.forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    const selected = filterButton.dataset.filter;

    filters.forEach((button) => button.classList.remove("is-active"));
    filterButton.classList.add("is-active");

    materialCards.forEach((card) => {
      const shouldShow = selected === "all" || card.dataset.subject === selected;
      card.hidden = !shouldShow;
    });

    resourceRows.forEach((row) => {
      const subject = row.querySelector("span")?.textContent.toLowerCase() || "";
      const shouldShow =
        selected === "all" ||
        (selected === "systems" && (subject.includes("operating") || subject.includes("distributed"))) ||
        (selected === "programming" && subject.includes("data")) ||
        (selected === "design" && subject.includes("compiler"));
      row.hidden = !shouldShow;
    });
  });
});

addMaterialButton?.addEventListener("click", () => {
  const subject = materialSubject.value;
  const type = materialType.value;
  const title = materialTitle.value.trim() || "Untitled material";
  const link = materialLink.value.trim();
  const item = document.createElement("li");

  if (link) {
    item.innerHTML = `<strong>${subject}:</strong> ${title} (${type}) - <a href="${link}" target="_blank" rel="noopener">Open material</a>`;
  } else {
    item.innerHTML = `<strong>${subject}:</strong> ${title} (${type})`;
  }

  materialList.append(item);
  materialTitle.value = "";
  materialLink.value = "";
});
