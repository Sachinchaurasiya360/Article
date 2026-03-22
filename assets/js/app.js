// ===== Shared utilities =====

function stripFrontMatter(text) {
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) return text.slice(end + 4).trimStart();
  }
  return text;
}

function extractTitle(markdown) {
  const m = markdown.match(/^#{1,2}\s+(.+)/m);
  return m ? m[1].trim() : null;
}

// ===== Navigation =====

function buildNav() {
  if (typeof SERIES === 'undefined') return;

  // Dropdown menu (desktop)
  const menu = document.getElementById('nav-series-links');
  if (menu) {
    SERIES.forEach(s => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `series.html?id=${s.id}`;
      a.innerHTML = `<i data-lucide="${s.icon}" style="stroke:${s.iconColor}"></i>${s.title}`;
      li.appendChild(a);
      menu.appendChild(li);
    });
  }

  // Mobile grid
  const mobileGrid = document.getElementById('mobile-series-grid');
  if (mobileGrid) {
    SERIES.forEach(s => {
      const a = document.createElement('a');
      a.href = `series.html?id=${s.id}`;
      a.innerHTML = `<i data-lucide="${s.icon}" style="stroke:${s.iconColor}"></i>${s.title}`;
      mobileGrid.appendChild(a);
    });
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Dropdown toggle (click to open/close)
  const dropdownBtn = document.getElementById('nav-dropdown-btn');
  const dropdown = document.getElementById('nav-dropdown');
  if (dropdownBtn && dropdown) {
    dropdownBtn.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }

  // Mobile menu toggle
  const toggle = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', () => mobileMenu.classList.toggle('open'));
  }
}

// ===== Back to top + progress =====

function setupScrollFeatures() {
  const btn = document.getElementById('back-to-top');
  const bar = document.getElementById('progress-bar');

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const total = document.body.scrollHeight - window.innerHeight;

    if (btn) {
      btn.classList.toggle('visible', scrolled > 400);
    }
    if (bar && total > 0) {
      bar.style.width = Math.min(100, (scrolled / total) * 100) + '%';
    }
  }, { passive: true });

  if (btn) {
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
}

// ===== TOC generation =====

