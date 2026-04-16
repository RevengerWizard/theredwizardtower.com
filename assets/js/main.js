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

(() => {
  const projectCards = document.querySelectorAll("[data-github-repo]");
  if (!projectCards.length) {
    return;
  }

  const cachePrefix = "github-stars:";
  const cacheTtlMs = 24 * 60 * 60 * 1000;

  const loadCachedStars = (repo) => {
    try {
      const raw = window.localStorage.getItem(`${cachePrefix}${repo}`);
      if (!raw) {
        return null;
      }

      const cached = JSON.parse(raw);
      if (
        !cached ||
        typeof cached !== "object" ||
        typeof cached.value !== "number" ||
        typeof cached.expiresAt !== "number" ||
        cached.expiresAt < Date.now()
      ) {
        return null;
      }

      return cached.value;
    } catch (error) {
      return null;
    }
  };

  const saveCachedStars = (repo, value) => {
    try {
      window.localStorage.setItem(
        `${cachePrefix}${repo}`,
        JSON.stringify({
          value,
          expiresAt: Date.now() + cacheTtlMs,
        }),
      );
    } catch (error) {
      // Ignore storage failures.
    }
  };

  const formatStars = (value) => {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return Intl.NumberFormat("en", { notation: "compact" }).format(value);
  };

  const updateCard = (card, value) => {
    const countNode = card.querySelector("[data-project-stars-count]");
    if (countNode) {
      countNode.textContent = formatStars(value);
    }
  };

  const fetchStars = async (repo) => {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed for ${repo}`);
    }

    const payload = await response.json();
    return typeof payload.stargazers_count === "number"
      ? payload.stargazers_count
      : null;
  };

  const queue = Array.from(projectCards).map(async (card) => {
    const repo = card.getAttribute("data-github-repo");
    if (!repo) {
      return;
    }

    const cached = loadCachedStars(repo);
    if (cached !== null) {
      updateCard(card, cached);
      return;
    }

    try {
      const stars = await fetchStars(repo);
      if (stars !== null) {
        saveCachedStars(repo, stars);
        updateCard(card, stars);
      }
    } catch (error) {
      updateCard(card, null);
    }
  });

  Promise.all(queue).catch(() => {});
})();
