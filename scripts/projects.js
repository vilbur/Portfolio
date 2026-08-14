/*
 * Site identity stays here. Galleries, sub-galleries and projects are derived
 * automatically from the generated image catalog.
 */
(() => {
  const catalog = window.PORTFOLIO_IMAGE_CATALOG ?? [];

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

  const humanize = (value) => {
    if (labels[value]) return labels[value];
    return value
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace(/\b3d\b/gi, "3D")
      .replace(/\bCg\b/g, "CG")
      .replace(/\bIi\b/g, "II");
  };

  const folderLabel = (value) => {
    if (labels[value]) return labels[value];
    if (value.includes(" - ") || /[A-ZÁ-Ž]/.test(value)) return value.replace(/_/g, " ");
    return humanize(value);
  };

  const categoryIds = [...new Set(
    catalog.map((entry) => entry.path.replace("assets/library/", "").split("/")[0]),
  )];
  const categories = [
    { id: "all", label: "All work" },
    ...categoryIds.map((id) => ({ id, label: folderLabel(id) })),
  ];
  const tonePalette = ["ember", "steel", "blue", "graphite"];

  const projects = catalog.map((entry) => {
    const parts = entry.path.replace("assets/library/", "").split("/");
    const category = parts[0];
    const filename = parts.at(-1);
    const subcategory = parts.length > 2 ? parts[1] : "overview";
    const subcategoryLabel = subcategory === "overview" ? "Overview" : folderLabel(subcategory);
    const title = filename.toLowerCase() === "header.jpg"
      ? `${folderLabel(category)} — Header`
      : humanize(filename);

    return {
      title,
      category,
      categoryLabel: subcategoryLabel,
      subcategory,
      subcategoryLabel,
      year: "Archive",
      image: entry.path,
      alt: `${title} — ${subcategoryLabel} portfolio image`,
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
