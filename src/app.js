const { regions } = dataset;
const commonFuels = ['Дизельное топливо', 'Бензин АИ-92', 'Бензин АИ-95'];
const sources = {
  rosstat: { label: 'Росстат', dates: dataset.weeks, fuels: [...commonFuels, 'Бензин АИ-98 и выше'], national: true },
  multigo: { label: 'MultiGO', dates: dataset.multigo, fuels: [...commonFuels, 'Бензин АИ-98'], national: false }
};
const get = id => document.getElementById(id);
const source = get('source');
const region = get('region');
const fuel = get('fuel');
const compare = get('compare');
const period = get('period');
const startWeek = get('startWeek');
const endWeek = get('endWeek');
const volume = get('volume');
const quantity = get('quantity');
const machine = get('machine');
const chart = get('chart');
const tip = get('tip');

const rub = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeZone: 'UTC' });
const dateLabel = (week, fmt = fullDate) => fmt.format(new Date(week.date));
const priceText = price => price === null ? '—' : rub.format(price);
const cash = price => price === null ? '—' : priceText(price) + ' ₽';
const signed = value => (value > 0.00001 ? '+' : value < -0.00001 ? '−' : '') + rub.format(Math.abs(value));
const pct = (start, end) => (end / start - 1) * 100;
const direction = value => value > 0.00001 ? 'up' : value < -0.00001 ? 'down' : '';

function setOptions(select, options, value) {
  select.replaceChildren(...options.map(([id, label]) => new Option(label, id)));
  select.value = value;
}

const regionOptions = regions.map((name, id) => [id, name === 'Россия' ? 'Россия в среднем' : name]);
setOptions(region, regionOptions.slice(0, -1), 0);
setOptions(source, Object.entries(sources).map(([id, data]) => [id, data.label]), 'rosstat');

function setCompare(preferred) {
  const allowed = sources[source.value].national ? regionOptions : regionOptions.slice(0, -1);
  const options = [['none', 'Без сравнения'], ...allowed.filter(([id]) => id !== +region.value)];
  setOptions(compare, options, options.some(([id]) => String(id) === String(preferred)) ? preferred : 'none');
}

function setSource(preferredComparison) {
  const { dates, fuels, label } = sources[source.value];
  setOptions(fuel, fuels.map((name, id) => [id, name]), fuel.value || 0);
  const dateOptions = dates.map((date, index) => [index, dateLabel(date)]);
  setOptions(startWeek, dateOptions, 0);
  setOptions(endWeek, dateOptions, dates.length - 1);
  const choices = dates.length > 1
    ? [[dates.length, 'Весь период'], [6, 'Последние 6 недель'], [4, 'Последние 4 недели'], ['custom', 'Свой период']]
    : [[1, dateLabel(dates[0])]];
  setOptions(period, choices, dates.length);
  period.disabled = dates.length === 1;
  get('customPeriod').hidden = true;
  get('archiveDate').textContent = label + ' · данные по ' + dateLabel(dates.at(-1));
  setCompare(preferredComparison);
  render();
}

function selection() {
  const { dates, fuels } = sources[source.value];
  const custom = period.value === 'custom';
  const firstIndex = custom ? +startWeek.value : dates.length - +period.value;
  const lastIndex = custom ? +endWeek.value : dates.length - 1;
  const selected = dates.slice(firstIndex, lastIndex + 1);
  const series = [+region.value];
  if (compare.value !== 'none') series.push(+compare.value);
  return { selected, series, kind: +fuel.value, fuels };
}

function renderCalculation() {
  const { selected, series, kind } = selection();
  const price = selected.at(-1).prices[series[0]][kind];
  const liters = volume.valueAsNumber;
  const machines = quantity.valueAsNumber;
  const valid = volume.validity.valid && quantity.validity.valid;

  if (price === null) {
    get('total').textContent = '—';
    get('formula').textContent = 'Для выбранного региона и топлива цены нет.';
    return;
  }
  get('total').textContent = valid ? cash(liters * machines * price) : '—';
  get('formula').textContent = valid
    ? number.format(liters) + ' л × ' + number.format(machines) + ' шт. × ' + cash(price) + '/л'
    : 'Допустимый объём — от 0,01 до 1 000 000 л. Количество — от 1 до 10 000 целых единиц.';
}

function makeTable(container, headings, rows) {
  const table = document.createElement('table');
  const header = table.createTHead().insertRow();
  headings.forEach((label, column) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    if (column) cell.className = 'numeric';
    header.append(cell);
  });
  const body = table.createTBody();
  rows.forEach(({ values, tone, seriesIndex }) => {
    const row = body.insertRow();
    values.forEach((value, column) => {
      const cell = document.createElement(column ? 'td' : 'th');
      if (!column) cell.scope = 'row';
      if (column) cell.className = 'numeric';
      if (column === values.length - 1 && tone) cell.classList.add(tone);
      cell.textContent = value;
      if (column === 0 && seriesIndex !== undefined) {
        const label = document.createElement('span');
        label.className = 'table-key';
        label.append(makeDot(seriesIndex), value);
        cell.replaceChildren(label);
      }
      row.append(cell);
    });
  });
  container.replaceChildren(table);
}

