import {
  STORAGE_KEY, INTERVALS, emptyBudget, normalizeBudget, allocatedForGroup, localDay, addDays,
  cents, balanceFor, netSpentFor, netTransfersFor, currentAllocation, currentInterval, dailyAccrual, dollars
} from './budget.js?v=19';

const DEFAULT_ICON = '🐷';
const EDIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.8 6.2 4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

let storageWarning = '';
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptyBudget();
    const saved = JSON.parse(raw);
    if (saved && Array.isArray(saved.categories) && Array.isArray(saved.purchases)) return normalizeBudget(saved);
    storageWarning = 'Saved budget data could not be read. Your existing data has not been changed.';
  } catch (error) {
    storageWarning = 'Saved budget data could not be read. Your existing data has not been changed.';
    console.warn('Could not load saved budget:', error);
  }
  return emptyBudget();
}

let budget = load();
function budgetDay() { return addDays(localDay(), budget.dayOffset || 0); }
function formatDay(day, dateStyle = 'medium') { return new Intl.DateTimeFormat(undefined, { dateStyle }).format(new Date(`${day}T12:00:00`)); }

function save(next, message = { textContent: '' }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    budget = next;
    storageWarning = '';
    document.querySelector('#storage-warning')?.remove();
    return true;
  } catch (error) {
    message.textContent = 'Could not save. Check that this browser allows site storage.';
    console.error('Could not save budget:', error);
    return false;
  }
}

