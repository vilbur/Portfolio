(() => {
  "use strict";

  const safeContentLink = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value.trim(), window.location.href);
      return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };

  const appendMarkdownInline = (target, source) => {
    const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/g;
    let cursor = 0;
    let match;

    while ((match = pattern.exec(source))) {
      if (match.index > cursor) target.append(document.createTextNode(source.slice(cursor, match.index)));

      if (match[2] !== undefined) {
        const href = safeContentLink(match[3]);
        if (href) {
          const link = document.createElement("a");
          link.href = href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          appendMarkdownInline(link, match[2]);
          target.append(link);
        } else {
          target.append(document.createTextNode(match[2]));
        }
      } else if (match[4] !== undefined || match[5] !== undefined) {
        const strong = document.createElement("strong");
        appendMarkdownInline(strong, match[4] ?? match[5]);
        target.append(strong);
      } else {
        const emphasis = document.createElement("em");
        appendMarkdownInline(emphasis, match[6] ?? match[7]);
        target.append(emphasis);
      }
      cursor = pattern.lastIndex;
    }

    if (cursor < source.length) target.append(document.createTextNode(source.slice(cursor)));
  };

  const renderMarkdown = (markdown) => {
    if (!markdown?.trim()) return null;
    const container = document.createElement("div");
    container.className = "folder-description";
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    let index = 0;
    const isBlockStart = (line) =>
      /^\s*$/.test(line) || /^(#{1,6})\s+/.test(line) || /^\s*[-+*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const headingLevel = Math.min(6, Math.max(4, headingMatch[1].length + 3));
        const heading = document.createElement(`h${headingLevel}`);
        appendMarkdownInline(heading, headingMatch[2].trim());
        container.append(heading);
        index += 1;
        continue;
      }

      const unorderedMatch = line.match(/^\s*[-+*]\s+(.+)$/);
      const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unorderedMatch || orderedMatch) {
        const list = document.createElement(unorderedMatch ? "ul" : "ol");
        const itemPattern = unorderedMatch ? /^\s*[-+*]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/;
        while (index < lines.length) {
          const itemMatch = lines[index].match(itemPattern);
          if (!itemMatch) break;
          const item = document.createElement("li");
          appendMarkdownInline(item, itemMatch[1].trim());
          list.append(item);
          index += 1;
        }
        container.append(list);
        continue;
      }

      const paragraphLines = [line.trim()];
      index += 1;
      while (index < lines.length && !isBlockStart(lines[index])) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      const paragraph = document.createElement("p");
      appendMarkdownInline(paragraph, paragraphLines.join(" "));
      container.append(paragraph);
    }

    return container.childElementCount ? container : null;
  };

  window.PORTFOLIO_CONTENT_MARKUP = { render: renderMarkdown, safeLink: safeContentLink };

  const data = window.PORTFOLIO_DATA;
  if (!data) return;

  const gallery = document.querySelector("[data-gallery]");
  const filters = document.querySelector("[data-filters]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxMedia = document.querySelector("[data-lightbox-media]");
  const lightboxTitle = document.querySelector("[data-lightbox-title]");
  const lightboxMeta = document.querySelector("[data-lightbox-meta]");
  const lightboxIndex = document.querySelector("[data-lightbox-index]");
  const lightboxCategory = document.querySelector("[data-lightbox-category]");
  const menuToggle = document.querySelector(".menu-toggle");
  const header = document.querySelector("[data-header]");
  const backToTop = document.querySelector("[data-back-to-top]");

  let activeCategory = "all";
  let visibleProjects = [...data.projects];
  let activeProjectIndex = 0;
  let lastFocusedCard = null;

  const projectMeta = (project) => [
    project.subcategory === "overview" ? null : project.categoryLabel,
    project.year,
  ].filter(Boolean).join(" / ");
  const toDomId = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const makeFolderHeadingContent = (title, markdown, url, label) => {
    const content = document.createElement("div");
    content.className = "gallery-heading-content";
    const titleRow = document.createElement("div");
    titleRow.className = "gallery-heading-title-row";
    title.dataset.fitSingleLine = "";
    titleRow.append(title);

    const safeUrl = safeContentLink(url);
    if (safeUrl) {
      const link = document.createElement("a");
      link.className = "gallery-folder-link";
      link.href = safeUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Open ${label} website in a new tab`);
      link.textContent = "Visit ↗";
      titleRow.append(link);
    }
    content.append(titleRow);

    const description = renderMarkdown(markdown);
    if (description) content.append(description);
    return content;
  };

  const fitMobileHeadings = () => {
    const isMobile = window.matchMedia("(max-width: 680px)").matches;
    document.querySelectorAll("[data-fit-single-line]").forEach((title) => {
      title.style.fontSize = "";
      if (!isMobile) return;

      const row = title.closest(".gallery-heading-title-row");
      const link = row?.querySelector(".gallery-folder-link");
      const rowWidth = row?.getBoundingClientRect().width ?? 0;
      const linkWidth = link ? link.getBoundingClientRect().width + 14 : 0;
      const availableWidth = Math.max(1, rowWidth - linkWidth);
      const minimumSize = title.tagName === "H3" ? 15 : 14;
      let fontSize = Number.parseFloat(window.getComputedStyle(title).fontSize);

      while (title.scrollWidth > availableWidth && fontSize > minimumSize) {
        fontSize = Math.max(minimumSize, fontSize - 0.5);
        title.style.fontSize = `${fontSize}px`;
      }
    });
  };

  document.querySelectorAll("[data-site-name]").forEach((element) => {
    element.textContent = data.site.name;
  });

  const emailLink = document.querySelector("[data-contact-email]");
  emailLink.textContent = data.site.email;
  emailLink.href = `mailto:${data.site.email}`;
  document.querySelector("[data-year]").textContent = new Date().getFullYear();

  const makePlaceholder = (project, index, modifier = "") => {
    const placeholder = document.createElement("div");
    placeholder.className = `render-placeholder render-placeholder--${project.tone} ${modifier}`.trim();
    placeholder.setAttribute("aria-hidden", "true");

    const number = document.createElement("span");
    number.className = "placeholder-index";
    number.textContent = String(index + 1).padStart(2, "0");

    const message = document.createElement("span");
    message.className = "placeholder-message";
    message.textContent = "Render slot";

    placeholder.append(number, message);
    return placeholder;
  };

  const makeProjectMedia = (project, index, modifier = "") => {
    const wrapper = document.createElement("div");
    wrapper.className = `project-media ${modifier}`.trim();

    if (project.image && project.mediaType === "video") {
      const video = document.createElement("video");
      video.src = project.image;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = modifier.includes("lightbox") ? "auto" : "metadata";
      video.autoplay = true;
      video.controls = modifier.includes("lightbox");
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("loop", "");
      video.setAttribute("aria-label", project.alt);
      const requestPlayback = () => {
        const playRequest = video.play();
        if (playRequest) playRequest.catch(() => {});
      };
      video.addEventListener("loadeddata", requestPlayback, { once: true });
      video.addEventListener("canplay", requestPlayback, { once: true });
      video.addEventListener("error", () => {
        wrapper.replaceChildren(makePlaceholder(project, index));
      });
      wrapper.append(video);
      window.requestAnimationFrame(requestPlayback);
    } else if (project.image) {
      const image = document.createElement("img");
      image.src = project.image;
      image.alt = project.alt;
      image.loading = modifier.includes("lightbox") ? "eager" : "lazy";
      image.decoding = "async";
      image.draggable = !modifier.includes("lightbox");
      image.addEventListener("error", () => {
        wrapper.replaceChildren(makePlaceholder(project, index));
      });
      wrapper.append(image);
    } else {
      wrapper.append(makePlaceholder(project, index));
    }

    return wrapper;
  };

  const renderFilters = () => {
    filters.replaceChildren();
    data.categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button";
      button.textContent = category.label;
      button.dataset.category = category.id;
      button.setAttribute("aria-pressed", String(category.id === activeCategory));
      filters.append(button);
    });
  };

  const renderGallery = () => {
    const visibleCategories = data.categories.filter(
      (category) => category.id !== "all" && (activeCategory === "all" || category.id === activeCategory),
    );
    visibleProjects = visibleCategories.flatMap((category) =>
      data.projects.filter((project) => project.category === category.id),
    );
    gallery.replaceChildren();

    visibleCategories.forEach((category) => {
      const categoryProjects = visibleProjects.filter((project) => project.category === category.id);
      if (!categoryProjects.length) return;

      const group = document.createElement("section");
      const categoryDomId = `gallery-group-${toDomId(category.id)}`;
      group.className = "gallery-group";
      group.setAttribute("aria-labelledby", categoryDomId);

      const heading = document.createElement("header");
      heading.className = "gallery-group-heading";
      const categoryNumber = data.categories.indexOf(category);
      const worksLabel = categoryProjects.length === 1 ? "work" : "works";
      const categoryIndex = document.createElement("span");
      categoryIndex.textContent = String(categoryNumber).padStart(2, "0");
      const categoryTitle = document.createElement("h3");
      categoryTitle.id = categoryDomId;
      categoryTitle.textContent = category.label;
      const categoryCount = document.createElement("span");
      categoryCount.textContent = `${String(categoryProjects.length).padStart(2, "0")} ${worksLabel}`;
      const categoryContent = makeFolderHeadingContent(
        categoryTitle,
        category.markdown,
        category.url,
        category.label,
      );
      heading.append(categoryIndex, categoryContent, categoryCount);

      group.append(heading);

      const subcategories = [...new Map(
        categoryProjects.map((project) => [project.subcategory, {
          label: project.subcategoryLabel,
          markdown: project.subcategoryMarkdown,
          url: project.subcategoryUrl,
        }]),
      )];

      subcategories.forEach(([subcategory, subcategoryDetails], subcategoryIndex) => {
        const subcategoryProjects = categoryProjects.filter(
          (project) => project.subcategory === subcategory,
        );
        const subgroup = document.createElement("section");
        const subgroupId = `gallery-subgroup-${toDomId(category.id)}-${toDomId(subcategory)}`;
        subgroup.className = "gallery-subgroup";
        subgroup.setAttribute("aria-labelledby", subgroupId);

        const subheading = document.createElement("header");
        subheading.className = "gallery-subgroup-heading";
        const subgroupIndex = document.createElement("span");
        subgroupIndex.textContent = `${String(categoryNumber).padStart(2, "0")}.${String(subcategoryIndex + 1).padStart(2, "0")}`;
        const subgroupTitle = document.createElement("h4");
        subgroupTitle.id = subgroupId;
        subgroupTitle.textContent = subcategoryDetails.label;
        const subgroupCount = document.createElement("span");
        subgroupCount.textContent = String(subcategoryProjects.length).padStart(2, "0");
        const subgroupContent = makeFolderHeadingContent(
          subgroupTitle,
          subcategoryDetails.markdown,
          subcategoryDetails.url,
          subcategoryDetails.label,
        );
        subheading.append(subgroupIndex, subgroupContent, subgroupCount);

        const grid = document.createElement("div");
        const preferredColumns = [1, 2, 3, 5, 6].includes(subcategoryProjects.length) ? 3 : 4;
        grid.className = `project-grid project-grid--cols-${preferredColumns}`;

        subcategoryProjects.forEach((project) => {
          const sourceIndex = data.projects.indexOf(project);
          const visibleIndex = visibleProjects.indexOf(project);
          const card = document.createElement("article");
          card.className = `project-card project-card--${project.format}`;

          const button = document.createElement("button");
          button.type = "button";
          button.className = "project-open";
          button.setAttribute("aria-label", `Open ${project.title}`);
          button.append(makeProjectMedia(project, sourceIndex));

          const overlay = document.createElement("span");
          overlay.className = "project-overlay";
          overlay.setAttribute("aria-hidden", "true");
          overlay.textContent = "View fullscreen ↗";
          button.append(overlay);
          button.addEventListener("click", () => openLightbox(visibleIndex, button));

          const caption = document.createElement("div");
          caption.className = "project-caption";
          const captionTitleRow = document.createElement("div");
          const captionIndex = document.createElement("span");
          captionIndex.textContent = String(sourceIndex + 1).padStart(2, "0");
          const captionTitle = document.createElement("h3");
          captionTitle.textContent = project.title;
          captionTitleRow.append(captionIndex, captionTitle);
          caption.append(captionTitleRow);
          const meta = projectMeta(project);
          if (meta) {
            const captionMeta = document.createElement("p");
            captionMeta.textContent = meta;
            caption.append(captionMeta);
          }

          card.append(button, caption);
          grid.append(card);
        });

        subgroup.append(subheading, grid);
        group.append(subgroup);
      });

      gallery.append(group);
    });
    fitMobileHeadings();
  };

  const preloadCache = new Map();
  const doubleTapScale = 3.5;
  const zoomState = { scale: 1, x: 0, y: 0 };
  const gestureState = {
    pointerId: null,
    mode: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    originX: 0,
    originY: 0,
  };
  let lastTap = { time: 0, x: 0, y: 0 };

  const activeLightboxImage = () => lightboxMedia.querySelector(".project-media--lightbox img");
  const activeLightboxWrapper = () => lightboxMedia.querySelector(".project-media--lightbox");
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const clampPan = (x, y, scale = zoomState.scale) => {
    const image = activeLightboxImage();
    const viewport = lightboxMedia.getBoundingClientRect();
    if (!image || !viewport.width || !viewport.height || scale <= 1) return { x: 0, y: 0 };

    const naturalRatio = image.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : viewport.width / viewport.height;
    const viewportRatio = viewport.width / viewport.height;
    const displayedWidth = naturalRatio > viewportRatio ? viewport.width : viewport.height * naturalRatio;
    const displayedHeight = naturalRatio > viewportRatio ? viewport.width / naturalRatio : viewport.height;
    const maximumX = Math.max(0, (displayedWidth * scale - viewport.width) / 2);
    const maximumY = Math.max(0, (displayedHeight * scale - viewport.height) / 2);
    return {
      x: clamp(x, -maximumX, maximumX),
      y: clamp(y, -maximumY, maximumY),
    };
  };

  const applyZoom = () => {
    const image = activeLightboxImage();
    if (!image) return;
    const position = clampPan(zoomState.x, zoomState.y);
    zoomState.x = position.x;
    zoomState.y = position.y;
    image.style.transform = `translate3d(${zoomState.x}px, ${zoomState.y}px, 0) scale(${zoomState.scale})`;
    const isZoomed = zoomState.scale > 1;
    lightboxMedia.classList.toggle("is-zoomed", isZoomed);
    lightboxMedia.dataset.zoomScale = String(zoomState.scale);
  };

  const resetZoom = () => {
    zoomState.scale = 1;
    zoomState.x = 0;
    zoomState.y = 0;
    const image = activeLightboxImage();
    if (image) image.style.transform = "";
    lightboxMedia.classList.remove("is-zoomed", "is-gesture-active");
    lightboxMedia.dataset.zoomScale = "1";
    lastTap = { time: 0, x: 0, y: 0 };
  };

  const toggleZoomAt = (clientX, clientY) => {
    if (!activeLightboxImage()) return;
    if (zoomState.scale > 1) {
      resetZoom();
      return;
    }

    const viewport = lightboxMedia.getBoundingClientRect();
    zoomState.scale = doubleTapScale;
    zoomState.x = -(clientX - (viewport.left + viewport.width / 2)) * (zoomState.scale - 1);
    zoomState.y = -(clientY - (viewport.top + viewport.height / 2)) * (zoomState.scale - 1);
    applyZoom();
  };

  const resetSwipeOffset = () => {
    const wrapper = activeLightboxWrapper();
    if (!wrapper) return;
    wrapper.style.transform = "";
    wrapper.style.opacity = "";
  };

  const preloadProject = (project) => {
    if (!project?.image || preloadCache.has(project.image)) return;
    if (project.mediaType === "video") {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = project.image;
      preloadCache.set(project.image, video);
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.src = project.image;
    preloadCache.set(project.image, image);
  };

  const preloadLightboxNeighbors = () => {
    if (visibleProjects.length < 2) {
      lightbox.dataset.preloadedNeighbors = "";
      return;
    }
    const previous = visibleProjects[
      (activeProjectIndex - 1 + visibleProjects.length) % visibleProjects.length
    ];
    const next = visibleProjects[(activeProjectIndex + 1) % visibleProjects.length];
    preloadProject(previous);
    preloadProject(next);
    lightbox.dataset.preloadedNeighbors = [previous, next]
      .filter(Boolean)
      .map((project) => project.sourcePath)
      .join("|");
  };

  const updateLightbox = () => {
    resetZoom();
    resetSwipeOffset();
    const project = visibleProjects[activeProjectIndex];
    const sourceIndex = data.projects.indexOf(project);
    lightboxMedia.replaceChildren(makeProjectMedia(project, sourceIndex, "project-media--lightbox"));
    lightboxTitle.textContent = project.title;
    lightboxMeta.textContent = projectMeta(project);
    lightboxCategory.textContent =
      data.categories.find((category) => category.id === project.category)?.label ?? project.category;
    lightboxIndex.textContent = `${String(sourceIndex + 1).padStart(2, "0")} / ${String(data.projects.length).padStart(2, "0")}`;
    lightbox.dataset.activeIndex = String(activeProjectIndex);
    preloadLightboxNeighbors();
    const activeVideo = lightboxMedia.querySelector("video");
    if (activeVideo) {
      window.requestAnimationFrame(() => {
        const playRequest = activeVideo.play();
        if (playRequest) playRequest.catch(() => {});
      });
    }
  };

  const openLightbox = (index, trigger) => {
    activeProjectIndex = index;
    lastFocusedCard = trigger;
    updateLightbox();
    lightbox.showModal();
    document.body.classList.add("is-locked");
    const activeVideo = lightboxMedia.querySelector("video");
    if (activeVideo) {
      const playRequest = activeVideo.play();
      if (playRequest) playRequest.catch(() => {});
    }
  };

  const closeLightbox = () => {
    resetZoom();
    lightbox.close();
    document.body.classList.remove("is-locked");
    lastFocusedCard?.focus();
  };

  const moveLightbox = (direction) => {
    resetZoom();
    activeProjectIndex =
      (activeProjectIndex + direction + visibleProjects.length) % visibleProjects.length;
    updateLightbox();
  };

  const finishLightboxGesture = (event, cancelled = false) => {
    if (gestureState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gestureState.startX;
    const deltaY = event.clientY - gestureState.startY;
    const distance = Math.hypot(deltaX, deltaY);
    const mode = gestureState.mode;
    const wasTap = distance < 12;
    lightboxMedia.classList.remove("is-gesture-active");
    resetSwipeOffset();

    if (!cancelled && mode === "swipe" && zoomState.scale === 1) {
      const threshold = Math.max(52, lightboxMedia.clientWidth * 0.14);
      if (Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        moveLightbox(deltaX < 0 ? 1 : -1);
      } else if (wasTap && activeLightboxImage()) {
        const now = Date.now();
        if (
          now - lastTap.time < 330 &&
          Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 36
        ) {
          toggleZoomAt(event.clientX, event.clientY);
          lastTap = { time: 0, x: 0, y: 0 };
        } else {
          lastTap = { time: now, x: event.clientX, y: event.clientY };
        }
      }
    } else if (!cancelled && mode === "pan" && wasTap && activeLightboxImage()) {
      const now = Date.now();
      if (
        now - lastTap.time < 330 &&
        Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 36
      ) {
        toggleZoomAt(event.clientX, event.clientY);
        lastTap = { time: 0, x: 0, y: 0 };
      } else {
        lastTap = { time: now, x: event.clientX, y: event.clientY };
      }
    }

    if (lightboxMedia.hasPointerCapture?.(event.pointerId)) {
      lightboxMedia.releasePointerCapture(event.pointerId);
    }
    gestureState.pointerId = null;
    gestureState.mode = null;
  };

  lightboxMedia.addEventListener("pointerdown", (event) => {
    if (!lightbox.open || gestureState.pointerId !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    gestureState.pointerId = event.pointerId;
    gestureState.mode = zoomState.scale > 1 ? "pan" : "swipe";
    gestureState.startX = event.clientX;
    gestureState.startY = event.clientY;
    gestureState.lastX = event.clientX;
    gestureState.lastY = event.clientY;
    gestureState.originX = zoomState.x;
    gestureState.originY = zoomState.y;
    lightboxMedia.classList.add("is-gesture-active");
    lightboxMedia.setPointerCapture?.(event.pointerId);
  });

  lightboxMedia.addEventListener("pointermove", (event) => {
    if (gestureState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gestureState.startX;
    const deltaY = event.clientY - gestureState.startY;
    gestureState.lastX = event.clientX;
    gestureState.lastY = event.clientY;

    if (gestureState.mode === "pan") {
      event.preventDefault();
      const position = clampPan(gestureState.originX + deltaX, gestureState.originY + deltaY);
      zoomState.x = position.x;
      zoomState.y = position.y;
      applyZoom();
      return;
    }

    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
      const wrapper = activeLightboxWrapper();
      if (wrapper) {
        wrapper.style.transform = `translate3d(${deltaX * 0.72}px, 0, 0)`;
        wrapper.style.opacity = String(Math.max(0.55, 1 - Math.abs(deltaX) / lightboxMedia.clientWidth));
      }
    }
  });

  lightboxMedia.addEventListener("pointerup", (event) => finishLightboxGesture(event));
  lightboxMedia.addEventListener("pointercancel", (event) => finishLightboxGesture(event, true));
  lightboxMedia.addEventListener("dblclick", (event) => event.preventDefault());

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    filters.querySelectorAll("button").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderGallery();
  });

  document.querySelector("[data-lightbox-close]").addEventListener("click", closeLightbox);
  document.querySelector("[data-lightbox-prev]").addEventListener("click", () => moveLightbox(-1));
  document.querySelector("[data-lightbox-next]").addEventListener("click", () => moveLightbox(1));

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") moveLightbox(-1);
    if (event.key === "ArrowRight") moveLightbox(1);
  });

  lightbox.addEventListener("close", () => {
    resetZoom();
    document.body.classList.remove("is-locked");
  });

  menuToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("nav-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".site-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  const updateBackToTop = () => {
    const isVisible = window.scrollY > Math.max(560, window.innerHeight * 0.7);
    backToTop.classList.toggle("is-visible", isVisible);
    backToTop.setAttribute("aria-hidden", String(!isVisible));
    backToTop.tabIndex = isVisible ? 0 : -1;
  };

  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  });
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  window.addEventListener("resize", updateBackToTop);
  window.addEventListener("resize", () => {
    fitMobileHeadings();
    if (zoomState.scale > 1) applyZoom();
  });
  updateBackToTop();

  const featured =
    data.projects.find((project) => project.sourcePath === data.site.featuredImage) ??
    data.projects.find((project) => project.image) ??
    data.projects[0];
  const heroMedia = document.querySelector("[data-hero-media]");
  const headerImages = window.PORTFOLIO_HEADER_CAROUSEL ?? [];
  const heroSlides = headerImages.length
    ? headerImages.map((entry) => ({
        image: `${entry.path}?v=${entry.version}`,
        title: entry.title,
        alt: `${entry.title} — featured 3D render`,
        meta: "Featured render / 3D CGI",
      }))
    : [{ ...featured, meta: projectMeta(featured) }];
  const heroTitle = document.querySelector("[data-hero-title]");
  const heroMeta = document.querySelector("[data-hero-meta]");
  const heroControls = document.querySelector("[data-hero-controls]");
  const heroPosition = document.querySelector("[data-hero-position]");
  const heroImages = [];
  let activeHeroIndex = 0;
  let heroTimer;

  heroSlides.forEach((slide, index) => {
    const image = document.createElement("img");
    image.src = slide.image;
    image.alt = slide.alt;
    image.className = "hero-image";
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => heroMedia.querySelector(".render-placeholder")?.remove());
    image.addEventListener("error", () => image.remove());
    heroMedia.insertBefore(image, heroMedia.firstChild);
    heroImages.push(image);
  });

  const showHeroSlide = (index) => {
    activeHeroIndex = (index + heroSlides.length) % heroSlides.length;
    heroImages.forEach((image, imageIndex) => {
      image.classList.toggle("is-active", imageIndex === activeHeroIndex);
      image.setAttribute("aria-hidden", String(imageIndex !== activeHeroIndex));
    });
    const slide = heroSlides[activeHeroIndex];
    heroTitle.textContent = slide.title;
    heroMeta.textContent = slide.meta;
    heroPosition.textContent = `${String(activeHeroIndex + 1).padStart(2, "0")} / ${String(heroSlides.length).padStart(2, "0")}`;
  };

  const stopHeroCarousel = () => window.clearInterval(heroTimer);
  const startHeroCarousel = () => {
    stopHeroCarousel();
    if (heroSlides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      heroTimer = window.setInterval(() => showHeroSlide(activeHeroIndex + 1), 6500);
    }
  };
  const moveHeroCarousel = (direction) => {
    showHeroSlide(activeHeroIndex + direction);
    startHeroCarousel();
  };

  heroControls.hidden = heroSlides.length < 2;
  document.querySelector("[data-hero-prev]").addEventListener("click", () => moveHeroCarousel(-1));
  document.querySelector("[data-hero-next]").addEventListener("click", () => moveHeroCarousel(1));
  heroMedia.addEventListener("mouseenter", stopHeroCarousel);
  heroMedia.addEventListener("mouseleave", startHeroCarousel);
  heroMedia.addEventListener("focusin", stopHeroCarousel);
  heroMedia.addEventListener("focusout", startHeroCarousel);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopHeroCarousel();
    else startHeroCarousel();
  });
  showHeroSlide(0);
  startHeroCarousel();

  renderFilters();
  renderGallery();
})();