function makeDot(index) {
  const dot = document.createElement('i');
  dot.className = index ? 'dot alt' : 'dot';
  dot.setAttribute('aria-hidden', 'true');
  return dot;
}

function render() {
  const { selected, series, kind, fuels } = selection();
  const first = selected[0];
  const last = selected.at(-1);
  const before = first.prices[series[0]][kind];
  const price = last.prices[series[0]][kind];
  const comparisonPrice = series.length > 1 ? last.prices[series[1]][kind] : null;
  const diff = before !== null && price !== null && selected.length > 1 ? price - before : null;
  const gap = price !== null && comparisonPrice !== null ? price - comparisonPrice : null;

  get('endPrice').textContent = price === null ? '—' : cash(price) + '/л';
  get('endInfo').textContent = regions[series[0]] + ' · ' + dateLabel(last);
  get('change').textContent = diff === null ? '—' : signed(diff) + ' ₽/л';
  get('change').className = direction(diff);
  get('changeInfo').textContent = diff !== null ? signed(pct(before, price)) + '% к первой дате'
    : selected.length === 1 ? 'Одна дата наблюдения' : 'Данных для расчёта нет';
  get('gap').textContent = gap === null ? '—' : signed(gap) + ' ₽/л';
  get('gap').className = gap === null ? '' : direction(gap);
  get('gapInfo').textContent = series.length === 1 ? 'Укажите регион для сравнения'
    : gap === null ? 'Данных для сравнения нет' : 'К уровню «' + regions[series[1]] + '»';

  const range = selected.length > 1 ? dateLabel(first, shortDate) + ' — ' + dateLabel(last, shortDate) : dateLabel(last, shortDate);
  get('chartSub').textContent = fuels[kind] + ' · ' + range + ' ' + last.date.slice(0, 4);
  get('comparisonSub').textContent = fuels[kind] + ' · ' + dateLabel(last);
  get('latest').href = '#week-' + last.date;
  get('legend').replaceChildren(...series.map((id, index) => {
    const span = document.createElement('span');
    span.append(makeDot(index), regions[id]);
    return span;
  }));

  makeTable(get('weekTable'), ['Дата', ...series.map(id => regions[id])], selected.map(week => ({
    values: [dateLabel(week), ...series.map(id => cash(week.prices[id][kind]))]
  })));
  makeTable(get('regionTable'), ['Регион', 'Цена за литр', 'Первая дата', 'Изменение'], series.map((id, index) => {
    const start = first.prices[id][kind];
    const end = last.prices[id][kind];
    const hasChange = selected.length > 1 && start !== null && end !== null;
    return {
      seriesIndex: index,
      values: [regions[id], cash(end), cash(start), hasChange ? signed(pct(start, end)) + '%' : '—'],
      tone: hasChange ? direction(end - start) : ''
    };
  }));
  renderChart(selected, series, kind);
  renderCalculation();
}

function svgNode(tag, attributes = {}, value = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, data]) => node.setAttribute(key, data));
  if (value) node.textContent = value;
  return node;
}