function showStorageWarning() {
  const main = document.querySelector('main');
  if (!main || !storageWarning || document.querySelector('#storage-warning')) return;
  const warning = element('p', 'storage-warning', storageWarning);
  warning.id = 'storage-warning'; warning.role = 'alert'; main.prepend(warning);
}
function element(tag, className = '', content = null) {
  const node = document.createElement(tag); if (className) node.className = className; if (content != null) node.textContent = content; return node;
}
function inputLabel(text, name, attributes = {}) {
  const label = element('label', '', text); const input = element('input'); input.name = name;
  for (const [key, value] of Object.entries(attributes)) input[key] = value;
  label.append(input); return label;
}
function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = new Date(`${value}T12:00:00Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function singleEmoji(value) {
  const icon = String(value).trim(); const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(icon)];
  return graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\uFE0F\u20E3]/u.test(icon) ? icon : null;
}
function nonnegativeCents(value) { if (String(value).trim() === '' || Number(value) < 0) return null; return Number(value) === 0 ? 0 : cents(value); }
function allocationDifference(allocated, target) {
  const difference = allocated - target; return difference > 0 ? `${dollars(difference)} over` : difference < 0 ? `${dollars(-difference)} under` : 'On target';
}
function intervalLabel() { return INTERVALS[currentInterval(budget)].label; }
function allocationPreview(node, groupId, replacement) {
  const group = budget.groups.find(entry => entry.id === groupId);
  node.textContent = group ? `${group.name}: ${allocationDifference(allocatedForGroup(budget.categories, groupId, replacement), group.intervalCents)}` : '';
}
function groupOptions(select, selected = '') {
  select.replaceChildren();
  for (const group of budget.groups) { const option = element('option', '', group.name); option.value = group.id; select.append(option); }
  select.value = selected || budget.groups[0]?.id || '';
}
function categoryOptions(select, selected = '') {
  select.replaceChildren();
  for (const category of budget.categories) { const option = element('option', '', `${category.icon || DEFAULT_ICON} ${category.name}`); option.value = category.id; select.append(option); }
  if (selected && budget.categories.some(category => category.id === selected)) select.value = selected;
}
function startingOptions(select) {
  const interval = currentInterval(budget);
  const configs = {
    '2-weeks': [[1, '2 weeks'], [2, '4 weeks'], [4, '8 weeks'], [6, '12 weeks']],
    '4-weeks': [[1, '4 weeks'], [2, '8 weeks'], [3, '12 weeks']],
    '30-days': [[1, '30 days'], [2, '60 days'], [3, '90 days']],
    '1-month': [[1, '1 month'], [2, '2 months'], [3, '3 months']]
  };
  select.replaceChildren();
  const empty = element('option', '', 'Empty ($0)'); empty.value = '0'; select.append(empty);
  for (const [multiplier, label] of configs[interval]) { const option = element('option', '', label); option.value = String(multiplier); select.append(option); }
}
function iconButton(type, label) {
  const button = element('button', type === 'edit' ? 'icon-action edit-icon' : 'delete-icon'); button.type = 'button'; button.setAttribute('aria-label', label); button.title = label;
  if (type === 'edit') button.innerHTML = EDIT_ICON; else button.textContent = '×'; return button;
}

function validatedBackup(value) {
  const raw = value?.format === 'piggy-budget' && value.data ? value.data : value;
  if (!raw || !Array.isArray(raw.categories) || !Array.isArray(raw.purchases)) throw new Error('This is not a Piggy Budget backup.');
  const data = normalizeBudget(raw);
  const groupIds = new Set();
  for (const group of data.groups) {
    if (!group?.id || groupIds.has(group.id) || !group.name?.trim() || !Number.isSafeInteger(group.intervalCents) || group.intervalCents < 0) throw new Error('Backup has an invalid group.');
    groupIds.add(group.id);
  }
  const categoryIds = new Set();
  for (const category of data.categories) {
    if (!category?.id || categoryIds.has(category.id) || !category.name?.trim() || !validDay(category.createdDay) || !Number.isSafeInteger(category.startingCents) || category.startingCents < 0 || !groupIds.has(category.groupId) || !category.changes?.length) throw new Error('Backup has an invalid category.');
    if (category.changes.some(change => !validDay(change.day) || !Number.isSafeInteger(change.intervalCents) || change.intervalCents <= 0)) throw new Error('Backup has invalid allocation history.');
    categoryIds.add(category.id);
  }
  if (data.intervalChanges.some(change => !validDay(change.day) || !INTERVALS[change.interval])) throw new Error('Backup has an invalid budget interval history.');
  for (const purchase of data.purchases) if (!purchase?.id || !categoryIds.has(purchase.categoryId) || !validDay(purchase.day) || !Number.isSafeInteger(purchase.amountCents) || purchase.amountCents === 0) throw new Error('Backup has an invalid transaction.');
  for (const transfer of data.transfers) if (!transfer?.id || !categoryIds.has(transfer.fromCategoryId) || !categoryIds.has(transfer.toCategoryId) || transfer.fromCategoryId === transfer.toCategoryId || !validDay(transfer.day) || !Number.isSafeInteger(transfer.amountCents) || transfer.amountCents <= 0) throw new Error('Backup has an invalid transfer.');
  return data;
}
function downloadBackup() {
  const payload = { format: 'piggy-budget', version: 2, exportedAt: new Date().toISOString(), data: budget };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `piggy-budget-backup-${localDay()}.json`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function renderHome() {
  const list = document.querySelector('#category-list'); if (!list) return; list.replaceChildren();
  if (!budget.categories.length) list.append(element('div', 'panel empty-state', 'No categories yet.'));
  for (const category of budget.categories) {
    const categoryBalance = balanceFor(category, budget.purchases, budget, budgetDay());
    const card = element('article', 'category-card'); card.dataset.categoryId = category.id;
    const top = element('div', 'category-top'); const heading = element('h3', 'category-heading');
    const icon = element('span', 'category-emoji', category.icon || DEFAULT_ICON); icon.ariaHidden = 'true'; heading.append(icon, document.createTextNode(category.name));
    top.append(heading, element('p', `balance${categoryBalance < 0 ? ' negative' : ''}`, dollars(categoryBalance))); card.append(top);
    const actions = element('div', 'category-actions');
    const shake = element('button', 'secondary-button', 'Shake this piggy'); shake.type = 'button'; shake.ariaExpanded = 'false';
    const history = element('a', 'history-link', 'View transactions'); history.href = `./transactions.html?category=${encodeURIComponent(category.id)}&v=19`;
    actions.append(shake, history); card.append(actions);
    const form = element('form', 'spend-form'); form.hidden = true; form.id = `record-${category.id}`; shake.setAttribute('aria-controls', form.id);
    shake.addEventListener('click', () => { form.hidden = !form.hidden; shake.ariaExpanded = String(!form.hidden); if (!form.hidden) form.elements.namedItem('amount').focus(); });
    form.append(inputLabel('Amount ($)', 'amount', { type: 'number', min: '0.01', step: '0.01', inputMode: 'decimal', placeholder: '0.00', required: true }));
    form.append(inputLabel('Description (optional)', 'note', { maxLength: 100, placeholder: 'What was it for?' }));
    const refundLabel = element('label', 'checkbox-label'); const refund = element('input'); refund.type = 'checkbox'; refund.name = 'refund'; refundLabel.append(refund, document.createTextNode('Refund (add this amount back)')); form.append(refundLabel);
    const submit = element('button', '', 'Record transaction'); submit.type = 'submit'; const message = element('p', 'form-message'); message.role = 'status'; form.append(submit, message);
    form.addEventListener('submit', event => {
      event.preventDefault(); const data = new FormData(form); const amountCents = cents(data.get('amount'));
      if (amountCents === null) { message.textContent = 'Enter an amount above $0 with at most two decimal places.'; return; }
      const transaction = { id: crypto.randomUUID(), categoryId: category.id, amountCents: refund.checked ? -amountCents : amountCents, note: String(data.get('note')).trim(), day: budgetDay(), createdAt: new Date().toISOString() };
      if (save({ ...budget, purchases: [...budget.purchases, transaction] }, message)) renderAll();
    });
    card.append(form); list.append(card);
  }
}

function renderIntervalSetting() {
  const select = document.querySelector('#budget-interval'); if (!select) return; select.value = currentInterval(budget);
  const interval = currentInterval(budget);
  const fraction = interval === '1-month' ? '12/365' : `1/${INTERVALS[interval].days}`;
  document.querySelector('#interval-description').textContent = `Each category accrues daily at ${fraction} of its interval allocation.`;
}

function renderSettings() {
  const list = document.querySelector('#settings-categories'); if (!list) return; list.replaceChildren();
  if (!budget.groups.length) list.append(element('li', 'muted', 'Add a group to start.'));
  for (const budgetGroup of budget.groups) {
    const groupCard = element('li', 'panel group-card');
    const summary = element('div', 'group-summary'); const header = element('div', 'setting-header');
    header.append(element('h3', '', budgetGroup.name), element('strong', '', `${dollars(budgetGroup.intervalCents)} / ${intervalLabel()}`)); summary.append(header);
    const allocated = allocatedForGroup(budget.categories, budgetGroup.id); summary.append(element('p', 'allocation-summary', `${dollars(allocated)} allocated · ${allocationDifference(allocated, budgetGroup.intervalCents)}`));
    const changeTarget = element('button', 'text-button', 'Change total allocation'); changeTarget.type = 'button';
    const targetForm = element('form', 'edit-form'); targetForm.hidden = true; targetForm.id = `total-${budgetGroup.id}`; changeTarget.setAttribute('aria-controls', targetForm.id);
    changeTarget.addEventListener('click', () => { targetForm.hidden = !targetForm.hidden; });
    const targetLabel = inputLabel(`Total allocation per ${intervalLabel()} ($)`, 'total', { type: 'number', min: '0', step: '0.01', required: true }); targetLabel.querySelector('input').value = (budgetGroup.intervalCents / 100).toFixed(2);
    const targetPreview = element('p', 'allocation-preview'); const updatePreview = () => { const target = nonnegativeCents(targetLabel.querySelector('input').value); targetPreview.textContent = target === null ? 'Enter a valid amount.' : `${allocationDifference(allocated, target)} after change`; }; targetLabel.querySelector('input').addEventListener('input', updatePreview); updatePreview();
    const targetSubmit = element('button', 'secondary-button', 'Update total'); targetSubmit.type = 'submit'; const targetMessage = element('p', 'form-message'); targetForm.append(targetLabel, targetSubmit, targetPreview, targetMessage);
    targetForm.addEventListener('submit', event => { event.preventDefault(); const intervalCents = nonnegativeCents(targetLabel.querySelector('input').value); if (intervalCents === null) { targetMessage.textContent = 'Enter a valid total.'; return; } if (save({ ...budget, groups: budget.groups.map(group => group.id === budgetGroup.id ? { ...group, intervalCents } : group) }, targetMessage)) renderSettings(); });
    summary.append(changeTarget, targetForm); groupCard.append(summary);
    const members = element('ul', 'settings-list group-members'); groupCard.append(members); list.append(groupCard);
    const categories = budget.categories.filter(category => category.groupId === budgetGroup.id); if (!categories.length) members.append(element('li', 'muted', 'No categories in this group.'));
    for (const category of categories) {
      const item = element('li', 'setting-card'); const rowHeader = element('div', 'setting-header'); const heading = element('h3', 'category-heading');
      const picker = element('input', 'icon-picker'); picker.type = 'text'; picker.maxLength = 64; picker.value = category.icon || DEFAULT_ICON; picker.setAttribute('aria-label', `Emoji icon for ${category.name}`);
      picker.addEventListener('input', () => { const status = document.querySelector('#category-status'); const icon = singleEmoji(picker.value); if (!icon) { status.textContent = 'Enter one emoji for the icon.'; return; } save({ ...budget, categories: budget.categories.map(entry => entry.id === category.id ? { ...entry, icon } : entry) }, status); });
      heading.append(picker, document.createTextNode(category.name)); const remove = iconButton('remove', `Delete ${category.name}`);
      remove.addEventListener('click', () => { const tx = budget.purchases.filter(p => p.categoryId === category.id).length; const tr = budget.transfers.filter(t => t.fromCategoryId === category.id || t.toCategoryId === category.id).length; if (!confirm(`Delete ${category.name}, its ${tx} transaction${tx===1?'':'s'} and ${tr} transfer${tr===1?'':'s'}? This cannot be undone.`)) return; const status = document.querySelector('#category-status'); if (save({ ...budget, categories: budget.categories.filter(c => c.id !== category.id), purchases: budget.purchases.filter(p => p.categoryId !== category.id), transfers: budget.transfers.filter(t => t.fromCategoryId !== category.id && t.toCategoryId !== category.id) }, status)) renderSettings(); });
      rowHeader.append(heading, remove); item.append(rowHeader);
      const facts = element('dl', 'category-facts'); for (const [term, value] of [['Allocation', `${dollars(currentAllocation(category))} / ${intervalLabel()}`], ['Accrual per day', dollars(dailyAccrual(category, currentInterval(budget)))], ['Budgeting since', formatDay(category.createdDay)]]) { const fact = element('div'); fact.append(element('dt','',term), element('dd','',value)); facts.append(fact); } item.append(facts);
      const change = element('button', 'text-button', 'Change allocation'); change.type = 'button'; const form = element('form', 'edit-form'); form.hidden = true; change.addEventListener('click', () => { form.hidden = !form.hidden; });
      const allocationLabel = inputLabel(`Allocation per ${intervalLabel()} ($)`, 'allocation', { type: 'number', min: '0.01', step: '0.01', required: true }); allocationLabel.querySelector('input').value = (currentAllocation(category)/100).toFixed(2);
      const groupLabel = element('label', '', 'Group'); const groupSelect = element('select'); groupOptions(groupSelect, category.groupId); groupLabel.append(groupSelect); const preview = element('p','allocation-preview');
      const recalc = () => { const intervalCents = cents(allocationLabel.querySelector('input').value); if (intervalCents === null) { preview.textContent='Enter a valid allocation.'; return; } allocationPreview(preview, groupSelect.value, { ...category, groupId: groupSelect.value, changes: [{ day: budgetDay(), intervalCents }] }); }; allocationLabel.querySelector('input').addEventListener('input', recalc); groupSelect.addEventListener('change', recalc); recalc();
      const submit = element('button','secondary-button','Update'); submit.type='submit'; const msg=element('p','form-message'); form.append(allocationLabel,groupLabel,preview,submit,msg);
      form.addEventListener('submit', event => { event.preventDefault(); const intervalCents=cents(allocationLabel.querySelector('input').value); if(intervalCents===null){msg.textContent='Enter a valid allocation.';return;} const changes=[...category.changes]; if(changes.at(-1).day===budgetDay()) changes[changes.length-1]={day:budgetDay(),intervalCents}; else changes.push({day:budgetDay(),intervalCents}); if(save({...budget,categories:budget.categories.map(c=>c.id===category.id?{...c,groupId:groupSelect.value,changes}:c)},msg)) renderSettings(); });
      const actionWrap=element('div','setting-actions'); actionWrap.append(change); item.append(actionWrap, form); members.append(item);
    }
  }
}

function renderTransactions() {
  const list=document.querySelector('#transaction-list'); if(!list)return; list.replaceChildren(); const id=new URLSearchParams(location.search).get('category'); const category=budget.categories.find(c=>c.id===id); const heading=document.querySelector('#transaction-heading'); const summary=document.querySelector('#transaction-summary');
  if(!category){heading.textContent='Category not found';summary.replaceChildren();return;}
  heading.textContent=`${category.icon||DEFAULT_ICON} ${category.name}`; document.title=`${category.name} transactions · Piggy Budget`;
  const remaining=balanceFor(category,budget.purchases,budget,budgetDay()); const spent=netSpentFor(category,budget.purchases,budgetDay()); const transferEffect=netTransfersFor(category,budget.transfers,budgetDay()); const accumulated=remaining+spent-transferEffect;
  summary.replaceChildren(); for(const [term,value] of [['Budgeting since',formatDay(category.createdDay)],['Total accumulated',dollars(accumulated)],['Total spent',dollars(spent)],['Remaining',dollars(remaining)]]){const r=element('div');r.append(element('dt','',term),element('dd','',value));summary.append(r);}
  const entries=[...budget.purchases.filter(p=>p.categoryId===id).map(item=>({kind:'purchase',item})),...budget.transfers.filter(t=>t.fromCategoryId===id||t.toCategoryId===id).map(item=>({kind:'transfer',item}))].sort((a,b)=>(b.item.createdAt||b.item.day).localeCompare(a.item.createdAt||a.item.day));
  if(!entries.length)list.append(element('p','muted','No transactions in this category yet.'));
  for(const entry of entries){
    const wrapper=element('article','transaction-entry'); const row=element('div','transaction-row'); const details=element('div');
    if(entry.kind==='transfer'){
      const t=entry.item; const outgoing=t.fromCategoryId===id; const other=budget.categories.find(c=>c.id===(outgoing?t.toCategoryId:t.fromCategoryId)); details.append(element('strong','',t.note||`Transfer ${outgoing?'to':'from'} ${other?.name||'category'}`),element('small','',`${formatDay(t.day)} · Transfer ${outgoing?'to':'from'} ${other?.name||'category'}`)); row.append(details,element('span',`purchase-amount${outgoing?'':' refund-amount'}`,`${outgoing?'−':'+'}${dollars(t.amountCents)}`)); const actions=element('div','transaction-actions'); const remove=iconButton('remove','Remove transfer'); remove.addEventListener('click',()=>{if(save({...budget,transfers:budget.transfers.filter(x=>x.id!==t.id)},document.querySelector('#transaction-message')))renderTransactions();});actions.append(remove);row.append(actions);wrapper.append(row);list.append(wrapper);continue;
    }
    const t=entry.item; const refund=t.amountCents<0; details.append(element('strong','',t.note||(refund?'Refund':'Purchase')),element('small','',`${formatDay(t.day)} · ${refund?'Refund':'Purchase'}`)); row.append(details,element('span',`purchase-amount${refund?' refund-amount':''}`,`${refund?'+':'−'}${dollars(Math.abs(t.amountCents))}`)); const actions=element('div','transaction-actions'); const edit=iconButton('edit','Edit transaction'); const remove=iconButton('remove','Remove transaction'); actions.append(edit,remove); row.append(actions); wrapper.append(row);
    const form=element('form','transaction-edit-form'); form.hidden=true; const amount=inputLabel('Amount ($)','amount',{type:'number',min:'0.01',step:'0.01',required:true});amount.querySelector('input').value=(Math.abs(t.amountCents)/100).toFixed(2); const note=inputLabel('Description (optional)','note',{maxLength:100});note.querySelector('input').value=t.note||''; const day=inputLabel('Date','day',{type:'date',required:true});day.querySelector('input').value=t.day;day.querySelector('input').max=budgetDay(); const catLabel=element('label','','Category');const catSelect=element('select');categoryOptions(catSelect,t.categoryId);catLabel.append(catSelect);const refundLabel=element('label','checkbox-label');const refundInput=element('input');refundInput.type='checkbox';refundInput.checked=refund;refundLabel.append(refundInput,document.createTextNode('Refund'));const buttons=element('div','edit-buttons');const saveBtn=element('button','','Save changes');saveBtn.type='submit';const cancel=element('button','secondary-button','Cancel');cancel.type='button';buttons.append(saveBtn,cancel);const msg=element('p','form-message');form.append(amount,note,day,catLabel,refundLabel,buttons,msg);wrapper.append(form);
    const setMin=()=>{day.querySelector('input').min=budget.categories.find(c=>c.id===catSelect.value)?.createdDay||'';};catSelect.addEventListener('change',setMin);setMin(); edit.addEventListener('click',()=>{form.hidden=!form.hidden;if(!form.hidden)amount.querySelector('input').focus();});cancel.addEventListener('click',()=>form.hidden=true);remove.addEventListener('click',()=>{if(save({...budget,purchases:budget.purchases.filter(x=>x.id!==t.id)},document.querySelector('#transaction-message')))renderTransactions();});
    form.addEventListener('submit',event=>{event.preventDefault();const amountCents=cents(amount.querySelector('input').value);const target=budget.categories.find(c=>c.id===catSelect.value);const d=day.querySelector('input').value;if(amountCents===null||!target||!validDay(d)||d<target.createdDay||d>budgetDay()){msg.textContent='Enter a valid amount, category, and date.';return;}const updated={...t,categoryId:target.id,amountCents:refundInput.checked?-amountCents:amountCents,note:note.querySelector('input').value.trim(),day:d};if(save({...budget,purchases:budget.purchases.map(x=>x.id===t.id?updated:x)},msg))renderTransactions();});
    list.append(wrapper);
  }
}

const intervalSelect=document.querySelector('#budget-interval');
if(intervalSelect){
  intervalSelect.addEventListener('change',()=>{const interval=intervalSelect.value;if(!INTERVALS[interval])return;const changes=[...budget.intervalChanges];if(changes.at(-1).day===budgetDay())changes[changes.length-1]={day:budgetDay(),interval};else changes.push({day:budgetDay(),interval});if(save({...budget,intervalChanges:changes},document.querySelector('#interval-message')))renderAll();});
}
const groupForm=document.querySelector('#group-form'); const addGroupButton=document.querySelector('#add-group'); const addGroupPanel=document.querySelector('#add-group-panel');
if(groupForm){addGroupButton.addEventListener('click',()=>{addGroupPanel.hidden=!addGroupPanel.hidden;});groupForm.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(groupForm);const name=String(data.get('name')).trim();const intervalCents=nonnegativeCents(data.get('total'));const msg=document.querySelector('#group-message');if(!name||intervalCents===null){msg.textContent='Enter a name and valid allocation.';return;}const group={id:crypto.randomUUID(),name,intervalCents};if(save({...budget,groups:[...budget.groups,group]},msg)){groupForm.reset();addGroupPanel.hidden=true;renderSettings();}});}
const categoryForm=document.querySelector('#category-form');const addCategoryButton=document.querySelector('#add-category');const addCategoryPanel=document.querySelector('#add-category-panel');
function refreshCategoryForm(){if(!categoryForm)return;groupOptions(categoryForm.elements.namedItem('groupId'));startingOptions(categoryForm.elements.namedItem('startingMultiplier'));}
if(categoryForm){addCategoryButton.addEventListener('click',()=>{addCategoryPanel.hidden=!addCategoryPanel.hidden;if(!addCategoryPanel.hidden){refreshCategoryForm();categoryForm.elements.namedItem('name').focus();}});if(location.hash==='#add-category'){addCategoryPanel.hidden=false;refreshCategoryForm();}
  const preview=()=>{const amount=cents(categoryForm.elements.namedItem('allocation').value);const groupId=categoryForm.elements.namedItem('groupId').value;const node=document.querySelector('#new-category-preview');if(amount===null){node.textContent='Enter an allocation to see the group total.';return;}allocationPreview(node,groupId,{id:'preview',groupId,changes:[{day:budgetDay(),intervalCents:amount}]});};categoryForm.elements.namedItem('allocation').addEventListener('input',preview);categoryForm.elements.namedItem('groupId').addEventListener('change',preview);
  categoryForm.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(categoryForm);const name=String(data.get('name')).trim();const icon=singleEmoji(data.get('icon'));const intervalCents=cents(data.get('allocation'));const groupId=String(data.get('groupId'));const multiplier=Number(data.get('startingMultiplier'));const msg=document.querySelector('#category-message');if(!name||!icon||intervalCents===null||!budget.groups.some(g=>g.id===groupId)||![0,1,2,3,4,6].includes(multiplier)){msg.textContent='Enter valid category details.';return;}const category={id:crypto.randomUUID(),name,icon,groupId,createdDay:budgetDay(),startingCents:multiplier*intervalCents,changes:[{day:budgetDay(),intervalCents}]};if(save({...budget,categories:[...budget.categories,category]},msg)){categoryForm.reset();addCategoryPanel.hidden=true;renderAll();}});
}
const transferToggle=document.querySelector('#transfer-toggle');const transferPanel=document.querySelector('#transfer-panel');const transferForm=document.querySelector('#transfer-form');
function refreshTransferForm(){if(!transferForm)return;const from=transferForm.elements.namedItem('fromCategoryId');const to=transferForm.elements.namedItem('toCategoryId');categoryOptions(from,from.value);categoryOptions(to,to.value);transferToggle.disabled=budget.categories.length<2;if(budget.categories.length>=2&&to.value===from.value)to.value=budget.categories.find(c=>c.id!==from.value)?.id||'';}
if(transferForm){transferToggle.addEventListener('click',()=>{transferPanel.hidden=!transferPanel.hidden;});transferForm.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(transferForm);const fromCategoryId=String(data.get('fromCategoryId'));const toCategoryId=String(data.get('toCategoryId'));const amountCents=cents(data.get('amount'));const msg=document.querySelector('#transfer-message');if(fromCategoryId===toCategoryId||amountCents===null){msg.textContent='Choose two different categories and a valid amount.';return;}const transfer={id:crypto.randomUUID(),fromCategoryId,toCategoryId,amountCents,note:String(data.get('note')).trim(),day:budgetDay(),createdAt:new Date().toISOString()};if(save({...budget,transfers:[...budget.transfers,transfer]},msg))renderAll();});}
const backupButton=document.querySelector('#download-backup');const restoreInput=document.querySelector('#restore-backup');if(backupButton)backupButton.addEventListener('click',()=>{downloadBackup();document.querySelector('#backup-message').textContent='Backup downloaded.';});if(restoreInput)restoreInput.addEventListener('change',async()=>{const msg=document.querySelector('#backup-message');const file=restoreInput.files?.[0];if(!file)return;try{const restored=validatedBackup(JSON.parse(await file.text()));if(confirm('Restore this backup? This will replace the current budget data.')){save(restored,msg);renderAll();msg.textContent='Backup restored.';}}catch(error){msg.textContent=error.message||'Could not restore backup.';}finally{restoreInput.value='';}});
const advanceButton=document.querySelector('#advance-day');function renderSimulation(){const status=document.querySelector('#simulation-status');if(status)status.textContent=`Budget date: ${budgetDay()} · ${budget.dayOffset||0} day${budget.dayOffset===1?'':'s'} advanced`;}
if(advanceButton)advanceButton.addEventListener('click',()=>{const msg=document.querySelector('#advance-message');if(save({...budget,dayOffset:(budget.dayOffset||0)+1},msg))renderAll();});
function renderAll(){renderHome();renderSettings();renderTransactions();renderIntervalSetting();refreshTransferForm();renderSimulation();showStorageWarning();}
renderAll();window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){budget=load();renderAll();}});document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderAll();});if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(error=>console.warn('Offline mode unavailable:',error)));
