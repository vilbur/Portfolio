(() => {
  "use strict";

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

  let activeCategory = "all";
  let visibleProjects = [...data.projects];
  let activeProjectIndex = 0;
  let lastFocusedCard = null;

  const projectMeta = (project) => [project.categoryLabel, project.year].filter(Boolean).join(" / ");
  const toDomId = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

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

    if (project.image) {
      const image = document.createElement("img");
      image.src = project.image;
      image.alt = project.alt;
      image.loading = modifier.includes("lightbox") ? "eager" : "lazy";
      image.decoding = "async";
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
      heading.innerHTML = `
        <span>${String(categoryNumber).padStart(2, "0")}</span>
        <h3 id="${categoryDomId}">${category.label}</h3>
        <span>${String(categoryProjects.length).padStart(2, "0")} ${worksLabel}</span>
      `;

      group.append(heading);

      const subcategories = [...new Map(
        categoryProjects.map((project) => [project.subcategory, project.subcategoryLabel]),
      )];

      subcategories.forEach(([subcategory, subcategoryLabel], subcategoryIndex) => {
        const subcategoryProjects = categoryProjects.filter(
          (project) => project.subcategory === subcategory,
        );
        const subgroup = document.createElement("section");
        const subgroupId = `gallery-subgroup-${toDomId(category.id)}-${toDomId(subcategory)}`;
        subgroup.className = "gallery-subgroup";
        subgroup.setAttribute("aria-labelledby", subgroupId);

        const subheading = document.createElement("header");
        subheading.className = "gallery-subgroup-heading";
        subheading.innerHTML = `
          <span>${String(categoryNumber).padStart(2, "0")}.${String(subcategoryIndex + 1).padStart(2, "0")}</span>
          <h4 id="${subgroupId}">${subcategoryLabel}</h4>
          <span>${String(subcategoryProjects.length).padStart(2, "0")}</span>
        `;

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
          caption.innerHTML = `
            <div><span>${String(sourceIndex + 1).padStart(2, "0")}</span><h3>${project.title}</h3></div>
            <p>${projectMeta(project)}</p>
          `;

          card.append(button, caption);
          grid.append(card);
        });

        subgroup.append(subheading, grid);
        group.append(subgroup);
      });

      gallery.append(group);
    });
  };

  const updateLightbox = () => {
    const project = visibleProjects[activeProjectIndex];
    const sourceIndex = data.projects.indexOf(project);
    lightboxMedia.replaceChildren(makeProjectMedia(project, sourceIndex, "project-media--lightbox"));
    lightboxTitle.textContent = project.title;
    lightboxMeta.textContent = projectMeta(project);
    lightboxCategory.textContent =
      data.categories.find((category) => category.id === project.category)?.label ?? project.category;
    lightboxIndex.textContent = `${String(sourceIndex + 1).padStart(2, "0")} / ${String(data.projects.length).padStart(2, "0")}`;
  };

  const openLightbox = (index, trigger) => {
    activeProjectIndex = index;
    lastFocusedCard = trigger;
    updateLightbox();
    lightbox.showModal();
    document.body.classList.add("is-locked");
  };

  const closeLightbox = () => {
    lightbox.close();
    document.body.classList.remove("is-locked");
    lastFocusedCard?.focus();
  };

  const moveLightbox = (direction) => {
    activeProjectIndex =
      (activeProjectIndex + direction + visibleProjects.length) % visibleProjects.length;
    updateLightbox();
  };

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

  const featured =
    data.projects.find((project) => project.image === data.site.featuredImage) ??
    data.projects.find((project) => project.image) ??
    data.projects[0];
  const heroMedia = document.querySelector("[data-hero-media]");
  const headerImages = window.PORTFOLIO_HEADER_CAROUSEL ?? [];
  const heroSlides = headerImages.length
    ? headerImages.map((entry) => ({
        image: entry.path,
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
