(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  /* ------------------------------------------------------------------
     Text splitting. Words become <span class="w" style="--i:n">.
     Elements marked .hl or .rotator stay whole and take the next index.
     ------------------------------------------------------------------ */
  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.append(part);
              return;
            }
            const span = document.createElement("span");
            span.className = "w";
            span.style.setProperty("--i", i++);
            span.textContent = part;
            frag.append(span);
          });
          child.replaceWith(frag);
        } else if (child.classList && (child.classList.contains("hl") || child.classList.contains("rotator"))) {
          child.style.setProperty("--i", i++);
          if (child.classList.contains("hl")) {
            child.style.animationDelay = "calc(var(--i) * 55ms + 120ms), 0s";
          }
        } else if (child.classList && child.classList.contains("sr-only")) {
          // leave screen-reader text alone
        } else {
          walk(child);
        }
      });
    };
    walk(el);
    return $$(".w", el);
  };

  $$("[data-split]").forEach((el) => {
    splitWords(el);
    el.classList.add("split");
  });
  $$("[data-words]").forEach(splitWords);

  $$("[data-letters]").forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "l";
      span.style.setProperty("--i", i);
      span.textContent = ch;
      el.append(span);
    });
  });

  /* ------------------------------------------------------------------
     Scroll: header glass, reading progress, back-to-top
     ------------------------------------------------------------------ */
  const header = document.querySelector(".site-header");
  const toTop = document.querySelector(".to-top");

  const onScroll = () => {
    const y = window.scrollY;
    header && header.classList.toggle("is-scrolled", y > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    root.style.setProperty("--p", max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    toTop && toTop.classList.toggle("show", y > window.innerHeight * 0.8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  toTop && toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  /* ------------------------------------------------------------------
     Reveal on scroll, with per-group stagger
     ------------------------------------------------------------------ */
  $$("[data-stagger]").forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty("--i", i));
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0.06 }
    );
    $$(".reveal").forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("in"));
  }

  /* ------------------------------------------------------------------
     Count-up numbers in the phone mockup
     ------------------------------------------------------------------ */
  const countUp = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split(".")[1] || "").length;
    const fmt = new Intl.NumberFormat(el.dataset.locale || "en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    if (reduceMotion) {
      el.textContent = prefix + fmt.format(target) + suffix;
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / 1600, 1);
      el.textContent = prefix + fmt.format(target * (1 - Math.pow(1 - t, 4))) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  $$("[data-count]").forEach((el) => {
    const delay = parseInt(el.dataset.delay || "0", 10);
    if (el.hasAttribute("data-on-view") && "IntersectionObserver" in window) {
      const once = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        once.disconnect();
        setTimeout(() => countUp(el), delay);
      }, { threshold: 0.4 });
      once.observe(el);
    } else {
      setTimeout(() => countUp(el), delay);
    }
  });

  /* ------------------------------------------------------------------
     Headline rotator
     ------------------------------------------------------------------ */
  $$(".rotator").forEach((rot) => {
    const words = $$(".hl", rot);
    if (words.length < 2 || reduceMotion) return;
    let index = 0;
    // Size the slot to the visible word so centred and RTL layouts don't leave a gap.
    const fit = () => {
      rot.style.width = `${words[index].getBoundingClientRect().width}px`;
    };
    fit();
    window.addEventListener("resize", () => {
      rot.style.transition = "none";
      fit();
      requestAnimationFrame(() => (rot.style.transition = ""));
    });
    if (document.fonts) document.fonts.ready.then(fit);
    setInterval(() => {
      if (document.hidden) return;
      const prev = words[index];
      index = (index + 1) % words.length;
      const next = words[index];
      prev.classList.remove("on");
      prev.classList.add("out");
      next.classList.remove("out");
      next.classList.add("on");
      fit();
      setTimeout(() => prev.classList.remove("out"), 800);
    }, 2600);
  });

  /* ------------------------------------------------------------------
     Phone notifications that drop in on a loop
     ------------------------------------------------------------------ */
  const notes = $$(".notif");
  if (notes.length && !reduceMotion) {
    let n = 0;
    const cycle = () => {
      if (!document.hidden) {
        const note = notes[n % notes.length];
        note.classList.remove("hide");
        note.classList.add("show");
        setTimeout(() => {
          note.classList.add("hide");
          note.classList.remove("show");
        }, 3200);
        n++;
      }
    };
    setTimeout(() => {
      cycle();
      setInterval(cycle, 4600);
    }, 2600);
  }

  /* ------------------------------------------------------------------
     Manifesto: words light up as the paragraph scrolls through view
     ------------------------------------------------------------------ */
  $$("[data-scrub]").forEach((el) => {
    const words = splitWords(el);
    if (reduceMotion) {
      words.forEach((w) => w.classList.add("lit"));
      return;
    }
    let lastLit = -1;
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      const lit = Math.round(progress * words.length);
      if (lit === lastLit) return;
      lastLit = lit;
      words.forEach((w, i) => w.classList.toggle("lit", i < lit));
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  });

  /* ------------------------------------------------------------------
     Pointer effects (desktop only)
     ------------------------------------------------------------------ */
  if (finePointer && !reduceMotion) {
    // Cursor aura with eased follow.
    const aura = document.createElement("div");
    aura.className = "aura";
    aura.setAttribute("aria-hidden", "true");
    const backdrop = document.querySelector(".backdrop");
    (backdrop ? backdrop.after.bind(backdrop) : document.body.prepend.bind(document.body))(aura);
    let ax = innerWidth / 2;
    let ay = innerHeight / 3;
    let tx = ax;
    let ty = ay;
    let running = false;
    const follow = () => {
      ax += (tx - ax) * 0.12;
      ay += (ty - ay) * 0.12;
      aura.style.transform = `translate3d(${ax}px, ${ay}px, 0)`;
      if (Math.abs(tx - ax) > 0.5 || Math.abs(ty - ay) > 0.5) {
        requestAnimationFrame(follow);
      } else {
        running = false;
      }
    };
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      aura.classList.add("on");
      if (!running) {
        running = true;
        requestAnimationFrame(follow);
      }
    }, { passive: true });
    document.addEventListener("pointerleave", () => aura.classList.remove("on"));

    // Magnetic buttons.
    $$(".magnetic").forEach((el) => {
      const strength = parseFloat(el.dataset.magnet || "0.28");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--tx", `${(e.clientX - r.left - r.width / 2) * strength}px`);
        el.style.setProperty("--ty", `${(e.clientY - r.top - r.height / 2) * strength}px`);
      });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--tx", "0px");
        el.style.setProperty("--ty", "0px");
      });
    });

    // 3D tilt.
    $$(".tilt").forEach((el) => {
      const max = parseFloat(el.dataset.tilt || "7");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        const mag = Math.min(Math.hypot(x, y) * 2, 1);
        if (mag < 0.01) return;
        el.style.setProperty("--rax", (-y).toFixed(3));
        el.style.setProperty("--ray", x.toFixed(3));
        el.style.setProperty("--rang", `${(mag * max).toFixed(2)}deg`);
      });
      el.addEventListener("pointerleave", () => el.style.setProperty("--rang", "0deg"));
    });

    // Spotlight inside tiles.
    $$(".tile").forEach((tile) => {
      tile.addEventListener("pointermove", (e) => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty("--mx", `${e.clientX - r.left}px`);
        tile.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });

    // Phone fan follows the pointer.
    const showcase = document.querySelector(".showcase");
    if (showcase) {
      let frame = 0;
      showcase.addEventListener("pointermove", (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = showcase.getBoundingClientRect();
          showcase.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
          showcase.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
        });
      });
      showcase.addEventListener("pointerleave", () => {
        showcase.style.setProperty("--px", 0);
        showcase.style.setProperty("--py", 0);
      });
    }
  }

  /* ------------------------------------------------------------------
     Feature tour: the step nearest the viewport centre drives the phone
     ------------------------------------------------------------------ */
  const tour = document.querySelector(".tour");
  if (tour) {
    const steps = $$(".step", tour);
    const shots = $$(".tour-stage .shot", tour);
    const count = tour.querySelector(".tour-count b");
    const rail = tour.querySelector(".tour-steps");
    let current = -1;
    const setStep = (i) => {
      if (i === current) return;
      current = i;
      tour.dataset.step = i + 1;
      steps.forEach((s, k) => s.classList.toggle("active", k === i));
      shots.forEach((s, k) => {
        s.classList.toggle("active", k === i);
        s.classList.toggle("past", k < i);
      });
      if (count) {
        count.textContent = String(i + 1).padStart(2, "0");
        count.classList.remove("tick");
        void count.offsetWidth;
        count.classList.add("tick");
      }
    };
    let ticking = false;
    const update = () => {
      ticking = false;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      steps.forEach((s, k) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDistance) {
          bestDistance = d;
          best = k;
        }
      });
      setStep(best);
      const r = rail.getBoundingClientRect();
      tour.style.setProperty("--tp", clamp((mid - r.top) / r.height, 0, 1).toFixed(3));
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ------------------------------------------------------------------
     Sticky GET bar: shows once the hero download button scrolls away,
     hides again when the final download panel is on screen
     ------------------------------------------------------------------ */
  const getbar = document.querySelector(".getbar");
  const heroCta = document.querySelector(".hero .store-btn");
  if (getbar && heroCta && "IntersectionObserver" in window) {
    const finale = document.querySelector(".download");
    let heroGone = false;
    let finaleIn = false;
    const sync = () => getbar.classList.toggle("show", heroGone && !finaleIn);
    new IntersectionObserver(([entry]) => {
      heroGone = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      sync();
    }).observe(heroCta);
    if (finale) {
      new IntersectionObserver(([entry]) => {
        finaleIn = entry.isIntersecting;
        sync();
      }).observe(finale);
    }
  }

  /* ------------------------------------------------------------------
     Table of contents: scrollspy, sliding indicator, active section
     ------------------------------------------------------------------ */
  const toc = document.querySelector(".toc");
  if (toc) {
    const links = $$("a[href^='#']", toc);
    const list = toc.querySelector("ol");
    const indicator = toc.querySelector(".toc-indicator");
    const sections = links
      .map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))))
      .filter(Boolean);

    const setActive = (id) => {
      sections.forEach((s) => s.classList.toggle("is-active", s.id === id));
      links.forEach((a) => {
        const on = a.hash === `#${id}`;
        a.classList.toggle("active", on);
        if (!on) {
          a.removeAttribute("aria-current");
          return;
        }
        a.setAttribute("aria-current", "location");
        const li = a.parentElement;
        if (indicator) {
          indicator.style.transform = `translateY(${li.offsetTop}px)`;
          indicator.style.height = `${li.offsetHeight}px`;
        }
        // Keep the active chip in view on the mobile rail without moving the page.
        if (list && list.scrollWidth > list.clientWidth + 4) {
          const target = li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2;
          list.scrollTo({ left: target, behavior: reduceMotion ? "auto" : "smooth" });
        }
      });
    };

    let current = "";
    let ticking = false;
    const update = () => {
      ticking = false;
      const line = window.innerHeight * 0.3;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let active = sections[0];
      if (atBottom) {
        active = sections[sections.length - 1];
      } else {
        for (const s of sections) {
          if (s.getBoundingClientRect().top <= line) active = s;
          else break;
        }
      }
      if (active && active.id !== current) {
        current = active.id;
        setActive(current);
      }
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener("resize", () => {
      current = "";
      update();
    });
    update();
  }

  /* Language menu: close on outside click or Escape. */
  $$(".lang-menu").forEach((menu) => {
    document.addEventListener("click", (e) => {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.open) {
        menu.open = false;
        menu.querySelector("summary").focus();
      }
    });
  });

  /* ------------------------------------------------------------------
     Copy email to clipboard with a toast
     ------------------------------------------------------------------ */
  const toast = document.querySelector(".toast");
  let toastTimer = 0;
  $$("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
      } catch {
        window.location.href = `mailto:${btn.dataset.copy}`;
        return;
      }
      btn.classList.add("done");
      if (toast) {
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          toast.classList.remove("show");
          btn.classList.remove("done");
        }, 2200);
      }
    });
  });
})();
