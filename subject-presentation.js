(() => {
  const reader = document.querySelector("[data-lesson-reader]");
  if (!reader) return;

  const slides = [...reader.querySelectorAll(".lesson-slide")];
  const outline = document.querySelector(".lesson-outline");
  const links = [...outline.querySelectorAll("a")];
  const toolbar = reader.querySelector(".lesson-toolbar");
  const previous = toolbar.querySelector("[data-previous]");
  const next = toolbar.querySelector("[data-next]");
  const fullscreen = toolbar.querySelector("[data-fullscreen]");
  const count = toolbar.querySelector("[data-slide-count]");
  const announcement = toolbar.querySelector("[data-slide-announcement]");
  const progress = toolbar.querySelector("progress");
  let current = -1;

  function slideFromHash(hash) {
    return slides.findIndex(slide => "#" + slide.id === hash);
  }

  function showSlide(index) {
    if (index < 0 || index >= slides.length || index === current) return;

    current = index;
    slides.forEach((slide, position) => { slide.hidden = position !== index; });
    links.forEach(link => {
      if (link.hash === "#" + slides[index].id) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    previous.setAttribute("aria-disabled", String(index === 0));
    next.setAttribute("aria-disabled", String(index === slides.length - 1));
    progress.value = index + 1;
    count.textContent = (index + 1) + " / " + slides.length;
    announcement.textContent = "Slide " + (index + 1) + " of " + slides.length
      + ": " + slides[index].querySelector("h2").textContent;
    if (document.fullscreenElement === reader) reader.scrollTop = 0;
  }

  function goToSlide(index) {
    if (index < 0 || index >= slides.length || index === current) return;
    history.pushState(null, "", "#" + slides[index].id);
    showSlide(index);
  }

  progress.max = slides.length;
  showSlide(Math.max(0, slideFromHash(location.hash)));
  reader.classList.add("is-enhanced");
  toolbar.hidden = false;

  previous.addEventListener("click", () => goToSlide(current - 1));
  next.addEventListener("click", () => goToSlide(current + 1));
  outline.addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const index = slideFromHash(link.hash);
    if (index < 0) return;
    event.preventDefault();
    goToSlide(index);
    slides[index].querySelector("h2").focus({ preventScroll: true });
    reader.scrollIntoView({ block: "start", behavior: "instant" });
  });
  window.addEventListener("hashchange", () => {
    showSlide(Math.max(0, slideFromHash(location.hash)));
  });
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || event.target.closest("input, textarea, select, [contenteditable]")) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(current + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });

  if (document.fullscreenEnabled && reader.requestFullscreen) {
    fullscreen.hidden = false;
    fullscreen.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement === reader) await document.exitFullscreen();
        else await reader.requestFullscreen();
      } catch {
        fullscreen.hidden = true;
        next.focus();
      }
    });
    document.addEventListener("fullscreenchange", () => {
      const label = document.fullscreenElement === reader ? "Exit fullscreen" : "Enter fullscreen";
      fullscreen.setAttribute("aria-label", label);
      fullscreen.title = label;
    });
  }
})();
