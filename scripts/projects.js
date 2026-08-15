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
    dayz: "DayZ",
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
    markdown: folderMetadata[path]?.markdown?.trim() || null,
    url: folderMetadata[path]?.url || null,
  });

  const categoryIds = [...new Set(
    sortedCatalog.map((entry) => entry.path.replace("assets/library/", "").split("/")[0]),
  )];
  const categories = [
    { id: "all", label: "All work" },
    ...categoryIds.map((id) => ({ id, label: folderLabel(id), ...metadataFor(id) })),
  ];
  const tonePalette = ["ember", "steel", "blue", "graphite"];

  const projects = sortedCatalog.map((entry) => {
    const parts = entry.path.replace("assets/library/", "").split("/");
    const category = parts[0];
    const filename = parts.at(-1);
    const subcategory = parts.length > 2 ? parts[1] : "overview";
    const subcategoryLabel = subcategory === "overview" ? "Overview" : folderLabel(subcategory);
    const subcategoryMetadata = subcategory === "overview"
      ? { markdown: null, url: null }
      : metadataFor(`${category}/${subcategory}`);
    const filenameTitle = filename.toLowerCase() === "header.jpg"
      ? `${folderLabel(category)} — Header`
      : humanize(filename);
    const title = entry.comment?.trim() || filenameTitle;

    return {
      title,
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
      alt: `${title} — ${subcategoryLabel} portfolio ${entry.type === "video" ? "video" : "image"}`,
      format: entry.format,
      tone: tonePalette[categoryIds.indexOf(category) % tonePalette.length],
    };
  });

  window.PORTFOLIO_DATA = {
    site: {
      name: "3D ARTIST",
      email: "hello@yourdomain.com",
      featuredImage: "assets/library/unreal/Maserati-Ghibli/Maserati-Ghibli-detail.jpg",
    },
    categories,
    projects,
  };
})();
