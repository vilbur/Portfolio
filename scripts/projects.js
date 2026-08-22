/*
 * Site identity stays here. Galleries, sub-galleries and projects are derived
 * automatically from the generated image catalog.
 */
(() => {
  const catalog = window.PORTFOLIO_IMAGE_CATALOG ?? [];
  const folderMetadata = window.PORTFOLIO_FOLDER_METADATA ?? {};
  const orderPrefixPattern = /^\s*\d+[\s._-]+/;

  const labels = {
    "3d-print": "3D Print",
    "high-poly": "High Poly",
    "low-poly": "Low Poly",
    "realtime-visualization": "Realtime Visualization",
    "mafia-II": "Mafia II",
    dayz: "Day-Z",
    "take-on": "Take On",
    "alfa-romeo": "Alfa Romeo",
    "redbull-plane": "Red Bull Plane",
    "vila-lignum": "Vila Lignum",
    "Maserati-Ghibli": "Maserati Ghibli",
    mpio: "MPIO",
    wip: "WIP",
  };

  const stripOrderPrefix = (value) => String(value).replace(orderPrefixPattern, "");

  const humanize = (value) => {
    const cleanValue = stripOrderPrefix(value);
    if (labels[cleanValue]) return labels[cleanValue];
    return cleanValue
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace(/\b3d\b/gi, "3D")
      .replace(/\bCg\b/g, "CG")
      .replace(/\bIi\b/g, "II");
  };

  const folderLabel = (value) => {
    const cleanValue = stripOrderPrefix(value);
    if (labels[cleanValue]) return labels[cleanValue];
    if (cleanValue.includes(" - ") || /[A-ZÁ-Ž]/.test(cleanValue)) {
      return cleanValue.replace(/_/g, " ");
    }
    return humanize(cleanValue);
  };

  const compareCatalogPaths = (leftEntry, rightEntry) => {
    const leftParts = leftEntry.path.replace("assets/library/", "").split("/");
    const rightParts = rightEntry.path.replace("assets/library/", "").split("/");
    const leftFolder = leftParts.slice(0, -1).join("/");
    const rightFolder = rightParts.slice(0, -1).join("/");

    if (leftFolder === rightFolder && leftEntry.type !== rightEntry.type) {
      if (leftEntry.type === "video") return -1;
      if (rightEntry.type === "video") return 1;
    }

    const partCount = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < partCount; index += 1) {
      const leftPart = leftParts[index] ?? "";
      const rightPart = rightParts[index] ?? "";
      const leftPrefix = leftPart.match(/^\s*(\d+)[\s._-]+/);
      const rightPrefix = rightPart.match(/^\s*(\d+)[\s._-]+/);

      if (leftPrefix && rightPrefix && Number(leftPrefix[1]) !== Number(rightPrefix[1])) {
        return Number(leftPrefix[1]) - Number(rightPrefix[1]);
      }
      if (leftPrefix && !rightPrefix) return -1;
      if (!leftPrefix && rightPrefix) return 1;

      const comparison = leftPart.localeCompare(rightPart, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (comparison) return comparison;
    }

    return 0;
  };

  const sortedCatalog = [...catalog].sort(compareCatalogPaths);
  const metadataFor = (path) => ({
    markdown: folderMetadata[path]?.markdown || null,
    url: folderMetadata[path]?.url || null,
  });

  const categoryIds = [...new Set(
    sortedCatalog.map((entry) => entry.path.replace("assets/library/", "").split("/")[0]),
  )];
  const categories = categoryIds.map((id) => ({
    id,
    label: folderLabel(id),
    ...metadataFor(id),
  }));
  const tonePalette = ["ember", "steel", "blue", "graphite"];

  const projects = sortedCatalog.map((entry) => {
    const parts = entry.path.replace("assets/library/", "").split("/");
    const category = parts[0];
    const subcategory = parts.length > 2 ? parts[1] : "overview";
    const subcategoryLabel = subcategory === "overview" ? "Overview" : folderLabel(subcategory);
    const galleryPath = subcategory === "overview" ? category : `${category}/${subcategory}`;
    const subcategoryMetadata = subcategory === "overview"
      ? { markdown: null, url: null }
      : metadataFor(galleryPath);
    const title = entry.title?.trim() || null;
    const description = entry.description?.trim() || null;

    return {
      title,
      description,
      category,
      categoryLabel: subcategoryLabel,
      subcategory,
      subcategoryLabel,
      subcategoryMarkdown: subcategoryMetadata.markdown,
      subcategoryUrl: subcategoryMetadata.url,
      year: null,
      sourcePath: entry.path,
      image: `${entry.path}?v=${entry.version}`,
      mediaType: entry.type ?? "image",
      thumbnail: entry.thumbnail ?? "cover",
      alt: title || description || "",
      format: entry.format,
      tone: tonePalette[categoryIds.indexOf(category) % tonePalette.length],
    };
  });

  window.PORTFOLIO_DATA = {
    site: {
      name: "VILBUR 3D ARTIST",
      email: "cerny.vil@gmail.com",
      emailHref: "mailto:cerny.vil+portfolio@gmail.com",
      phoneDisplay: "+420 608 738 950",
      phoneHref: "tel:+420608738950",
      featuredImage: "assets/library/01 Unreal Engine/Maserati-Ghibli/Maserati-Ghibli-detail.jpg",
      translations: {
        en: {
          page: {
            title: "Vilbur Portfolio — 3D models and visualizations",
            description: "Vilbur Portfolio — 3D models, visualizations and assets for 3D printing.",
          },
          skipLink: "Skip to portfolio",
          brandAria: "Vilbur 3D Artist, back to top",
          navigation: { aria: "Main navigation", work: "Work", about: "About", contact: "Contact", menu: "Menu" },
          language: {
            aria: "Language",
            english: "English",
            czech: "Czech",
            englishAria: "Switch to English",
            czechAria: "Switch to Czech",
          },
          hero: {
            explore: "Explore the work",
            featuredAria: "Featured project",
            featuredRender: "Featured render",
            previousRender: "Previous featured render",
            nextRender: "Next featured render",
            specializations: ["models", "print", "visualizations"],
            specializationAccessible: "3D models, 3D print and 3D visualizations",
          },
          work: {
            galleryAria: "Portfolio",
            filtersAria: "Portfolio categories",
            singular: "work",
            plural: "works",
            overview: "Overview",
          },
          about: {
            eyebrow: "About",
            meTitle: "About me",
            title: "About my work",
            workEyebrow: "Work",
            role: "3D Artist",
            educationLabel: "Education",
            education: "SUPŠ Turnov – Goldsmithing",
            languagesLabel: "Language skills",
            englishB2: "English – B2",
            points: {
              models: "3D models",
              visualizations: "3D visualizations",
              print: "Models and assets for 3D printing",
              execution: "Clean geometry, realistic materials and careful execution",
            },
            photoAlt: "Portrait of Lubor Černý",
            resume: "Download resume",
            selectedProjects: "Participation in projects",
            pcGames: "PC Games",
            cartoonMovies: "Cartoon Movies",
          },
          contact: {
            eyebrow: "Contact",
            title: "Have a project in mind?",
            support: "Get in touch and we can discuss the project.",
          },
          gallery: {
            visit: "Visit ↗",
            visitAria: "Open {label} website in a new tab",
            renderSlot: "Render slot",
            openProject: "Open {label}",
            openImage: "Open image",
            openVideo: "Open video",
            viewFullscreen: "View fullscreen ↗",
          },
          footer: { backToTop: "Back to top" },
          lightbox: {
            aria: "Project preview",
            close: "Close",
            closeAria: "Close preview",
            previous: "Previous project",
            next: "Next project",
          },
        },
        cs: {
          page: {
            title: "Vilbur Portfolio — 3D modely a vizualizace",
            description: "Vilbur Portfolio — 3D modely, vizualizace a podklady pro 3D tisk.",
          },
          skipLink: "Přejít na portfolio",
          brandAria: "Vilbur 3D Artist, zpět nahoru",
          navigation: { aria: "Hlavní navigace", work: "Práce", about: "O mně", contact: "Kontakt", menu: "Menu" },
          language: {
            aria: "Jazyk",
            english: "Angličtina",
            czech: "Čeština",
            englishAria: "Přepnout do angličtiny",
            czechAria: "Přepnout do češtiny",
          },
          hero: {
            explore: "Prohlédnout práce",
            featuredAria: "Vybraný projekt",
            featuredRender: "Vybraný render",
            previousRender: "Předchozí vybraný render",
            nextRender: "Další vybraný render",
            specializations: ["modely", "tisk", "vizualizace"],
            specializationAccessible: "3D modely, 3D tisk a 3D vizualizace",
          },
          work: {
            galleryAria: "Portfolio",
            filtersAria: "Kategorie portfolia",
            singular: "práce",
            plural: "prací",
            overview: "Přehled",
          },
          about: {
            eyebrow: "O mně",
            meTitle: "O mně",
            title: "O mé práci",
            workEyebrow: "Práce",
            role: "3D grafik",
            educationLabel: "Vzdělání",
            education: "SUPŠ Turnov – obor zlatník",
            languagesLabel: "Jazykové znalosti",
            englishB2: "Angličtina – B2",
            points: {
              models: "3D modely",
              visualizations: "3D vizualizace",
              print: "Modely a podklady pro 3D tisk",
              execution: "Čistá geometrie, realistické materiály a pečlivé zpracování",
            },
            photoAlt: "Portrét Lubora Černého",
            resume: "Stáhnout životopis",
            selectedProjects: "Účast na projektech",
            pcGames: "PC hry",
            cartoonMovies: "Animované filmy",
          },
          contact: {
            eyebrow: "Kontakt",
            title: "Máte nápad na projekt?",
            support: "Napište mi, rád proberu možnosti spolupráce.",
          },
          gallery: {
            visit: "Navštívit ↗",
            visitAria: "Otevřít web {label} v nové záložce",
            renderSlot: "Místo pro render",
            openProject: "Otevřít {label}",
            openImage: "Otevřít obrázek",
            openVideo: "Otevřít video",
            viewFullscreen: "Zobrazit přes celou obrazovku ↗",
          },
          footer: { backToTop: "Zpět nahoru" },
          lightbox: {
            aria: "Náhled projektu",
            close: "Zavřít",
            closeAria: "Zavřít náhled",
            previous: "Předchozí projekt",
            next: "Další projekt",
          },
        },
      },
    },
    categories,
    projects,
  };
})();
