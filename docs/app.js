const chapterList = document.getElementById('chapter-list');
const searchInput = document.getElementById('search-input');
const versesContainer = document.getElementById('verses');
const resultsMeta = document.getElementById('results-meta');
const verseTemplate = document.getElementById('verse-template');

const state = {
  selectedChapter: 'all',
  query: '',
  chapters: [],
};

function parseChapter(raw, chapterNumber) {
  const lines = raw.split(/\r?\n/);
  const chapterTitleLine = lines.find((line) => /^\|\|\s*.*\|\|$/.test(line.trim()));
  const chapterTitle = chapterTitleLine
    ? chapterTitleLine.replace(/^\|\|\s*/, '').replace(/\s*\|\|$/, '')
    : Number.isFinite(chapterNumber)
      ? `Chapter ${chapterNumber}`
      : 'Untitled';

  const verses = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const verseMatch = trimmed.match(/^(.*)\s+\|\|\s*(\d+)\s*\|\|$/);
    if (verseMatch) {
      verses.push({
        text: verseMatch[1].trim(),
        verseNumber: Number(verseMatch[2]),
      });
    }
  }

  return {
    chapterNumber,
    chapterTitle,
    verses,
  };
}

async function loadChapters() {
  const manifestResponse = await fetch('./manifest.json');
  if (!manifestResponse.ok) {
    throw new Error('Failed to load chapter manifest');
  }
  const chapterFiles = await manifestResponse.json();

  const loaded = await Promise.all(
    chapterFiles.map(async (fileName) => {
      const chapterId = Number(fileName.replace('.txt', ''));
      const response = await fetch(`./raw/en/${fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to load chapter ${fileName}`);
      }
      const text = await response.text();
      return {
        id: fileName,
        ...parseChapter(text, chapterId),
      };
    })
  );

  state.chapters = loaded;
}

function buildChapterNav() {
  const allButton = document.createElement('button');
  allButton.className = 'chapter-link active';
  allButton.dataset.chapter = 'all';
  allButton.textContent = 'All';
  chapterList.appendChild(allButton);

  for (const chapter of state.chapters) {
    const button = document.createElement('button');
    button.className = 'chapter-link';
    button.dataset.chapter = chapter.id;
    button.textContent = chapter.chapterTitle.replace('||', '').trim();
    chapterList.appendChild(button);
  }

  chapterList.addEventListener('click', (event) => {
    const btn = event.target.closest('.chapter-link');
    if (!btn) return;

    state.selectedChapter = btn.dataset.chapter;
    document.querySelectorAll('.chapter-link').forEach((link) => link.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
}

function getFilteredVerses() {
  const selected =
    state.selectedChapter === 'all'
      ? state.chapters
      : state.chapters.filter((c) => c.id === state.selectedChapter);

  const normalizedQuery = state.query.trim().toLowerCase();
  const rows = [];

  for (const chapter of selected) {
    for (const verse of chapter.verses) {
      if (!normalizedQuery || verse.text.toLowerCase().includes(normalizedQuery)) {
        rows.push({
          chapterNumber: chapter.chapterNumber,
          chapterTitle: chapter.chapterTitle,
          verseNumber: verse.verseNumber,
          text: verse.text,
        });
      }
    }
  }

  return rows;
}

function render() {
  const rows = getFilteredVerses();
  resultsMeta.textContent = `${rows.length} verse${rows.length === 1 ? '' : 's'} found`;
  versesContainer.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'verse-text';
    empty.textContent = 'No verses match your search.';
    versesContainer.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const node = verseTemplate.content.cloneNode(true);
    node.querySelector('.verse-text').textContent = row.text;
    node.querySelector('.verse-meta').textContent = `${row.chapterTitle} · Verse ${row.verseNumber}`;
    const copyBtn = node.querySelector('.copy-btn');
    copyBtn.addEventListener('click', async () => {
      const payload = `${row.text} (${row.chapterTitle}, Verse ${row.verseNumber})`;
      await navigator.clipboard.writeText(payload);
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied';
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1200);
    });
    fragment.appendChild(node);
  }

  versesContainer.appendChild(fragment);
}

searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});

(async function init() {
  try {
    await loadChapters();
    buildChapterNav();
    render();
  } catch (error) {
    resultsMeta.textContent = 'Failed to load text files.';
    console.error(error);
  }
})();
