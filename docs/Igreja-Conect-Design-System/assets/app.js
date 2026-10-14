(() => {
  const THEME_KEY = 'igreja-conect:theme';
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const validThemes = new Set(['claro', 'escuro', 'sistema']);
  const readTheme = () => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return validThemes.has(stored) ? stored : 'claro';
    } catch (_) { return 'claro'; }
  };
  const resolveTheme = choice => choice === 'sistema' ? (media?.matches ? 'escuro' : 'claro') : choice;
  const applyTheme = (choice = readTheme(), persist = false) => {
    const selected = validThemes.has(choice) ? choice : 'claro';
    const resolved = resolveTheme(selected);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeChoice = selected;
    document.documentElement.style.colorScheme = resolved === 'escuro' ? 'dark' : 'light';
    if (persist) {
      try { localStorage.setItem(THEME_KEY, selected); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('igreja-conect:theme-change', { detail: { choice: selected, theme: resolved } }));
    return selected;
  };
  window.IgrejaTheme = { getChoice: readTheme, set: choice => applyTheme(choice, true), apply: applyTheme };
  applyTheme();
  media?.addEventListener?.('change', () => { if (readTheme() === 'sistema') applyTheme('sistema'); });
  window.addEventListener('storage', event => {
    if (event.key === THEME_KEY) applyTheme(readTheme());
  });
})();
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const SIDEBAR_KEY = 'igreja-conect:sidebar-collapsed';
  const setSidebarState = collapsed => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    $$('.js-sidebar-toggle').forEach(button => {
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    });
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch (_) {}
  };
  try { setSidebarState(localStorage.getItem(SIDEBAR_KEY) === 'true'); } catch (_) { setSidebarState(false); }

  function showToast(title = 'Tudo certo', message = 'A ação foi concluída.') {
    let toast = $('#global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.className = 'toast is-hidden';
      toast.innerHTML = '<span class="icon-wrap"><svg class="icon"><use href="assets/icons.svg#check"></use></svg></span><div><strong></strong><p></p></div>';
      document.body.appendChild(toast);
    }
    $('strong', toast).textContent = title;
    $('p', toast).textContent = message;
    toast.classList.remove('is-hidden');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toast.classList.add('is-hidden'), 3600);
  }
  window.showToast = showToast;

  $$('.dropdown-toggle').forEach(toggle => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const dropdown = toggle.closest('.dropdown');
      const willOpen = !dropdown.classList.contains('open');
      $$('.dropdown.open').forEach(item => {
        item.classList.remove('open');
        $('.dropdown-toggle', item)?.setAttribute('aria-expanded', 'false');
      });
      dropdown.classList.toggle('open', willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
    });
  });
  document.addEventListener('click', () => $$('.dropdown.open').forEach(item => {
    item.classList.remove('open');
    $('.dropdown-toggle', item)?.setAttribute('aria-expanded', 'false');
  }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    $$('.dropdown.open').forEach(item => {
      item.classList.remove('open');
      $('.dropdown-toggle', item)?.setAttribute('aria-expanded', 'false');
    });
  });

  $$('.password-toggle').forEach(button => button.addEventListener('click', () => {
    const input = button.closest('.input-group')?.querySelector('input');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.setAttribute('aria-label', input.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
  }));

  $$('.js-form').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const required = $$('[required]', form);
    const invalid = required.find(input => input.type === 'checkbox' ? !input.checked : !String(input.value || '').trim());
    if (invalid) {
      invalid.focus();
      showToast('Revise o formulário', 'Preencha os campos obrigatórios para continuar.');
      return;
    }
    showToast('Alterações salvas', 'A informação foi registrada com segurança.');
  }));

  $$('.js-tabs').forEach(tabset => {
    const tabs = $$('.tab', tabset);
    const panels = $$('.tab-panel', tabset.parentElement);
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(item => item.classList.toggle('active', item === tab));
      panels.forEach(panel => panel.hidden = panel.dataset.tab !== tab.dataset.tab);
    }));
  });

  $$('.js-view-toggle').forEach(toggle => {
    const target = document.getElementById(toggle.dataset.target);
    $$('.view-option', toggle).forEach(button => button.addEventListener('click', () => {
      $$('.view-option', toggle).forEach(item => item.classList.toggle('active', item === button));
      if (target) target.dataset.view = button.dataset.view;
    }));
  });

  $$('.js-filter-clear').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    const form = button.closest('.filter-bar');
    $$('input, select', form).forEach(input => input.value = '');
    showToast('Filtros limpos', 'A lista voltou a mostrar todos os registros.');
  }));

  $$('.js-sidebar-toggle').forEach(button => button.addEventListener('click', () => {
    setSidebarState(!document.body.classList.contains('sidebar-collapsed'));
  }));

  $$('.js-demo').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    showToast('Demonstração solicitada', 'A liderança da sua igreja poderá agendar o próximo passo.');
  }));
  $$('.js-invite').forEach(button => button.addEventListener('click', () => showToast('Convite enviado', 'O acesso foi encaminhado para o endereço informado.')));
  $$('.js-follow-up').forEach(button => button.addEventListener('click', () => showToast('Acompanhamento registrado', 'A próxima ação foi adicionada ao histórico do visitante.')));
  $$('.js-export').forEach(button => button.addEventListener('click', () => showToast('Exportação preparada', 'O arquivo CSV está pronto para ser baixado.')));
  $$('.notification').forEach(button => button.addEventListener('click', () => showToast('Notificações', 'Você tem 3 alertas para revisar.')));
  $$('.topbar .search .input').forEach(input => input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = input.value.trim();
    showToast(query ? 'Busca preparada' : 'Busca global', query ? `Resultados para “${query}” aparecerão aqui.` : 'Digite um nome, lançamento ou item para começar.');
  }));
  $$('.public-footer a[href$="#privacidade"], .public-footer a[href$="#termos"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    showToast(link.getAttribute('href').endsWith('privacidade') ? 'Privacidade' : 'Termos de uso', 'Este conteúdo institucional será disponibilizado na versão pública.');
  }));
  $$('.js-cancel').forEach(button => button.addEventListener('click', () => history.back()));

  $$('.js-radio-card input').forEach(input => input.addEventListener('change', () => {
    $$('.js-radio-card').forEach(card => card.classList.toggle('is-selected', $('input', card)?.checked));
  }));

  $$('.js-file-input').forEach(input => input.addEventListener('change', () => {
    const zone = input.closest('.upload-zone');
    const name = input.files?.[0]?.name;
    if (zone && name) $('.upload-label', zone).textContent = name;
  }));

  $$('.nav-link').forEach(link => {
    link.addEventListener('click', () => $$('.nav-link.active').forEach(item => item.classList.remove('active')));
  });
  const accountabilityButton = $('[data-od-id="accountability-pdf"]');
  const printableReport = $('[data-od-id="accountability-print"]');
  if (accountabilityButton && printableReport) {
    const formatDate = value => {
      if (!value) return 'Período selecionado';
      const [year, month, day] = value.split('-').map(Number);
      if (!year || !month || !day) return value;
      return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
    };
    const updatePrintValue = (key, value) => {
      $$(`[data-print-value="${key}"], [data-print-table="${key}"]`, printableReport).forEach(node => { node.textContent = value; });
    };
    accountabilityButton.addEventListener('click', () => {
      const from = $('#report-from')?.value;
      const to = $('#report-to')?.value;
      const cash = $('#report-cash')?.value || 'Todos os caixas';
      const period = from && to ? `${formatDate(from)} a ${formatDate(to)}` : 'Período selecionado';
      $('[data-print-period]', printableReport).textContent = period;
      $('[data-print-cash]', printableReport).textContent = cash;
      $('[data-print-generated]', printableReport).textContent = new Intl.DateTimeFormat('pt-BR').format(new Date());
      ['entradas', 'saidas', 'resultado', 'lancamentos'].forEach(key => {
        const source = $(`[data-print-value="${key}"]`, printableReport);
        if (source) updatePrintValue(key, source.textContent);
      });
      showToast('Preparando PDF', 'Na janela de impressão, escolha “Salvar como PDF”.');
      window.requestAnimationFrame(() => window.print());
    });
  }

  const movementModal = $('[data-od-id="movement-modal"]');
  const movementForm = $('[data-movement-form]');
  if (movementModal && movementForm) {
    const typeInputs = $$('[name="movement-type"]', movementForm);
    const itemSelect = $('[name="movement-item"]', movementForm);
    const quantityInput = $('[name="movement-quantity"]', movementForm);
    const reasonInput = $('[name="movement-reason"]', movementForm);
    const dateInput = $('[name="movement-date"]', movementForm);
    const modalTitle = $('[data-movement-title]', movementModal);
    const modalDescription = $('[data-movement-description]', movementModal);
    const submitButton = $('[data-movement-submit]', movementModal);
    const unitLabel = $('[data-movement-unit]', movementModal);
    const currentBalance = $('[data-movement-current]', movementModal);
    const projectedBalance = $('[data-movement-projected]', movementModal);
    const validation = $('[data-movement-validation]', movementModal);
    const stockData = {
      'Papel A4 75g': { current: 18, unit: 'pac.', code: 'ESC-0001' },
      'Copos descartáveis 200 ml': { current: 48, unit: 'un.', code: 'CAN-0018' },
      'Papel toalha': { current: 12, unit: 'un.', code: 'HIG-0007' },
      'Água mineral 500 ml': { current: 240, unit: 'un.', code: 'CUL-0021' },
      'Cartucho preto': { current: 1, unit: 'un.', code: 'ESC-0012' },
      'Guardanapos': { current: 320, unit: 'un.', code: 'CAN-0004' }
    };
    let activeType = 'entrada';

    const getSelectedItem = () => stockData[itemSelect?.value] || { current: 0, unit: 'un.', code: '' };
    const getQuantity = () => Math.max(0, Number(quantityInput?.value || 0));
    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const closeMovement = () => {
      movementModal.hidden = true;
      movementModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      movementForm.reset();
      activeType = 'entrada';
      if (dateInput) dateInput.value = '';
    };
    const paintMovement = () => {
      const item = getSelectedItem();
      const quantity = getQuantity();
      const isExit = activeType === 'saida';
      const projected = isExit ? item.current - quantity : item.current + quantity;
      if (modalTitle) modalTitle.textContent = isExit ? 'Registrar saída' : 'Registrar entrada';
      if (modalDescription) modalDescription.textContent = isExit ? 'Informe o uso ou destino do material retirado.' : 'Registre a quantidade recebida e a origem do material.';
      if (submitButton) submitButton.innerHTML = `<svg class="icon icon-sm"><use href="assets/icons.svg#${isExit ? 'download' : 'upload'}"></use></svg>${isExit ? 'Confirmar saída' : 'Confirmar entrada'}`;
      if (unitLabel) unitLabel.textContent = item.unit;
      if (currentBalance) currentBalance.textContent = `${item.current} ${item.unit}`;
      if (projectedBalance) projectedBalance.textContent = `${Math.max(0, projected)} ${item.unit}`;
      if (validation) validation.textContent = isExit && quantity > item.current ? `A saída não pode ser maior que o saldo atual de ${item.current} ${item.unit}.` : '';
      if (quantityInput) quantityInput.setAttribute('aria-invalid', isExit && quantity > item.current ? 'true' : 'false');
      if (submitButton) submitButton.disabled = !quantity || (isExit && quantity > item.current) || !reasonInput?.value.trim() || !dateInput?.value;
    };
    const openMovement = (type = 'entrada', itemName = '') => {
      activeType = type === 'saida' ? 'saida' : 'entrada';
      if (itemName && stockData[itemName] && itemSelect) itemSelect.value = itemName;
      typeInputs.forEach(input => { input.checked = input.value === activeType; });
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
      movementModal.hidden = false;
      movementModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      paintMovement();
      window.setTimeout(() => (quantityInput || itemSelect)?.focus(), 40);
    };
    $$('[data-movement-open]').forEach(button => button.addEventListener('click', () => openMovement(button.dataset.movementType, button.dataset.movementItem)));
    $$('[data-movement-close]', movementModal).forEach(button => button.addEventListener('click', closeMovement));
    movementModal.addEventListener('click', event => { if (event.target === movementModal) closeMovement(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !movementModal.hidden) closeMovement(); });
    typeInputs.forEach(input => input.addEventListener('change', () => { activeType = input.value; paintMovement(); }));
    [itemSelect, quantityInput, reasonInput, dateInput].forEach(input => input?.addEventListener('input', paintMovement));
    itemSelect?.addEventListener('change', paintMovement);
    movementForm.addEventListener('submit', event => {
      event.preventDefault();
      const itemName = itemSelect?.value;
      const item = getSelectedItem();
      const quantity = getQuantity();
      const isExit = activeType === 'saida';
      if (!itemName || !quantity || !reasonInput?.value.trim() || !dateInput?.value || (isExit && quantity > item.current)) { paintMovement(); return; }
      const signed = isExit ? -quantity : quantity;
      item.current += signed;
      $$(`[data-stock-current="${itemName}"]`).forEach(node => { node.textContent = item.current; });
      const status = item.current <= 0 ? 'Crítico' : item.current < 10 ? 'Baixo' : 'Normal';
      $$(`[data-stock-status="${itemName}"]`).forEach(node => { node.textContent = status; node.className = `badge ${status === 'Normal' ? 'badge-success' : status === 'Baixo' ? 'badge-warning' : 'badge-danger'}`; });
      $$('[data-movement-live-list]').forEach(list => {
        const row = document.createElement('tr');
        const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${dateInput.value}T12:00:00`)).replace('.', '');
        const safeItemName = escapeHtml(itemName);
        const safeReason = escapeHtml(reasonInput.value.trim());
        row.innerHTML = list.dataset.movementLiveList === 'item' ? `<td>${date} · agora</td><td><span class="badge ${isExit ? 'badge-warning' : 'badge-success'}">${isExit ? 'Saída' : 'Entrada'}</span></td><td class="${isExit ? 'amount-out' : 'amount-in'} mono">${isExit ? '−' : '+'} ${quantity} ${item.unit}</td><td>${safeReason}</td><td>Marcos Costa</td>` : `<td>${date} · agora</td><td><strong>${safeItemName}</strong></td><td><span class="badge ${isExit ? 'badge-warning' : 'badge-success'}">${isExit ? 'Saída' : 'Entrada'}</span></td><td class="${isExit ? 'amount-out' : 'amount-in'} mono">${isExit ? '−' : '+'} ${quantity} ${item.unit}</td><td>${safeReason}</td><td>Marcos Costa</td><td>Registro manual</td>`;
        list.prepend(row);
      });
      closeMovement();
      showToast(isExit ? 'Saída registrada' : 'Entrada registrada', `${quantity} ${item.unit} de ${itemName} foram ${isExit ? 'retirados' : 'adicionados'} ao estoque.`);
      movementForm.reset();
      activeType = 'entrada';
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    });
    $$('[data-movement-current-display]').forEach(node => node.textContent = getSelectedItem().current);
    paintMovement();
  }

  const scheduleForms = $$('.js-schedule-form');
  scheduleForms.forEach(form => {
    const list = $('[data-assignment-list]', form);
    const error = $('[data-schedule-error]', form);
    const dateInput = $('[name="date"]', form);
    const startInput = $('[name="start"]', form);
    const endInput = $('[name="end"]', form);
    const serviceInput = $('[name="service"]', form);
    const ministryInput = $('[name="ministry"]', form);
    const locationInput = $('[name="location"]', form);
    const summary = form.parentElement.querySelector('[data-schedule-summary]') || document.querySelector('[data-schedule-summary]');
    const summaryService = summary && $('[data-schedule-summary-service]', summary);
    const summaryDate = summary && $('[data-schedule-summary-date]', summary);
    const summaryTime = summary && $('[data-schedule-summary-time]', summary);
    const summaryLocation = summary && $('[data-schedule-summary-location]', summary);
    const summaryMinistry = summary && $('[data-schedule-summary-ministry]', summary);
    const summaryCount = summary && $('[data-schedule-summary-count]', summary);
    const summaryProgress = summary && $('[data-schedule-summary-progress]', summary);
    const formatDate = value => {
      if (!value) return 'Escolha uma data';
      const [year, month, day] = value.split('-').map(Number);
      if (!year || !month || !day) return 'Escolha uma data';
      return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
    };
    const formatTime = value => value ? `${value.slice(0, 2)}h${value.slice(3)}` : '—';
    const getRows = () => $$('[data-assignment-row]', list);
    const paintSummary = () => {
      const rows = getRows();
      if (summaryService) summaryService.textContent = serviceInput?.value || 'Nova atividade';
      if (summaryDate) summaryDate.textContent = formatDate(dateInput?.value);
      if (summaryTime) summaryTime.textContent = `${formatTime(startInput?.value)} às ${formatTime(endInput?.value)}`;
      if (summaryLocation) summaryLocation.textContent = locationInput?.value || 'Local a definir';
      if (summaryMinistry) summaryMinistry.textContent = ministryInput?.value || 'Ministério não definido';
      if (summaryCount) summaryCount.textContent = `${rows.length} ${rows.length === 1 ? 'pessoa' : 'pessoas'}`;
      if (summaryProgress) summaryProgress.style.width = `${Math.min(100, rows.length / 4 * 100)}%`;
    };
    const clearError = () => { if (error) error.textContent = ''; };
    const bindRow = row => {
      $('[data-assignment-remove]', row)?.addEventListener('click', () => {
        if (getRows().length <= 1) {
          if (error) error.textContent = 'A escala precisa ter pelo menos uma pessoa.';
          return;
        }
        row.remove();
        clearError();
        paintSummary();
      });
      $$('select', row).forEach(input => input.addEventListener('change', () => { clearError(); paintSummary(); }));
    };
    getRows().forEach(bindRow);
    $('[data-assignment-add]', form)?.addEventListener('click', () => {
      const source = getRows()[0];
      if (!source) return;
      const row = source.cloneNode(true);
      $$('select', row).forEach(select => { select.selectedIndex = 0; });
      list.appendChild(row);
      bindRow(row);
      clearError();
      paintSummary();
      $('select[name="member"]', row)?.focus();
    });
    [dateInput, startInput, endInput, serviceInput, ministryInput, locationInput].forEach(input => input?.addEventListener('input', paintSummary));
    [dateInput, startInput, endInput, serviceInput, ministryInput, locationInput].forEach(input => input?.addEventListener('change', paintSummary));
    form.addEventListener('submit', event => {
      event.preventDefault();
      clearError();
      if (!form.reportValidity()) return;
      const rows = getRows();
      const members = rows.map(row => $('select[name="member"]', row)?.value).filter(Boolean);
      const hasDuplicate = members.some((member, index) => members.indexOf(member) !== index);
      if (!rows.length) {
        if (error) error.textContent = 'Adicione pelo menos uma pessoa à escala.';
        showToast('Equipe incompleta', 'Adicione uma pessoa antes de salvar a escala.');
        return;
      }
      if (hasDuplicate) {
        if (error) error.textContent = 'Uma pessoa aparece mais de uma vez. Escolha voluntários diferentes.';
        showToast('Revise a equipe', 'Cada pessoa deve ocupar apenas uma função nesta escala.');
        return;
      }
      if (startInput?.value && endInput?.value && endInput.value <= startInput.value) {
        if (error) error.textContent = 'O término precisa ser depois do horário de início.';
        showToast('Revise o horário', 'A escala precisa terminar depois de começar.');
        endInput.focus();
        return;
      }
      const isEdit = form.dataset.scheduleMode === 'edit';
      showToast(isEdit ? 'Escala atualizada' : 'Escala criada', isEdit ? 'A equipe foi avisada sobre as alterações.' : 'A escala foi salva e os convites foram preparados.');
      form.querySelector('[type="submit"]')?.setAttribute('disabled', 'disabled');
      window.setTimeout(() => { window.location.href = form.dataset.scheduleRedirect || 'ministerio-detalhe.html#escalas'; }, 650);
    });
    paintSummary();
  });

  const escapeAvailabilityText = value => String(value).replace(/[&<>\"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  const drawForm = $('[data-od-id="draw-config-form"]');
  if (drawForm) {
    const roles = $$('[type="checkbox"]', $('[data-od-id="draw-config-card"]')).filter(input => input.closest('.draw-role'));
    const results = $('[data-draw-results]');
    const resultStatus = $('[data-draw-result-status]');
    const resultMeta = $('[data-draw-result-meta]');
    const resultFooter = $('[data-draw-footer]');
    const error = $('[data-draw-error]');
    const roster = {
      'Direção musical': [{ name: 'Rafael Lima', initials: 'RL', tone: 'success', days: [0, 3], from: '14:00', until: '22:00', last: 1 }],
      'Teclado': [{ name: 'Marcos Costa', initials: 'MC', tone: '', days: [0, 3], from: '16:00', until: '22:00', last: 2 }],
      'Voz': [{ name: 'Juliana Prado', initials: 'JP', tone: 'warning', days: [0], from: '16:00', until: '21:00', last: 4 }],
      'Guitarra': [{ name: 'Felipe Nunes', initials: 'FN', tone: 'info', days: [3], from: '19:00', until: '22:00', last: 3 }],
      'Baixo': [],
      'Bateria': []
    };
    const blocked = [{ name: 'Juliana Prado', date: '2026-10-04' }, { name: 'Marcos Costa', date: '2026-10-12' }];
    const avatarClass = person => person.tone ? ` style="color:var(--${person.tone});background:var(--${person.tone}-soft)"` : '';
    const safe = value => String(value).replace(/[&<>\"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const clearDrawError = () => { if (error) error.textContent = ''; };
    const paintRoleState = () => roles.forEach(input => input.closest('.draw-role')?.classList.toggle('is-selected', input.checked));
    const confirmationState = new Map();
    const memberSlug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const assignedRows = () => $$('[data-suggestion-row]', results).filter(row => row.dataset.suggestionMember);
    const renderConfirmation = row => {
      const member = row.dataset.suggestionMember;
      const state = confirmationState.get(member) || 'pending';
      const status = $('[data-suggestion-status]', row);
      const confirmButton = $('[data-suggestion-action="confirm"]', row);
      const declineButton = $('[data-suggestion-action="decline"]', row);
      const resetButton = $('[data-suggestion-action="reset"]', row);
      const statusMap = {
        pending: { className: 'suggestion-check suggestion-pending', icon: 'clock', label: 'Aguardando resposta' },
        confirmed: { className: 'suggestion-check suggestion-confirmed', icon: 'check', label: 'Confirmado' },
        declined: { className: 'suggestion-check suggestion-declined', icon: 'alert-triangle', label: 'Solicitou troca' }
      };
      const copy = statusMap[state];
      if (status) { status.className = copy.className; status.innerHTML = `<svg class="icon"><use href="assets/icons.svg#${copy.icon}"></use></svg>${copy.label}`; }
      if (confirmButton) confirmButton.hidden = state !== 'pending';
      if (declineButton) declineButton.hidden = state !== 'pending';
      if (resetButton) resetButton.hidden = state === 'pending';
      row.dataset.confirmation = state;
      row.classList.toggle('is-confirmed', state === 'confirmed');
      row.classList.toggle('is-declined', state === 'declined');
    };
    const updateConfirmationSummary = () => {
      const rows = assignedRows();
      const total = rows.length;
      const confirmed = rows.filter(row => row.dataset.confirmation === 'confirmed').length;
      const declined = rows.filter(row => row.dataset.confirmation === 'declined').length;
      const pending = total - confirmed - declined;
      const summary = $('[data-confirmation-summary]');
      const footerMessage = $('[data-confirmation-footer-message]');
      const footerIcon = $('[data-confirmation-footer-icon]');
      const hasOpenSlot = Boolean($('.suggestion-open', results));
      if (summary) summary.hidden = total === 0;
      $('[data-confirmation-count]')?.replaceChildren(document.createTextNode(String(confirmed)));
      $('[data-confirmation-total]')?.replaceChildren(document.createTextNode(String(total)));
      $('[data-confirmation-pending]')?.replaceChildren(document.createTextNode(`${pending} ${pending === 1 ? 'pendente' : 'pendentes'}`));
      const meta = $('[data-confirmation-meta]');
      if (meta) meta.textContent = declined ? `${declined} pessoa(s) sinalizaram necessidade de troca.` : pending ? 'A liderança pode acompanhar cada resposta antes de publicar.' : 'Toda a equipe atribuída respondeu à sugestão.';
      const progress = $('[data-confirmation-progress]');
      if (progress) progress.style.width = `${total ? confirmed / total * 100 : 0}%`;
      if (resultStatus && total) {
        resultStatus.textContent = hasOpenSlot ? 'Revisar vagas' : declined ? 'Ajustes solicitados' : confirmed === total ? 'Pronta para publicar' : 'Confirmações pendentes';
        resultStatus.className = `badge ${hasOpenSlot || declined ? 'badge-warning' : confirmed === total ? 'badge-success' : 'badge-neutral'}`;
      }
      if (footerMessage && total) {
        footerMessage.innerHTML = `<svg class="icon icon-sm" data-confirmation-footer-icon><use href="assets/icons.svg#${confirmed === total && !declined ? 'check' : declined ? 'alert-triangle' : 'clock'}"></use></svg>${declined ? 'Revise as solicitações de troca antes de publicar.' : confirmed === total ? 'Todos os membros confirmaram esta sugestão.' : 'Aguardando confirmações individuais.'}`;
      }
    };
    const bindConfirmation = row => {
      $$('[data-suggestion-action]', row).forEach(button => button.addEventListener('click', () => {
        const member = row.dataset.suggestionMember;
        const action = button.dataset.suggestionAction;
        const nextState = action === 'confirm' ? 'confirmed' : action === 'decline' ? 'declined' : 'pending';
        confirmationState.set(member, nextState);
        renderConfirmation(row);
        updateConfirmationSummary();
        const messages = { confirmed: ['Confirmação registrada', `${member} foi marcado(a) como confirmado(a) nesta sugestão.`], declined: ['Troca solicitada', `${member} sinalizou que precisa de uma nova opção.`], pending: ['Resposta reaberta', `${member} voltou para o status pendente.`] };
        showToast(messages[nextState][0], messages[nextState][1]);
      }));
    };
    const isWithin = (person, date, start, end, useAvailability) => {
      if (!useAvailability) return true;
      const dateObject = new Date(`${date}T12:00:00`);
      const blockedOnDate = blocked.some(item => item.name === person.name && item.date === date);
      return person.days.includes(dateObject.getDay()) && !blockedOnDate && start >= person.from && end <= person.until;
    };
    const draw = () => {
      const date = $('#draw-date')?.value;
      const start = $('#draw-start')?.value || '';
      const end = $('#draw-end')?.value || '';
      const useAvailability = $('[data-draw-rule="availability"]')?.checked !== false;
      const useRotation = $('[data-draw-rule="rotation"]')?.checked !== false;
      const selectedRoles = roles.filter(input => input.checked).map(input => input.value);
      const chosen = new Set();
      let complete = true;
      if (!results) return;
      confirmationState.clear();
      results.innerHTML = selectedRoles.map(role => {
        const candidates = (roster[role] || []).filter(person => !chosen.has(person.name) && isWithin(person, date, start, end, useAvailability)).sort((a, b) => useRotation ? a.last - b.last : 0);
        const person = candidates[0];
        if (!person) {
          complete = false;
          return `<div class="suggestion-row" data-suggestion-row data-suggestion-role="${safe(role)}"><div class="suggestion-person"><span class="avatar avatar-32">?</span><div><strong>Nenhuma pessoa encontrada</strong><span>Revise a disponibilidade ou escolha outra função</span></div></div><span class="suggestion-role">${safe(role)}</span><div class="suggestion-status-area"><span class="suggestion-check suggestion-open"><svg class="icon"><use href="assets/icons.svg#alert-triangle"></use></svg>Vaga aberta</span></div></div>`;
        }
        chosen.add(person.name);
        const slug = memberSlug(person.name);
        return `<div class="suggestion-row" data-suggestion-row data-suggestion-member="${safe(person.name)}" data-suggestion-role="${safe(role)}" data-confirmation="pending"><div class="suggestion-person"><span class="avatar avatar-32"${avatarClass(person)}>${safe(person.initials)}</span><div><strong>${safe(person.name)}</strong><span>Disponível para este horário</span></div></div><span class="suggestion-role">${safe(role)}</span><div class="suggestion-status-area"><span class="suggestion-check suggestion-pending" data-suggestion-status aria-live="polite"><svg class="icon"><use href="assets/icons.svg#clock"></use></svg>Aguardando resposta</span><div class="suggestion-confirm-actions" data-suggestion-actions role="group" aria-label="Confirmação de ${safe(person.name)}"><button class="btn btn-secondary btn-sm" type="button" data-suggestion-action="confirm" data-od-id="confirm-${slug}">Confirmar</button><button class="btn btn-ghost btn-sm" type="button" data-suggestion-action="decline" data-od-id="request-change-${slug}">Solicitar troca</button><button class="btn btn-ghost btn-sm" type="button" data-suggestion-action="reset" data-od-id="reopen-${slug}" hidden>Reabrir</button></div></div></div>`;
      }).join('');
      $$('[data-suggestion-row]', results).forEach(row => { if (row.dataset.suggestionMember) { renderConfirmation(row); bindConfirmation(row); } });
      if (resultStatus) { resultStatus.textContent = complete ? 'Sugestão pronta' : 'Revisar vagas'; resultStatus.className = `badge ${complete ? 'badge-success' : 'badge-warning'}`; }
      if (resultMeta) resultMeta.textContent = `${selectedRoles.length} função(ões) analisada(s) para ${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))}.`;
      if (resultFooter) resultFooter.hidden = false;
      updateConfirmationSummary();
    };
    roles.forEach(input => input.addEventListener('change', () => { paintRoleState(); clearDrawError(); }));
    drawForm.addEventListener('submit', event => {
      event.preventDefault();
      clearDrawError();
      if (!drawForm.reportValidity()) return;
      const selectedRoles = roles.filter(input => input.checked);
      if (!selectedRoles.length) {
        if (error) error.textContent = 'Selecione ao menos uma função para sortear.';
        showToast('Escolha uma função', 'Marque as vagas que precisam ser preenchidas.');
        return;
      }
      if ($('#draw-end')?.value <= $('#draw-start')?.value) {
        if (error) error.textContent = 'O término precisa ser depois do início.';
        showToast('Revise o horário', 'O evento precisa terminar depois de começar.');
        return;
      }
      draw();
      showToast('Sugestão gerada', 'Os conflitos de horário e as indisponibilidades foram considerados.');
    });
    $('[data-od-id="draw-use-suggestion"]')?.addEventListener('click', () => showToast('Sugestão pronta para uso', 'A nova escala será aberta com as funções selecionadas.'));
    $('[data-confirmation-notify]')?.addEventListener('click', () => {
      const pending = assignedRows().filter(row => row.dataset.confirmation === 'pending').length;
      if (!pending) { showToast('Tudo confirmado', 'Não há membros pendentes para notificar.'); return; }
      showToast('Lembretes enviados', `${pending} ${pending === 1 ? 'membro recebeu' : 'membros receberam'} um lembrete de confirmação.`);
    });
    paintRoleState();
  }

  const availabilityTabs = $('[data-availability-tabs]');
  if (availabilityTabs) {
    const tabs = $$('[data-availability-tab]', availabilityTabs);
    const panels = $$('[data-availability-panel]');
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(item => item.classList.toggle('active', item === tab));
      panels.forEach(panel => { panel.hidden = panel.dataset.availabilityPanel !== tab.dataset.availabilityTab; });
    }));
  }

  const availabilityModal = $('[data-availability-modal]');
  const availabilityForm = $('[data-availability-form]');
  const unavailabilityModal = $('[data-unavailability-modal]');
  const unavailabilityForm = $('[data-unavailability-form]');
  const openModal = modal => { if (!modal) return; modal.hidden = false; modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open'); window.setTimeout(() => $('select, input', modal)?.focus(), 40); };
  const closeModal = modal => { if (!modal) return; modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); if (!availabilityModal || availabilityModal.hidden) if (!unavailabilityModal || unavailabilityModal.hidden) document.body.classList.remove('modal-open'); };
  $$('[data-availability-open]').forEach(button => button.addEventListener('click', () => {
    const member = button.dataset.availabilityMember;
    const select = $('#availability-member', availabilityModal);
    if (member && select) select.value = member;
    openModal(availabilityModal);
  }));
  $$('[data-availability-close]').forEach(button => button.addEventListener('click', () => closeModal(availabilityModal)));
  $$('[data-unavailability-open]').forEach(button => button.addEventListener('click', () => openModal(unavailabilityModal)));
  $$('[data-unavailability-close]').forEach(button => button.addEventListener('click', () => closeModal(unavailabilityModal)));
  [availabilityModal, unavailabilityModal].forEach(modal => modal?.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));
  availabilityForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (!availabilityForm.reportValidity()) return;
    const member = $('#availability-member', availabilityForm)?.value || 'A pessoa';
    closeModal(availabilityModal);
    showToast('Horário atualizado', `${member} será considerado(a) nos próximos sorteios.`);
  });
  unavailabilityForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (!unavailabilityForm.reportValidity()) return;
    const member = $('#unavailability-member', unavailabilityForm)?.value || 'Pessoa';
    const date = $('#unavailability-date', unavailabilityForm)?.value;
    const untilDate = $('#unavailability-until-date', unavailabilityForm)?.value || date;
    const from = $('#unavailability-from', unavailabilityForm)?.value;
    const until = $('#unavailability-until', unavailabilityForm)?.value;
    const reason = $('#unavailability-reason', unavailabilityForm)?.value.trim() || 'indisponibilidade informada';
    const start = new Date(`${date}T12:00:00`);
    const dateParts = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).formatToParts(start);
    const dateDay = dateParts.find(part => part.type === 'day')?.value || '';
    const dateMonth = (dateParts.find(part => part.type === 'month')?.value || '').replace('.', '');
    const dateLabel = `${dateDay} ${dateMonth}`;
    const timeLabel = from && until ? ` das ${from} às ${until}` : ' o dia todo';
    const list = $('.blocked-list');
    const empty = $('.blocked-empty', list);
    if (list) {
      const row = document.createElement('div');
      row.className = 'blocked-row';
      row.innerHTML = `<div class="date-tile"><strong>${escapeAvailabilityText(dateDay)}</strong><span>${escapeAvailabilityText(dateMonth)}</span></div><div class="blocked-copy"><strong>${escapeAvailabilityText(member)}</strong><span>Indisponível${escapeAvailabilityText(timeLabel)} · ${escapeAvailabilityText(reason)}</span></div><button class="btn btn-ghost btn-icon btn-sm" type="button" data-availability-remove aria-label="Remover indisponibilidade de ${escapeAvailabilityText(member)}"><svg class="icon icon-sm"><use href="assets/icons.svg#trash-2"></use></svg></button>`;
      list.insertBefore(row, empty || null);
      if (empty) empty.hidden = true;
      row.querySelector('[data-availability-remove]')?.addEventListener('click', () => { row.remove(); showToast('Indisponibilidade removida', 'A data voltou a ficar disponível para o sorteador.'); });
    }
    closeModal(unavailabilityModal);
    showToast('Indisponibilidade salva', `${member} não será incluído(a) nessa data${untilDate !== date ? ' e no período selecionado' : ''}.`);
  });
  $$('[data-availability-remove]').forEach(button => button.addEventListener('click', () => {
    const row = button.closest('.blocked-row');
    row?.remove();
    showToast('Indisponibilidade removida', 'A data voltou a ficar disponível para o sorteador.');
  }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (availabilityModal && !availabilityModal.hidden) closeModal(availabilityModal);
    if (unavailabilityModal && !unavailabilityModal.hidden) closeModal(unavailabilityModal);
  });

  const settingsTabs = $$('.settings-tab');
  const settingsPanels = $$('.settings-panel');
  if (settingsTabs.length && settingsPanels.length) {
    const activateSettings = (key, updateUrl = true) => {
      settingsTabs.forEach(tab => {
        const active = tab.dataset.settingsTab === key;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      settingsPanels.forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== key; });
      if (updateUrl) history.replaceState(null, '', `#${key}`);
    };
    const initialKey = location.hash.replace('#', '') || 'conta';
    activateSettings(settingsTabs.some(tab => tab.dataset.settingsTab === initialKey) ? initialKey : 'conta', false);
    settingsTabs.forEach(tab => tab.addEventListener('click', () => activateSettings(tab.dataset.settingsTab)));
  }
  const themeInputs = $$('.theme-option input');
  const syncThemeOptions = () => {
    const choice = window.IgrejaTheme?.getChoice?.() || 'claro';
    themeInputs.forEach(input => {
      input.checked = input.value === choice;
      input.closest('.theme-option')?.classList.toggle('is-selected', input.checked);
    });
  };
  syncThemeOptions();
  themeInputs.forEach(input => input.addEventListener('change', () => {
    themeInputs.forEach(option => option.closest('.theme-option')?.classList.toggle('is-selected', option.checked));
    window.IgrejaTheme?.set(input.value);
    const labels = { claro: 'Tema claro ativado.', escuro: 'Tema escuro ativado.', sistema: 'Tema sincronizado com o dispositivo.' };
    showToast('Tema atualizado', labels[input.value]);
  }));
  window.addEventListener('igreja-conect:theme-change', syncThemeOptions);
  $$('.switch-input').forEach(input => input.addEventListener('change', () => {
    const label = input.closest('.settings-option')?.querySelector('strong')?.textContent || 'Preferência';
    showToast('Preferência atualizada', `${label}: ${input.checked ? 'ativada' : 'desativada'}.`);
  }));
  $$('.js-settings-form').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) {
      showToast('Revise o formulário', 'Confira os campos obrigatórios antes de salvar.');
      return;
    }
    const current = $('#current-password', form);
    const next = $('#new-password', form);
    const confirm = $('#confirm-password', form);
    if (next && confirm && next.value !== confirm.value) {
      confirm.setCustomValidity('As senhas não coincidem.');
      confirm.reportValidity();
      confirm.setCustomValidity('');
      showToast('Senhas diferentes', 'Digite a mesma senha nos dois campos.');
      return;
    }
    const submit = $('[type="submit"]', form);
    if (submit) { submit.disabled = true; window.setTimeout(() => { submit.disabled = false; }, 500); }
    const state = form.closest('.settings-panel')?.querySelector('[data-settings-state]');
    if (state) state.textContent = 'Alterações salvas agora';
    showToast(form.dataset.settingsForm === 'seguranca' ? 'Senha atualizada' : 'Alterações salvas', 'As configurações foram registradas com segurança.');
    if (current) form.reset();
  }));
  $$('.js-settings-session').forEach(button => button.addEventListener('click', () => {
    const isAll = button.textContent.toLowerCase().includes('outras');
    if (button.closest('.session-row')) button.closest('.session-row')?.remove();
    showToast(isAll ? 'Sessões encerradas' : 'Sessão encerrada', isAll ? 'Apenas este dispositivo continua conectado.' : 'O dispositivo foi removido da sua conta.');
  }));
  $$('.js-settings-danger').forEach(button => button.addEventListener('click', () => {
    if (window.confirm('Desativar o workspace Igreja Conect? Esta ação não pode ser desfeita.')) showToast('Ação bloqueada no protótipo', 'Nenhum dado foi alterado.');
  }));

})();