function renderChart(selected, series, kind) {
  const width = Math.max(260, chart.clientWidth);
  const height = chart.clientHeight || 235;
  const left = 41;
  const right = width - 13;
  const top = 13;
  const bottom = height - 26;
  const values = selected.flatMap(week => series.map(id => week.prices[id][kind])).filter(Number.isFinite);
  chart.setAttribute('viewBox', [0, 0, width, height].join(' '));
  chart.replaceChildren();
  tip.hidden = true;
  if (!values.length) {
    chart.append(svgNode('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle' }, 'Нет цен на выбранное топливо'));
    return;
  }
  const low = Math.min(...values);
  const high = Math.max(...values);
  const target = Math.max((high - low) / 4, 0.2);
  const base = 10 ** Math.floor(Math.log10(target));
  const step = base * ([1, 2, 2.5, 5, 10].find(n => n >= target / base) ?? 10);
  const min = Math.floor((low - step * 0.24) / step) * step;
  const max = Math.ceil((high + step * 0.24) / step) * step;
  const x = index => selected.length === 1 ? (left + right) / 2 : left + index * (right - left) / (selected.length - 1);
  const y = value => bottom - (value - min) / (max - min) * (bottom - top);

  for (let tick = min; tick <= max + step / 10; tick += step) {
    const gy = y(tick);
    chart.append(svgNode('line', { x1: left, x2: right, y1: gy, y2: gy, stroke: '#e3e4db' }));
    chart.append(svgNode('text', { x: left - 7, y: gy + 4, 'text-anchor': 'end' }, number.format(tick)));
  }

  const colors = ['#39614a', '#a45b3c'];
  series.forEach((id, index) => {
    const linestyle = { fill: 'none', stroke: colors[index], 'stroke-width': 2.2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': index ? '5 4' : '' };
    const path = selected.map((week, i) => {
      const price = week.prices[id][kind];
      if (price === null) return '';
      const command = i === 0 || selected[i - 1].prices[id][kind] === null ? 'M' : 'L';
      return command + x(i) + ',' + y(price);
    }).join(' ');
    chart.append(svgNode('path', { ...linestyle, d: path }));
    selected.forEach((week, i) => {
      const price = week.prices[id][kind];
      if (price === null) return;
      chart.append(svgNode('circle', { cx: x(i), cy: y(price), r: 3.4,
        fill: colors[index], stroke: 'white', 'stroke-width': 1.3 }));
    });
  });

  const last = selected.length - 1;
  const labelStep = Math.max(1, Math.ceil(selected.length / Math.floor((right - left) / 61)));
  const hitWidth = selected.length === 1 ? right - left : (right - left) / last;
  selected.forEach((week, i) => {
    if (i === 0 || i === last || (i % labelStep === 0 && last - i >= labelStep)) {
      const labelX = i === last && last > 0 ? width - 2 : x(i);
      chart.append(svgNode('text', { x: labelX, y: height - 7, 'text-anchor': i === last && last > 0 ? 'end' : 'middle' },
        dateLabel(week, shortDate).replace('.', '')));
    }
    const label = [dateLabel(week), ...series.map(id => {
      const price = week.prices[id][kind];
      return regions[id] + ' · ' + (price === null ? 'нет цены' : cash(price) + ' за литр');
    })];
    const group = svgNode('g', { class: 'hit', tabindex: 0, role: 'img', 'aria-label': label.join(', ') });
    group.append(svgNode('rect', { x: Math.max(left - 4, x(i) - hitWidth / 2), y: top,
      width: (i === 0 || i === last) && last ? hitWidth / 2 + 4 : hitWidth, height: bottom - top, fill: 'transparent' }));
    const show = () => {
      const title = document.createElement('strong');
      title.textContent = label[0];
      tip.replaceChildren(title, ...label.slice(1).map(value => {
        const line = document.createElement('span');
        line.textContent = value;
        return line;
      }));
      tip.hidden = false;
      tip.style.left = Math.max(2, Math.min(width - tip.offsetWidth - 2, x(i) + 9)) + 'px';
    };
    group.addEventListener('pointerenter', show);
    group.addEventListener('click', show);
    group.addEventListener('focus', show);
    group.addEventListener('blur', () => { tip.hidden = true; });
    group.addEventListener('keydown', event => { if (event.key === 'Escape') tip.hidden = true; });
    chart.append(group);
  });
}

chart.addEventListener('pointerleave', () => { tip.hidden = true; });
source.addEventListener('change', () => setSource(compare.value));
region.addEventListener('change', () => {
  setCompare(compare.value === region.value ? 'none' : compare.value);
  render();
});
period.addEventListener('change', () => {
  get('customPeriod').hidden = period.value !== 'custom';
  render();
});
startWeek.addEventListener('change', () => {
  if (+startWeek.value > +endWeek.value) endWeek.value = startWeek.value;
  render();
});
endWeek.addEventListener('change', () => {
  if (+endWeek.value < +startWeek.value) startWeek.value = endWeek.value;
  render();
});
[fuel, compare].forEach(select => select.addEventListener('change', render));
machine.addEventListener('change', () => {
  if (machine.value === 'custom') {
    volume.focus();
    volume.select();
  } else {
    volume.value = machine.value;
  }
  renderCalculation();
});
volume.addEventListener('input', () => {
  machine.value = 'custom';
  renderCalculation();
});
quantity.addEventListener('input', renderCalculation);
const observations = Object.values(sources).flatMap(data => data.dates.map(week => ({ ...data, week })));
observations.slice().sort((a, b) => b.week.date.localeCompare(a.week.date)).forEach(({ week, label, fuels }) => {
  const entry = document.createElement('details');
  entry.id = 'week-' + week.date;
  const title = document.createElement('summary');
  title.textContent = dateLabel(week) + ' · ' + label;
  const table = document.createElement('div');
  table.className = 'scroll';
  makeTable(table, ['Регион', ...fuels], week.prices.map((prices, id) => ({
    values: [regions[id], ...prices.map(priceText)]
  })));
  entry.append(title, table);
  get('sourceList').append(entry);
});

function openWeek(hash) {
  if (!hash.startsWith('#week-')) return;
  const entry = get(hash.slice(1));
  if (entry) entry.open = true;
}

get('latest').addEventListener('click', event => openWeek(event.currentTarget.hash));
window.addEventListener('hashchange', () => openWeek(window.location.hash));
openWeek(window.location.hash);

const csv = [['Дата', 'Регион', 'Вид топлива', 'Рублей за литр', 'Источник'],
  ...observations.flatMap(({ week, label, fuels }) => week.prices.flatMap((prices, id) =>
    fuels.flatMap((name, kind) => prices[kind] === null ? []
      : [[week.date, regions[id], name, priceText(prices[kind]), label]])))];
get('export').href = URL.createObjectURL(new Blob(['\uFEFF', csv.map(row => row.join(';')).join('\r\n')],
  { type: 'text/csv;charset=utf-8' }));
setSource(1);
new ResizeObserver(() => {
  const { selected, series, kind } = selection();
  renderChart(selected, series, kind);
}).observe(chart);
