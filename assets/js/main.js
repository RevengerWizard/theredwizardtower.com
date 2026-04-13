(() => {
  const taglineNode = document.querySelector(".tagline");
  const dataNode = document.getElementById("site-taglines");

  if (!taglineNode || !dataNode) {
    return;
  }

  let taglines = [];
  try {
    const raw = dataNode.textContent || "[]";
    const parsed = JSON.parse(raw);
    taglines = (typeof parsed === "string" ? JSON.parse(parsed) : parsed).map(
      (tagline) => {
        if (typeof tagline !== "string") {
          return "";
        }

        try {
          return JSON.parse(tagline);
        } catch (error) {
          return tagline;
        }
      },
    );
  } catch (error) {
    return;
  }

  if (!Array.isArray(taglines) || taglines.length === 0) {
    return;
  }

  const nextTagline = taglines[Math.floor(Math.random() * taglines.length)];
  if (typeof nextTagline === "string" && nextTagline.trim()) {
    taglineNode.textContent = nextTagline;
  }
})();
