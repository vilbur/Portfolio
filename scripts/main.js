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

  const localizedMarkdown = (markdown) => {
    if (typeof markdown === "string") return markdown;
    return markdown?.[activeLanguage]?.trim()
      || markdown?.en?.trim()
      || markdown?.cs?.trim()
      || null;
  };

  window.PORTFOLIO_CONTENT_MARKUP = { render: renderMarkdown, safeLink: safeContentLink };

  const data = window.PORTFOLIO_DATA;
  if (!data) return;

  const gallery = document.querySelector("[data-gallery]");
  const filters = document.querySelector("[data-filters]");
  const mobileFilters = document.querySelector("[data-mobile-filters]");
  const filterContainers = [filters, mobileFilters].filter(Boolean);
  const workToggle = document.querySelector("[data-work-toggle]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxMedia = document.querySelector("[data-lightbox-media]");
  const lightboxTitle = document.querySelector("[data-lightbox-title]");
  const lightboxMeta = document.querySelector("[data-lightbox-meta]");
  const lightboxCaption = document.querySelector(".lightbox-caption");
  const lightboxCategory = document.querySelector("[data-lightbox-category]");
  const backToTop = document.querySelector("[data-back-to-top]");
  const languageButtons = document.querySelectorAll("[data-language]");
  const specializationWord = document.querySelector("[data-specialization-word]");
  const specializationAccessible = document.querySelector("[data-specialization-accessible]");
  const resumeDownload = document.querySelector("[data-resume-download]");
  const languageStorageKey = "vilbur-portfolio-language";
  const resumeFiles = {
    en: "assets/about/Lubor Černý - Resume EN.docx",
    cs: "assets/about/Lubor Černý - Resume CZ.docx",
  };

  let activeNavigationCategory = null;
  let visibleProjects = [...data.projects];
  let activeProjectIndex = 0;
  let lastFocusedCard = null;
  let activeLanguage = "en";
  let specializationIndex = 0;
  let specializationTimer;
  let specializationTransitionTimer;

  try {
    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    if (storedLanguage === "en" || storedLanguage === "cs") {
      activeLanguage = storedLanguage;
    } else {
      const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
      activeLanguage = browserLanguages.some((language) => /^cs(?:-|$)/i.test(language ?? "")) ? "cs" : "en";
    }
  } catch {
    const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
    activeLanguage = browserLanguages.some((language) => /^cs(?:-|$)/i.test(language ?? "")) ? "cs" : "en";
  }

  const translationValue = (path) => path.split(".").reduce(
    (value, key) => value?.[key],
    data.site.translations?.[activeLanguage],
  );
  const translate = (path, replacements = {}) => {
    const value = translationValue(path);
    if (typeof value !== "string") return path;
    return Object.entries(replacements).reduce(
      (text, [key, replacement]) => text.replaceAll(`{${key}}`, replacement),
      value,
    );
  };

  const specializationWords = () => translationValue("hero.specializations") ?? ["models", "print", "visualizations"];
  const showSpecialization = (index, animate = true) => {
    const words = specializationWords();
    specializationIndex = (index + words.length) % words.length;
    window.clearTimeout(specializationTransitionTimer);

    const updateWord = () => {
      specializationWord.textContent = words[specializationIndex];
      specializationWord.classList.remove("is-leaving");
      if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      specializationWord.classList.add("is-entering");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => specializationWord.classList.remove("is-entering"));
      });
    };

    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      updateWord();
      return;
    }

    specializationWord.classList.add("is-leaving");
    specializationTransitionTimer = window.setTimeout(updateWord, 180);
  };

  const stopSpecializationRotation = () => window.clearInterval(specializationTimer);
  const startSpecializationRotation = () => {
    stopSpecializationRotation();
    specializationTimer = window.setInterval(() => showSpecialization(specializationIndex + 1), 2500);
  };

  const toDomId = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const makeFolderHeadingContent = (title, url, label) => {
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
      link.setAttribute("aria-label", translate("gallery.visitAria", { label }));
      link.textContent = translate("gallery.visit");
      titleRow.append(link);
    }
    content.append(titleRow);
    return content;
  };

  const fitMobileHeadings = () => {
    const isMobile = window.matchMedia("(max-width: 680px)").matches;
    document.querySelectorAll("[data-fit-single-line]").forEach((title) => {
      const stickyHeading = title.closest(".gallery-group-heading");
      const wasStuck = stickyHeading?.classList.contains("is-stuck");
      if (wasStuck) stickyHeading.classList.remove("is-stuck");
      title.style.fontSize = "";
      if (!isMobile) {
        title.style.removeProperty("--gallery-heading-font-size");
        return;
      }

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

      if (stickyHeading) {
        title.style.setProperty("--gallery-heading-font-size", window.getComputedStyle(title).fontSize);
        if (wasStuck) stickyHeading.classList.add("is-stuck");
      }
    });
  };

  document.querySelectorAll("[data-site-name]").forEach((element) => {
    element.textContent = data.site.name;
  });

  const emailLink = document.querySelector("[data-contact-email]");
  emailLink.querySelector("[data-contact-email-label]").textContent = data.site.email;
  emailLink.href = data.site.emailHref;
  const phoneLink = document.querySelector("[data-contact-phone]");
  phoneLink.querySelector("[data-contact-phone-label]").textContent = data.site.phoneDisplay;
  phoneLink.href = data.site.phoneHref;
  document.querySelector("[data-year]").textContent = new Date().getFullYear();

  const makePlaceholder = (project, modifier = "") => {
    const placeholder = document.createElement("div");
    placeholder.className = `render-placeholder render-placeholder--${project.tone} ${modifier}`.trim();
    placeholder.setAttribute("aria-hidden", "true");

    const message = document.createElement("span");
    message.className = "placeholder-message";
    message.textContent = translate("gallery.renderSlot");

    placeholder.append(message);
    return placeholder;
  };

  const requestVideoPlayback = (video) => {
    const playRequest = video?.play();
    if (playRequest) playRequest.catch(() => {});
  };

  const makeProjectMedia = (project, modifier = "") => {
    const wrapper = document.createElement("div");
    wrapper.className = `project-media ${modifier}`.trim();
    if (!modifier.includes("lightbox") && project.mediaType === "image") {
      wrapper.dataset.thumbnail = project.thumbnail;
    }

    if (project.image && project.mediaType === "video") {
      const video = document.createElement("video");
      const isLightboxVideo = modifier.includes("lightbox");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = isLightboxVideo ? "auto" : "metadata";
      video.autoplay = true;
      video.controls = isLightboxVideo;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("loop", "");
      video.setAttribute("aria-label", project.alt);
      if (!isLightboxVideo && lightbox.open) {
        video.dataset.suspendedSrc = project.image;
      } else {
        video.src = project.image;
      }
      const requestPlayback = () => {
        if (!video.hasAttribute("src")) return;
        if (isLightboxVideo ? !lightbox.open : lightbox.open) return;
        requestVideoPlayback(video);
      };
      video.addEventListener("loadeddata", requestPlayback, { once: true });
      video.addEventListener("canplay", requestPlayback, { once: true });
      video.addEventListener("error", () => {
        if (!video.hasAttribute("src")) return;
        wrapper.replaceChildren(makePlaceholder(project, modifier));
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
        wrapper.replaceChildren(makePlaceholder(project, modifier));
      });
      wrapper.append(image);
    } else {
      wrapper.append(makePlaceholder(project, modifier));
    }

    return wrapper;
  };

  const renderFilters = () => {
    filterContainers.forEach((container) => {
      container.replaceChildren();
      data.categories.forEach((category) => {
        const link = document.createElement("a");
        link.className = "filter-button";
        link.textContent = category.label;
        link.href = `#gallery-group-${toDomId(category.id)}`;
        link.dataset.category = category.id;
        if (category.id === activeNavigationCategory) link.setAttribute("aria-current", "location");
        container.append(link);
      });
    });
  };

  let stickyCategoryFrame;
  const setStickyHeadingTriggerState = (heading, enabled) => {
    const title = heading.querySelector(".gallery-heading-title-row > h3");
    if (!title) return;

    if (enabled) {
      title.dataset.categoryMenuTrigger = "";
      title.setAttribute("role", "button");
      title.setAttribute("tabindex", "0");
      title.setAttribute("aria-controls", "work-submenu");
      title.setAttribute("aria-expanded", workToggle?.getAttribute("aria-expanded") ?? "false");
      return;
    }

    delete title.dataset.categoryMenuTrigger;
    title.removeAttribute("role");
    title.removeAttribute("tabindex");
    title.removeAttribute("aria-controls");
    title.removeAttribute("aria-expanded");
  };

  const updateStickyCategoryHeadings = () => {
    window.cancelAnimationFrame(stickyCategoryFrame);
    stickyCategoryFrame = window.requestAnimationFrame(() => {
      const isMobile = window.matchMedia("(max-width: 680px)").matches;
      const stickyTop = Number.parseFloat(
        window.getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
      ) || 0;

      document.querySelectorAll(".gallery-group-heading").forEach((heading) => {
        if (!isMobile) {
          heading.classList.remove("is-stuck");
          setStickyHeadingTriggerState(heading, false);
          return;
        }

        const headingRect = heading.getBoundingClientRect();
        const groupRect = heading.closest(".gallery-group")?.getBoundingClientRect();
        const isStuck = Boolean(
          groupRect
          && groupRect.top < stickyTop
          && headingRect.top <= stickyTop + 1
          && groupRect.bottom > stickyTop + headingRect.height,
        );
        heading.classList.toggle("is-stuck", isStuck);
        setStickyHeadingTriggerState(heading, isStuck);
      });
    });
  };

  const renderGallery = () => {
    // Explicitly release media before replacing translated gallery markup.
    // Detached video elements can otherwise keep the mobile decoder occupied.
    suspendGalleryVideos();
    const visibleCategories = data.categories;
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
      const categoryTitle = document.createElement("h3");
      categoryTitle.id = categoryDomId;
      categoryTitle.textContent = category.label;
      const categoryContent = makeFolderHeadingContent(
        categoryTitle,
        category.url,
        category.label,
      );
      heading.append(categoryContent);

      group.append(heading);
      const categoryDescription = renderMarkdown(localizedMarkdown(category.markdown));
      if (categoryDescription) {
        heading.classList.add("has-description");
        group.append(categoryDescription);
      }

      const subcategories = [...new Map(
        categoryProjects.map((project) => [project.subcategory, {
          label: project.subcategoryLabel,
          markdown: project.subcategoryMarkdown,
          url: project.subcategoryUrl,
        }]),
      )];

      subcategories.forEach(([subcategory, subcategoryDetails]) => {
        const subcategoryProjects = categoryProjects.filter(
          (project) => project.subcategory === subcategory,
        );
        const subgroup = document.createElement("section");
        const subgroupId = `gallery-subgroup-${toDomId(category.id)}-${toDomId(subcategory)}`;
        subgroup.className = "gallery-subgroup";
        subgroup.setAttribute("aria-labelledby", subgroupId);

        const subheading = document.createElement("header");
        subheading.className = "gallery-subgroup-heading";
        const subgroupTitle = document.createElement("h4");
        subgroupTitle.id = subgroupId;
        subgroupTitle.textContent = subcategory === "overview" ? translate("work.overview") : subcategoryDetails.label;
        const subgroupContent = makeFolderHeadingContent(
          subgroupTitle,
          subcategoryDetails.url,
          subcategoryDetails.label,
        );
        subheading.append(subgroupContent);

        const grid = document.createElement("div");
        const preferredColumns = subcategoryProjects.length === 4
          ? 2
          : ([1, 2, 3, 5, 6].includes(subcategoryProjects.length) ? 3 : 4);
        grid.className = `project-grid project-grid--cols-${preferredColumns}`;

        subcategoryProjects.forEach((project) => {
          const visibleIndex = visibleProjects.indexOf(project);
          const card = document.createElement("article");
          card.className = `project-card project-card--${project.format}`;

          const button = document.createElement("button");
          button.type = "button";
          button.className = "project-open";
          button.setAttribute(
            "aria-label",
            project.title
              ? translate("gallery.openProject", { label: project.title })
              : translate(project.mediaType === "video" ? "gallery.openVideo" : "gallery.openImage"),
          );
          button.append(makeProjectMedia(project));

          const overlay = document.createElement("span");
          overlay.className = "project-overlay";
          overlay.setAttribute("aria-hidden", "true");
          overlay.textContent = translate("gallery.viewFullscreen");
          button.append(overlay);
          let activationPointerType = "mouse";
          button.addEventListener("pointerdown", (event) => {
            activationPointerType = event.pointerType;
          });
          button.addEventListener("click", (event) => openLightbox(visibleIndex, button, {
            pointerType: activationPointerType,
            clientX: event.clientX,
            clientY: event.clientY,
          }));

          card.append(button);
          grid.append(card);
        });

        subgroup.append(subheading);
        const subcategoryDescription = renderMarkdown(localizedMarkdown(subcategoryDetails.markdown));
        if (subcategoryDescription) {
          subheading.classList.add("has-description");
          subgroup.append(subcategoryDescription);
        }
        subgroup.append(grid);
        group.append(subgroup);
      });

      gallery.append(group);
    });
    fitMobileHeadings();
    updateStickyCategoryHeadings();
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
  const activeFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isMobileLandscape = (event) =>
    event.pointerType !== "mouse" && window.innerWidth > window.innerHeight && window.innerHeight <= 680;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const requestLightboxFullscreen = () => {
    lightbox.classList.add("is-mobile-fullscreen");
    const requestFullscreen = lightbox.requestFullscreen || lightbox.webkitRequestFullscreen;
    if (!requestFullscreen) return;

    try {
      const request = requestFullscreen.call(lightbox, { navigationUI: "hide" });
      request?.catch?.(() => {
        // Keep the edge-to-edge CSS fallback when the browser cannot expose
        // the native fullscreen API for a dialog element (notably older iOS).
      });
    } catch {
      // The CSS fallback already fills the visual viewport.
    }
  };

  const exitLightboxFullscreen = () => {
    if (activeFullscreenElement() === lightbox) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      try {
        exitFullscreen?.call(document)?.catch?.(() => {});
      } catch {
        // Closing the dialog also exits fullscreen in supporting browsers.
      }
    }
    lightbox.classList.remove("is-mobile-fullscreen");
  };

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

  const handleImageDoubleTap = (event) => {
    if (!activeLightboxImage()) return;
    if (
      isMobileLandscape(event)
      && !activeFullscreenElement()
      && !lightbox.classList.contains("is-mobile-fullscreen")
    ) {
      requestLightboxFullscreen();
      return;
    }
    if (zoomState.scale > 1) {
      resetZoom();
      return;
    }

    const viewport = lightboxMedia.getBoundingClientRect();
    zoomState.scale = doubleTapScale;
    zoomState.x = -(event.clientX - (viewport.left + viewport.width / 2)) * (zoomState.scale - 1);
    zoomState.y = -(event.clientY - (viewport.top + viewport.height / 2)) * (zoomState.scale - 1);
    applyZoom();
  };

  const resetSwipeOffset = () => {
    const wrapper = activeLightboxWrapper();
    if (!wrapper) return;
    wrapper.style.transform = "";
    wrapper.style.opacity = "";
  };

  const suspendGalleryVideos = () => {
    gallery.querySelectorAll("video").forEach((video) => {
      const source = video.getAttribute("src");
      if (source && !video.dataset.suspendedSrc) video.dataset.suspendedSrc = source;
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
  };

  const resumeGalleryVideos = () => {
    gallery.querySelectorAll("video").forEach((video) => {
      const source = video.dataset.suspendedSrc;
      if (source && !video.hasAttribute("src")) {
        video.src = source;
        delete video.dataset.suspendedSrc;
        video.load();
      }
      requestVideoPlayback(video);
    });
  };

  const releaseLightboxVideo = () => {
    const video = lightboxMedia.querySelector("video");
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
  };

  const preloadProject = (project) => {
    if (!project?.image || preloadCache.has(project.image)) return;
    if (project.mediaType === "video") {
      // Video thumbnails already hold their metadata. Creating another hidden
      // video here can exhaust the small decoder pool on mobile devices.
      preloadCache.set(project.image, true);
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
    if (lightbox.open) suspendGalleryVideos();
    releaseLightboxVideo();
    resetZoom();
    resetSwipeOffset();
    const project = visibleProjects[activeProjectIndex];
    lightboxMedia.classList.toggle("has-video", project.mediaType === "video");
    lightboxMedia.replaceChildren(makeProjectMedia(project, "project-media--lightbox"));
    lightboxTitle.textContent = project.title || "";
    lightboxMeta.textContent = project.description || "";
    lightboxCaption.hidden = !project.title && !project.description;
    lightboxCategory.textContent =
      data.categories.find((category) => category.id === project.category)?.label ?? project.category;
    lightbox.dataset.activeIndex = String(activeProjectIndex);
    preloadLightboxNeighbors();
    const activeVideo = lightboxMedia.querySelector("video");
    if (activeVideo) {
      window.requestAnimationFrame(() => {
        if (lightbox.open && activeVideo.isConnected) requestVideoPlayback(activeVideo);
      });
    }
  };

  const openLightbox = (index, trigger, activationEvent = null) => {
    activeProjectIndex = index;
    lastFocusedCard = trigger;
    suspendGalleryVideos();
    updateLightbox();
    lightbox.showModal();
    document.body.classList.add("is-locked");
    if (activationEvent && isMobileLandscape(activationEvent)) {
      // Seed the gesture with the thumbnail tap so a true double tap can
      // continue directly into fullscreen after the dialog opens.
      lastTap = {
        time: Date.now(),
        x: activationEvent.clientX,
        y: activationEvent.clientY,
      };
    }
    const activeVideo = lightboxMedia.querySelector("video");
    if (activeVideo) requestVideoPlayback(activeVideo);
  };

  const closeLightbox = () => {
    releaseLightboxVideo();
    resetZoom();
    exitLightboxFullscreen();
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
          handleImageDoubleTap(event);
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
        handleImageDoubleTap(event);
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
    if (event.target.closest("video")) return;

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
  document.addEventListener("fullscreenchange", () => {
    if (activeFullscreenElement() !== lightbox) lightbox.classList.remove("is-mobile-fullscreen");
  });
  document.addEventListener("webkitfullscreenchange", () => {
    if (activeFullscreenElement() !== lightbox) lightbox.classList.remove("is-mobile-fullscreen");
  });

  const applyLanguage = (language, { persist = true, rerender = true } = {}) => {
    activeLanguage = language === "cs" ? "cs" : "en";
    document.documentElement.lang = activeLanguage === "cs" ? "cs" : "en";
    document.title = translate("page.title");

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      element.alt = translate(element.dataset.i18nAlt);
    });
    document.querySelectorAll("[data-i18n-content]").forEach((element) => {
      element.content = translate(element.dataset.i18nContent);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = translate(element.dataset.i18nTitle);
    });

    if (resumeDownload) {
      const resumeFile = resumeFiles[activeLanguage];
      resumeDownload.href = resumeFile;
      resumeDownload.download = resumeFile.split("/").at(-1);
    }

    languageButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.language === activeLanguage));
    });
    specializationAccessible.textContent = translate("hero.specializationAccessible");
    showSpecialization(0, false);
    startSpecializationRotation();

    if (persist) {
      try {
        window.localStorage.setItem(languageStorageKey, activeLanguage);
      } catch {
        // The language still changes when storage is unavailable.
      }
    }

    if (rerender) {
      renderFilters();
      renderGallery();
      if (lightbox.open) updateLightbox();
      showHeroSlide(activeHeroIndex);
    }
  };

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.language));
  });

  const setWorkSubmenu = (open) => {
    if (!workToggle || !mobileFilters) return;
    workToggle.setAttribute("aria-expanded", String(open));
    mobileFilters.hidden = !open;
    document.querySelectorAll("[data-category-menu-trigger]").forEach((trigger) => {
      trigger.setAttribute("aria-expanded", String(open));
    });
  };

  workToggle?.addEventListener("click", () => {
    setWorkSubmenu(workToggle.getAttribute("aria-expanded") !== "true");
  });

  const toggleWorkSubmenuFromStickyHeading = () => {
    if (!window.matchMedia("(max-width: 680px)").matches) return;
    setWorkSubmenu(workToggle?.getAttribute("aria-expanded") !== "true");
  };

  gallery.addEventListener("click", (event) => {
    if (!event.target.closest("[data-category-menu-trigger]")) return;
    toggleWorkSubmenuFromStickyHeading();
  });
  gallery.addEventListener("keydown", (event) => {
    if (!event.target.closest("[data-category-menu-trigger]") || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    toggleWorkSubmenuFromStickyHeading();
  });

  filterContainers.forEach((container) => {
    container.addEventListener("click", (event) => {
      const link = event.target.closest("[data-category]");
      if (!link) return;
      event.preventDefault();
      activeNavigationCategory = link.dataset.category;
      filterContainers.forEach((filterContainer) => {
        filterContainer.querySelectorAll("[data-category]").forEach((item) => {
          if (item.dataset.category === activeNavigationCategory) {
            item.setAttribute("aria-current", "location");
          } else {
            item.removeAttribute("aria-current");
          }
        });
      });
      setWorkSubmenu(false);

      const target = document.getElementById(`gallery-group-${toDomId(activeNavigationCategory)}`)
        ?.closest(".gallery-group");
      if (!target) return;
      const headerHeight = Number.parseFloat(
        window.getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
      ) || 0;
      const filterHeight = filters && window.getComputedStyle(filters).display !== "none"
        ? filters.getBoundingClientRect().height
        : 0;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - filterHeight;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  });

  document.addEventListener("click", (event) => {
    if (
      workToggle?.getAttribute("aria-expanded") === "true"
      && !event.target.closest(".nav-work")
      && !event.target.closest("[data-category-menu-trigger]")
    ) {
      setWorkSubmenu(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setWorkSubmenu(false);
  });
  document.querySelectorAll('.site-nav a:not(.nav-work-link)').forEach((link) => {
    link.addEventListener("click", () => setWorkSubmenu(false));
  });
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 680px)").matches) setWorkSubmenu(false);
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
    releaseLightboxVideo();
    resetZoom();
    exitLightboxFullscreen();
    document.body.classList.remove("is-locked");
    resumeGalleryVideos();
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
  window.addEventListener("scroll", updateStickyCategoryHeadings, { passive: true });
  window.addEventListener("resize", updateBackToTop);
  window.addEventListener("resize", () => {
    fitMobileHeadings();
    updateStickyCategoryHeadings();
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
        title: entry.title || null,
        description: entry.description || null,
        alt: entry.title || entry.description || "",
      }))
    : [featured];
  const heroTitle = document.querySelector("[data-hero-title]");
  const heroMeta = document.querySelector("[data-hero-meta]");
  const heroCaption = document.querySelector(".hero-caption");
  const heroControls = document.querySelector("[data-hero-controls]");
  const heroImages = [];
  let activeHeroIndex = 0;
  let heroTimer;
  let heroSwipeStart = null;

  heroSlides.forEach((slide, index) => {
    const image = document.createElement("img");
    image.src = slide.image;
    image.alt = slide.alt;
    image.className = "hero-image";
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";
    image.draggable = false;
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
    heroTitle.textContent = slide.title || "";
    heroMeta.textContent = slide.description || "";
    heroCaption.hidden = !slide.title && !slide.description;
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

  heroMedia.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1 || heroSlides.length < 2) return;
      const touch = event.touches[0];
      heroSwipeStart = { x: touch.clientX, y: touch.clientY };
      stopHeroCarousel();
    },
    { passive: true },
  );
  heroMedia.addEventListener(
    "touchend",
    (event) => {
      if (!heroSwipeStart) return;
      const touch = event.changedTouches[0];
      const distanceX = touch.clientX - heroSwipeStart.x;
      const distanceY = touch.clientY - heroSwipeStart.y;
      const isHorizontalSwipe = Math.abs(distanceX) >= 45 && Math.abs(distanceX) > Math.abs(distanceY) * 1.2;
      heroSwipeStart = null;
      if (isHorizontalSwipe) {
        moveHeroCarousel(distanceX < 0 ? 1 : -1);
      } else {
        startHeroCarousel();
      }
    },
    { passive: true },
  );
  heroMedia.addEventListener("touchcancel", () => {
    heroSwipeStart = null;
    startHeroCarousel();
  });
  heroMedia.addEventListener("mouseenter", stopHeroCarousel);
  heroMedia.addEventListener("mouseleave", startHeroCarousel);
  heroMedia.addEventListener("focusin", stopHeroCarousel);
  heroMedia.addEventListener("focusout", startHeroCarousel);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopHeroCarousel();
      stopSpecializationRotation();
    } else {
      startHeroCarousel();
      startSpecializationRotation();
    }
  });
  applyLanguage(activeLanguage, { persist: false, rerender: false });
  showHeroSlide(0);
  startHeroCarousel();

  renderFilters();
  renderGallery();
})();
