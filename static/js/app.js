/*
 * TeacherPromptBuilder — интерфейс и генератор промптов.
 * Данные: GET /api/prompts (Flask, data/prompts.json).
 * Без сторонних библиотек.
 */
(() => {
  'use strict';

  const API_URL = '/api/prompts';
  const PAGE_IDS = ['home', 'catalog', 'constructor', 'guide'];
  const COMMON_OPTIONS = {
    subject: ['Математика', 'Русский язык', 'Литература', 'Иностранный язык',
      'История', 'Обществознание', 'География', 'Биология', 'Физика', 'Химия', 'Информатика'],
    grade: Array.from({ length: 11 }, (_, index) => `${index + 1} класс`)
  };
  // Советы для самостоятельного составления запросов к ИИ.
  // Редактируйте этот массив, чтобы менять набор подсказок.
  const PROMPT_TIPS = [
    'Добавляйте контекст: укажите тему, класс, уровень подготовки и что ученики уже знают. Так ответ будет точнее.',
    'Сначала сформулируйте цель: что именно нужно получить — план урока, пять упражнений или критерии оценивания?',
    'Задавайте формат ответа: например, таблица с этапами, временем, действиями учителя и учеников.',
    'Указывайте ограничения: длительность занятия, доступные материалы и то, что нельзя использовать.',
    'Приводите небольшой пример желаемого результата, если вам важны стиль или структура ответа.',
    'Большую задачу удобно делить на части: сначала план, затем задания, после — критерии проверки.',
    'Если первый ответ не подошёл, уточните запрос: попросите упростить объяснение или добавить практику.',
    'Просите нейросеть разделять задания для учеников и ответы для учителя — так результат проще использовать.',
    'Указывайте целевую аудиторию: одно объяснение не будет одинаково полезно для 5-го и 10-го класса.',
    'Не ограничивайтесь фразой «сделай интересно». Напишите, что именно вам нужно: игра, обсуждение или работа в группах.',
    'Если тема сложная, попросите объяснить её по шагам и привести понятный пример, а затем задачу для тренировки.',
    'Проверяйте результат нейросети: даже подробный промпт не исключает ошибок в фактах и расчётах.'
  ];
  let previousTipIndex = -1;

  function showRandomPromptTip() {
    const tipElement = $('#random-prompt-tip');
    if (!tipElement || !PROMPT_TIPS.length) return;
    let index = Math.floor(Math.random() * PROMPT_TIPS.length);
    // При очередном открытии не показываем тот же совет подряд.
    if (PROMPT_TIPS.length > 1 && index === previousTipIndex) {
      index = (index + 1 + Math.floor(Math.random() * (PROMPT_TIPS.length - 1))) % PROMPT_TIPS.length;
    }
    previousTipIndex = index;
    tipElement.textContent = PROMPT_TIPS[index];
  }

  const EMPTY_VALUE = 'Не указано';
  const state = {
    prompts: [],
    selectedPrompt: null,
    mode: 'simple',
    category: 'all',
    search: '',
    generatedText: '',
    drafts: new Map(),
    loadError: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  let visiblePage = null;

  function decodeRoute() {
    // Поддерживаем #home, #catalog, #guide, #constructor/lesson-plan.
    const hash = window.location.hash.slice(1);
    const [page, ...idSegments] = hash.split('/');
    return {
      page: PAGE_IDS.includes(page) ? page : 'home',
      promptId: idSegments.join('/') || null
    };
  }

  function changePage(page, promptId = null) {
    const hash = page === 'constructor' && promptId
      ? `#constructor/${encodeURIComponent(promptId)}`
      : `#${page}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    applyRoute(true);
  }

  function applyRoute(animate = false) {
    const { page, promptId } = decodeRoute();
    if (page === 'constructor') {
      const id = promptId || state.selectedPrompt?.id;
      const item = state.prompts.find(prompt => encodeURIComponent(prompt.id) === id || prompt.id === id);
      if (!item) {
        if (!state.loadError && state.prompts.length) changePage('catalog');
        else showOnlyPage('catalog');
        return;
      }
      if (state.selectedPrompt?.id !== item.id) openPrompt(item);
    }
    showOnlyPage(page, animate);
  }

  function showOnlyPage(page, animate = false) {
    const screen = page === 'catalog' ? 'home' : page;
    const screenChanged = visiblePage !== screen;
    const section = document.getElementById(screen);
    for (const id of ['home', 'constructor', 'guide']) {
      document.getElementById(id).hidden = id !== screen;
    }
    visiblePage = screen;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = animate && !reduceMotion && !screenChanged ? 'smooth' : 'instant';
    if (page === 'catalog') {
      document.getElementById('catalog').scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior });
    }

    if (animate) {
      const heading = (page === 'catalog' ? document.getElementById('catalog') : section)
        .querySelector('h1, h2');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }

  async function loadPrompts() {
    const grid = $('#catalog-grid');
    if (grid) grid.replaceChildren(make('p', '', 'Загружаем конструкторы…'));
    try {
      const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.prompts)) {
        throw new Error('Неправильный формат каталога: отсутствует массив prompts');
      }
      state.prompts = data.prompts.filter(item =>
        item && typeof item.id === 'string' &&
        typeof item.title === 'string' && Array.isArray(item.fields) &&
        typeof item.template === 'string'
      );
      state.loadError = false;
      $('#catalog-error').hidden = true;
      drawFilters();
      drawCatalog();
      if (decodeRoute().page === 'constructor') applyRoute();
    } catch (error) {
      console.error('Не удалось загрузить конструкторы:', error);
      state.loadError = true;
      if (grid) grid.replaceChildren();
      const errorBox = $('#catalog-error');
      if (errorBox) errorBox.hidden = false;
      const emptyBox = $('#catalog-empty');
      if (emptyBox) emptyBox.hidden = true;
      if (decodeRoute().page === 'constructor') showOnlyPage('catalog');
    }
  }

  function drawFilters() {
    const container = $('#category-filters');
    if (!container) return;
    container.replaceChildren();
    const categories = ['all', ...new Set(state.prompts.map(item => item.category).filter(Boolean))];
    if (!categories.includes(state.category)) state.category = 'all';
    for (const category of categories) {
      const button = make('button', 'category-button', category === 'all' ? 'Все' : category);
      button.type = 'button';
      button.dataset.category = category;
      const active = category === state.category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      container.append(button);
    }
  }

  function drawCatalog() {
    const grid = $('#catalog-grid');
    if (!grid) return;
    grid.replaceChildren();
    const query = state.search.toLocaleLowerCase('ru').trim();
    const matches = state.prompts.filter(item => {
      const inCategory = state.category === 'all' || item.category === state.category;
      const corpus = [item.title, item.description, item.category, ...(item.tags || [])]
        .join(' ').toLocaleLowerCase('ru');
      return inCategory && corpus.includes(query);
    });
    for (const item of matches) {
      const button = make('button', 'catalog-card');
      button.type = 'button';
      button.dataset.prompt = item.id;
      button.setAttribute('aria-label', `Открыть конструктор «${item.title}»`);
      button.append(
        make('span', 'catalog-card-icon', item.icon || '✨'),
        make('span', 'section-label', item.category || 'Конструктор'),
        make('h3', '', item.title),
        make('p', '', item.description || ''),
        make('span', 'card-arrow', 'Открыть →')
      );
      grid.append(button);
    }
    $('#catalog-empty').hidden = matches.length !== 0 || state.loadError;
  }

  function getFormValues() {
    if (!state.selectedPrompt) return {};
    const values = { ...(state.drafts.get(state.selectedPrompt.id) || {}) };
    for (const field of state.selectedPrompt.fields) {
      const input = document.getElementById(`field-${field.id}`);
      if (input) values[field.id] = input.value;
    }
    return values;
  }

  function saveDraft() {
    if (state.selectedPrompt) state.drafts.set(state.selectedPrompt.id, getFormValues());
  }

  function openPrompt(item) {
    saveDraft();
    state.selectedPrompt = item;
    showRandomPromptTip();
    state.mode = 'simple';
    state.generatedText = '';
    setText('#constructor-title', item.title);
    setText('#constructor-description', item.description || 'Заполните параметры и получите запрос для нейросети.');
    setText('#constructor-category', item.category || 'Конструктор');
    setText('#copy-message', '');
    setMode('simple', false);
    buildForm();
  }

  function buildChoiceField(row, label, input, field) {
    const choices = COMMON_OPTIONS[field.id];
    const picker = make('select', 'form-control');
    picker.id = `${input.id}-choice`;
    label.htmlFor = picker.id;
    picker.required = input.required;
    picker.append(new Option('Выберите вариант', ''));
    for (const choice of choices) picker.append(new Option(choice, choice));
    const customOption = new Option('Свой вариант…', '');
    picker.append(customOption);

    const savedValue = input.value;
    const savedChoice = [...picker.options].find(option => option !== customOption && option.value === savedValue);
    if (savedChoice) savedChoice.selected = true;
    else customOption.selected = true;

    const customField = make('div', 'custom-field');
    const customLabel = make('label', 'form-label', `${field.label} — свой вариант`);
    customLabel.htmlFor = input.id;
    customField.append(customLabel, input);
    row.append(label, picker, customField);

    function syncChoice(focus = false) {
      const isCustom = picker.options[picker.selectedIndex] === customOption;
      customField.hidden = !isCustom;
      input.required = Boolean(field.required) && isCustom;
      // Служебное значение требуется только для проверки самого списка.
      customOption.value = isCustom ? 'custom' : '';
      if (!isCustom) input.value = picker.value;
      if (isCustom && focus) {
        input.value = '';
        input.focus();
      }
    }

    picker.addEventListener('input', () => syncChoice(true));
    syncChoice();
  }

  function buildForm() {
    const wrapper = $('#prompt-fields');
    if (!wrapper || !state.selectedPrompt) return;
    const values = state.drafts.get(state.selectedPrompt.id) || {};
    wrapper.replaceChildren();
    for (const field of state.selectedPrompt.fields) {
      if (field.advanced && state.mode !== 'advanced') continue;
      const row = make('div', 'form-group');
      const label = make('label', 'form-label', field.label || field.id);
      const id = `field-${field.id}`;
      label.htmlFor = id;
      if (field.required) {
        const required = make('span', '', ' *');
        required.style.color = '#a54a79';
        label.append(required);
      }

      const hasChoices = Object.hasOwn(COMMON_OPTIONS, field.id);
      let input;
      if (hasChoices) {
        input = make('input', 'form-control');
        input.type = 'text';
      } else if (field.type === 'textarea') {
        input = make('textarea', 'form-control');
        input.rows = 4;
      } else if (field.type === 'select') {
        input = make('select', 'form-control');
        if (!field.required && field.default === undefined) {
          const blank = make('option', '', 'Не указано');
          blank.value = '';
          input.append(blank);
        }
        for (const option of field.options || []) {
          const value = typeof option === 'object' ? option.value : option;
          const text = typeof option === 'object' ? option.label : option;
          const element = make('option', '', String(text));
          element.value = String(value);
          input.append(element);
        }
      } else {
        input = make('input', 'form-control');
        input.type = field.type === 'number' ? 'number' : 'text';
      }
      input.id = id;
      input.name = field.id;
      if (field.placeholder && field.type !== 'select') input.placeholder = field.placeholder;
      if (field.type === 'number') {
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        input.step = '1';
      }
      input.required = Boolean(field.required);
      input.value = Object.hasOwn(values, field.id)
        ? values[field.id]
        : (field.default !== undefined ? String(field.default) : '');
      if (hasChoices) {
        buildChoiceField(row, label, input, field);
      } else {
        row.append(label, input);
      }
      wrapper.append(row);
    }
    updatePreview();
  }

  function setMode(mode, rebuild = true) {
    if (rebuild) saveDraft();
    state.mode = mode;
    for (const name of ['simple', 'advanced']) {
      const button = $(`#${name}-mode`);
      if (!button) continue;
      const active = mode === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    if (rebuild) buildForm();
  }

  function buildPrompt(values) {
    if (!state.selectedPrompt) return '';
    // В простом режиме скрытые расширенные поля тоже подставляются:
    // используются сохранённые значения или заданные в JSON значения по умолчанию.
    const draft = state.drafts.get(state.selectedPrompt.id) || {};
    const substitutions = {};
    for (const field of state.selectedPrompt.fields) {
      const value = Object.hasOwn(values, field.id) ? values[field.id] : draft[field.id];
      const fallback = field.default !== undefined ? field.default : EMPTY_VALUE;
      const finalValue = value === undefined || String(value).trim() === ''
        ? (field.required ? '' : fallback)
        : String(value).trim();
      substitutions[field.id] = String(finalValue);
    }
    return state.selectedPrompt.template.replace(/\{([a-zA-Z_][\w]*)\}/g,
      (match, key) => Object.hasOwn(substitutions, key) ? substitutions[key] : match);
  }

  function updatePreview() {
    const result = $('#prompt-result');
    const copy = $('#copy-prompt');
    if (!result || !state.selectedPrompt) return;
    const values = getFormValues();
    // Не выдаём за полноценный результат промпт с незаполненными обязательными полями.
    const allRequired = state.selectedPrompt.fields
      .filter(field => field.required)
      .every(field => {
        const val = values[field.id] ?? state.drafts.get(state.selectedPrompt.id)?.[field.id];
        return String(val ?? '').trim() !== '';
      });
    const activeForm = $('#prompt-form');
    const validFields = activeForm ? activeForm.checkValidity() : false;
    if (!allRequired || !validFields) {
      state.generatedText = '';
      result.textContent = 'Проверьте обязательные поля и допустимые значения, чтобы получить промпт.';
      copy.disabled = true;
      return;
    }
    state.generatedText = buildPrompt(values);
    result.textContent = state.generatedText;
    copy.disabled = false;
  }

  async function copyPrompt() {
    if (!state.generatedText) return;
    const button = $('#copy-prompt');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(state.generatedText);
      } else {
        // Резервный способ для некоторых локальных HTTP-окружений.
        const textarea = make('textarea');
        textarea.value = state.generatedText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.append(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        textarea.remove();
        if (!ok) throw new Error('Команда копирования не поддерживается');
      }
      setText('#copy-message', '✓ Промпт скопирован! Можно вставить его в нейросеть.');
      if (button) button.textContent = '✓ Скопировано';
      window.setTimeout(() => {
        if (button) button.textContent = '📋 Скопировать промпт';
      }, 1800);
    } catch (error) {
      console.error('Ошибка копирования:', error);
      setText('#copy-message', 'Не удалось скопировать автоматически. Выделите текст промпта и скопируйте его вручную.');
    }
  }

  function attachEvents() {
    // Делегирование: работает и для карточек, которые JS добавит позже.
    document.addEventListener('click', event => {
      const promptButton = event.target.closest('[data-prompt]');
      if (promptButton) {
        event.preventDefault();
        const item = state.prompts.find(prompt => prompt.id === promptButton.dataset.prompt);
        if (item) changePage('constructor', item.id);
        else changePage('catalog');
        return;
      }
      const navButton = event.target.closest('[data-page]');
      if (navButton) {
        event.preventDefault();
        changePage(navButton.dataset.page);
        return;
      }
      const categoryButton = event.target.closest('[data-category]');
      if (categoryButton) {
        state.category = categoryButton.dataset.category;
        drawFilters();
        drawCatalog();
      }
    });

    $('#catalog-search')?.addEventListener('input', event => {
      state.search = event.target.value;
      drawCatalog();
    });
    $('#simple-mode')?.addEventListener('click', () => setMode('simple'));
    $('#advanced-mode')?.addEventListener('click', () => setMode('advanced'));

    $('#prompt-form')?.addEventListener('input', () => {
      saveDraft();
      updatePreview();
      setText('#copy-message', '');
    });
    $('#prompt-form')?.addEventListener('change', () => {
      saveDraft();
      updatePreview();
    });
    $('#prompt-form')?.addEventListener('submit', event => {
      event.preventDefault();
      saveDraft();
      updatePreview();
      if (state.generatedText) $('#prompt-result')?.scrollIntoView({ block: 'nearest' });
    });
    $('#prompt-form')?.addEventListener('reset', event => {
      event.preventDefault();
      if (!state.selectedPrompt) return;
      state.drafts.delete(state.selectedPrompt.id);
      buildForm();
      setText('#copy-message', 'Настройки сброшены.');
    });
    $('#copy-prompt')?.addEventListener('click', copyPrompt);
    window.addEventListener('popstate', () => applyRoute(true));
  }

  function init() {
    attachEvents();
    applyRoute();
    loadPrompts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
