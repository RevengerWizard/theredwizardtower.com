(() => {
  const homepage = document.querySelector(".content-page--home");
  const taglineNode = document.querySelector(".brand__tagline");
  const dataNode = document.getElementById("site-taglines");

  if (!homepage || !taglineNode || !dataNode) {
    return;
  }

  let taglines = [];
  try {
    taglines = JSON.parse(dataNode.textContent || "[]");
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