function buildTOC(container) {
  const sidebar = document.getElementById('toc-sidebar');
  if (!sidebar) return;

  const headings = container.querySelectorAll('h2, h3');
  if (headings.length < 3) return;

  const title = document.createElement('div');
  title.className = 'toc-title';
  title.textContent = 'On this page';
  sidebar.appendChild(title);

  const ul = document.createElement('ul');

  headings.forEach((h, i) => {
    if (!h.id) h.id = 'heading-' + i;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    if (h.tagName === 'H3') a.className = 'toc-h3';
    a.addEventListener('click', e => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    li.appendChild(a);
    ul.appendChild(li);
  });

  sidebar.appendChild(ul);

  // Active heading highlight
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sidebar.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        const active = sidebar.querySelector(`a[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  headings.forEach(h => observer.observe(h));
}

// ===== Copy buttons on code blocks =====

function addCopyButtons(container) {
  container.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    pre.style.position = 'relative';
    pre.appendChild(btn);

    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Copy'), 2000);
      });
    });
  });
}

// ===== Mermaid =====

function renderMermaid() {
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    mermaid.run();
  }
}

// ===== Markdown rendering (used by article.html) =====

async function loadArticle() {
  const params = new URLSearchParams(location.search);
  const filePath = params.get('path');

  const loadingEl = document.querySelector('#article-container .loading-state');
  const headerEl  = document.getElementById('article-header-block');
  const bodyEl    = document.getElementById('article-body');
  const navEl     = document.getElementById('article-nav');

  function showError(msg) {
    if (loadingEl) loadingEl.innerHTML = `<div class="error-state"><h2>Failed to load article</h2><p>${msg}</p><p><a href="index.html">← Back to home</a></p></div>`;
  }

  if (!bodyEl) return; // not on article page

  if (!filePath) {
    showError('No article specified. Add ?path=Series/filename.md to the URL.');
    return;
  }

  try {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`HTTP ${res.status} — could not fetch ${filePath}`);
    const raw = await res.text();
    const md = stripFrontMatter(raw);

    // Extract series/part info from path
    const segments = filePath.split('/');
    const seriesId = segments[0];
    const fileName = segments[segments.length - 1].replace('.md', '');
    const partMatch = fileName.match(/part-(\d+)/);
    const partNum = partMatch ? parseInt(partMatch[1]) : 0;

    // Resolve series data
    let seriesData = null;
    let articleData = null;
    if (typeof getSeriesById === 'function') {
      seriesData = getSeriesById(seriesId);
      if (seriesData) articleData = seriesData.articles.find(a => a.num === partNum);
    }

    const title = (articleData && articleData.titles) ? articleData.titles : extractTitle(md) || 'Article';

    // Breadcrumb
    const breadcrumb = document.getElementById('article-breadcrumb');
    if (breadcrumb && seriesData) {
      breadcrumb.innerHTML = `<a href="index.html">Home</a><span>›</span><a href="series.html?id=${seriesId}">${seriesData.title}</a><span>›</span>Part ${partNum}`;
    }

    document.title = title + ' — DeepDive';

    const titleEl = document.getElementById('article-title');
    if (titleEl) titleEl.textContent = title;

    // Render markdown
    if (typeof marked === 'undefined') throw new Error('marked.js failed to load');
    marked.setOptions({ breaks: false, gfm: true });
    bodyEl.innerHTML = marked.parse(md);

    // Syntax highlighting
    if (typeof hljs !== 'undefined') {
      bodyEl.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }

    // Wrap tables for horizontal scroll on mobile
    bodyEl.querySelectorAll('table').forEach(table => {
      if (table.parentElement.classList.contains('table-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    // Mermaid — replace fenced code blocks with .mermaid divs
    bodyEl.querySelectorAll('code.language-mermaid').forEach(code => {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      code.parentElement.replaceWith(div);
    });
    renderMermaid();

    addCopyButtons(bodyEl);
    buildTOC(bodyEl);

    // Hide loading, reveal header
    if (loadingEl) loadingEl.remove();
    if (headerEl) headerEl.style.display = '';

    // Prev / Next nav
    if (typeof getNeighbors === 'function' && navEl) {
      const { prev, next } = getNeighbors(seriesId, partNum);
      if (prev) {
        navEl.querySelector('.nav-prev').innerHTML = `
          <a class="nav-card" href="article.html?path=${prev.file}">
            <div class="nav-card-arrow">←</div>
            <div class="nav-card-text">
              <div class="nav-direction">Previous</div>
              <div class="nav-title">Part ${prev.num}: ${prev.titles || ''}</div>
            </div>
          </a>`;
      }
      if (next) {
        navEl.querySelector('.nav-next').innerHTML = `
          <a class="nav-card next" href="article.html?path=${next.file}">
            <div class="nav-card-arrow">→</div>
            <div class="nav-card-text">
              <div class="nav-direction">Next</div>
              <div class="nav-title">Part ${next.num}: ${next.titles || ''}</div>
            </div>
          </a>`;
      }
      if (prev || next) navEl.style.display = 'flex';
    }

  } catch (err) {
    showError(err.message);
  }
}

// ===== Series index page =====

function loadSeriesPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const container = document.getElementById('series-container');
  if (!container || typeof getSeriesById !== 'function') return;

  const s = getSeriesById(id);
  if (!s) {
    container.innerHTML = '<div class="error-state"><h2>Series not found</h2><p><a href="index.html">← Home</a></p></div>';
    return;
  }

  document.title = s.title + ' — DeepDive';

  container.innerHTML = `
    <div class="series-header">
      <div class="series-icon" style="color:${s.iconColor}"><i data-lucide="${s.icon}"></i></div>
      <h1>${s.title}</h1>
      <p>${s.description}</p>
      <div class="card-meta">
        <span class="badge badge-parts">${s.parts} parts</span>
        <span class="badge">${s.level}</span>
      </div>
    </div>
    <div class="article-list">
      ${s.articles.map(a => `
        <a class="article-item" href="article.html?path=${a.file}">
          <div class="article-num">${a.num}</div>
          <div class="article-title">Part ${a.num}: ${a.titles || a.file}</div>
        </a>`).join('')}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== Init =====

document.addEventListener('DOMContentLoaded', () => {
  buildNav();
  setupScrollFeatures();

  const page = document.body.dataset.page;
  if (page === 'article') loadArticle();
  if (page === 'series') loadSeriesPage();
});
