document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  const setMenu = (open) => {
    links.classList.toggle('open', open);
    toggle.classList.toggle('is-open', open);
    toggle.textContent = open ? '✕' : '☰';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('menu-open', open);
  };

  if (toggle && links) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      setMenu(!links.classList.contains('open'));
    });
    // Closing the menu automatically when a link is tapped
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => setMenu(false));
    });
    // Tapping the dimmed backdrop closes the drawer
    document.addEventListener('click', (e) => {
      if (!links.classList.contains('open')) return;
      if (links.contains(e.target) || toggle.contains(e.target)) return;
      setMenu(false);
    });
    // Escape key closes the drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  // Library filter (only present on library.html)
  const filterBtns = document.querySelectorAll('.filter-row button');
  const works = document.querySelectorAll('.work');
  if (filterBtns.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.filter;
        works.forEach(w => {
          const show = type === 'all' || w.dataset.type === type;
          w.style.display = show ? 'flex' : 'none';
        });
      });
    });
  }

  // Directory filter (only present on directory.html) — supports
  // deep-links like directory.html?cat=Producer from the nav dropdown.
  const dirFilterRow = document.getElementById('directory-filters');
  const dirCards = document.querySelectorAll('.directory-card');
  if (dirFilterRow && dirCards.length) {
    const dirBtns = dirFilterRow.querySelectorAll('button');
    const applyDirFilter = (cat) => {
      dirBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === cat));
      dirCards.forEach(c => {
        const show = cat === 'all' || c.dataset.category === cat;
        c.style.display = show ? 'flex' : 'none';
      });
    };
    dirBtns.forEach(btn => {
      btn.addEventListener('click', () => applyDirFilter(btn.dataset.filter));
    });
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('cat');
    if (catParam && [...dirBtns].some(b => b.dataset.filter === catParam)) {
      applyDirFilter(catParam);
    }
  }

  // Coming soon page: read ?s= from the URL and personalize the heading
  const soonTitle = document.getElementById('soon-title');
  if (soonTitle) {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('s');
    if (section) {
      soonTitle.textContent = `${section} is coming soon.`;
      document.title = `${section} — Coming Soon — The Studio Contract`;
    }
  }

  // Search page: simple client-side search over the live Guides content
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    const library = [
      { title: "Who Owns Your Master?", type: "Guide", desc: "The difference between the master recording and the composition — and why producers and artists need to split them clearly.", meta: "Read time · 8 min", cta: "Read online", href: "who-owns-your-master.html" },
      { title: "The Producer Agreement, Explained", type: "PDF", desc: "A clause-by-clause breakdown of a typical beat licensing agreement — exclusive vs. non-exclusive, term, and territory.", meta: "12 pages", cta: "Download PDF", href: "library.html#guides" },
      { title: "How Royalties Actually Reach You", type: "Guide", desc: "Mechanical, performance, and sync royalties — and the role collection societies play in getting them to Basotho artists.", meta: "Read time · 10 min", cta: "Read online", href: "how-royalties-reach-you.html" },
      { title: "Music Business 101 for Basotho Creatives", type: "Ebook", desc: "A starter ebook covering copyright basics, registering your work, and the most common deals you'll be offered early on.", meta: "34 pages", cta: "Download ebook", href: "library.html#guides" },
      { title: "Reading a Distribution Deal", type: "PDF", desc: "What distributors take, what they don't, and the red flags to check for before you sign with one.", meta: "9 pages", cta: "Download PDF", href: "library.html#guides" },
      { title: "Copyright Basics: Protecting Your Work", type: "Guide", desc: "What copyright actually protects, how registration works in Lesotho, and what to do the moment you finish a song.", meta: "Read time · 7 min", cta: "Read online", href: "copyright-basics.html" },
    ];
    const resultsEl = document.getElementById('search-results');
    const emptyEl = document.getElementById('search-empty');

    function render(list) {
      resultsEl.innerHTML = '';
      if (!list.length) {
        emptyEl.style.display = 'block';
        return;
      }
      emptyEl.style.display = 'none';
      list.forEach(item => {
        const el = document.createElement('article');
        el.className = 'work';
        el.innerHTML = `
          <div class="work-top">
            <h3>${item.title}</h3>
            <span class="work-type">${item.type}</span>
          </div>
          <p>${item.desc}</p>
          <div class="work-meta">
            <span>${item.meta}</span>
            <a href="${item.href}">${item.cta} →</a>
          </div>`;
        resultsEl.appendChild(el);
      });
    }

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { resultsEl.innerHTML = ''; emptyEl.style.display = 'none'; return; }
      const matches = library.filter(item =>
        item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
      );
      render(matches);
    });
  }
});

