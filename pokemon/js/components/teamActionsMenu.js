import { clearRivalry, deleteTeam, getRival, getTeams, renameTeam, setRivalry, setTeamOpponent } from '../data/teamRepository.js';
import { createOverflowMenuButton, setOverflowMenuExpanded } from './overflowMenuButton.js';

function el(tag,o={}){const n=document.createElement(tag);if(o.className)n.className=o.className;if(o.text)n.textContent=o.text;return n;}
function closeMenu(host){host.querySelector('.team-actions-menu')?.remove();setOverflowMenuExpanded(host.querySelector('.team-actions-button'),false);}
function createRenamePanel(team,host,render){const panel=el('form',{className:'team-actions-panel'}),input=document.createElement('input'),actions=el('div',{className:'team-actions-inline-buttons'}),cancel=el('button',{className:'secondary-button',text:'Cancel'}),save=el('button',{className:'primary-button',text:'Save'});input.type='text';input.maxLength=60;input.value=team.title;input.setAttribute('aria-label',`Rename ${team.title}`);cancel.type='button';save.type='submit';cancel.addEventListener('click',()=>closeMenu(host));panel.addEventListener('submit',event=>{event.preventDefault();if(!renameTeam(team.id,input.value)){input.focus();return;}render();});actions.append(cancel,save);panel.append(input,actions);return panel;}
function focusRenameInput(panel){const input=panel.querySelector('input');if(!input)return;input.focus();const end=input.value.length;input.setSelectionRange(end,end);}
function applyOpponentVisual(host,isOpponent){if(host.classList.contains('team-card'))host.classList.toggle('team-card-opponent',isOpponent);const localTitle=host.querySelector('.team-detail-title');if(localTitle)localTitle.classList.toggle('team-detail-title-opponent',isOpponent);if(host.classList.contains('team-page-actions'))document.querySelector('#page-title')?.classList.toggle('team-detail-title-opponent',isOpponent);}
function createDeletePanel(team,host,render,onDelete){const panel=el('div',{className:'team-actions-panel'}),actions=el('div',{className:'team-actions-inline-buttons'}),cancel=el('button',{className:'secondary-button',text:'Cancel'}),confirm=el('button',{className:'danger-button',text:'Delete'});panel.append(el('span',{text:`Delete “${team.title}”?`}));cancel.type=confirm.type='button';cancel.addEventListener('click',()=>closeMenu(host));confirm.addEventListener('click',()=>{if(!deleteTeam(team.id))return;if(onDelete)onDelete();else render();});actions.append(cancel,confirm);panel.append(actions);return panel;}
function createRivalPanel(team,host,render){
  const panel=el('div',{className:'team-actions-panel'}),currentRival=getRival(team.id),back=el('button',{className:'secondary-button team-actions-item',text:'Back'});back.type='button';back.addEventListener('click',()=>openMenu(team,host,render));
  panel.append(el('strong',{text:currentRival?'Change rival':'Choose rival'}));
  const candidates=getTeams().filter(candidate=>candidate.id!==team.id).sort((a,b)=>Number(a.isOpponent===team.isOpponent)-Number(b.isOpponent===team.isOpponent));
  if(!candidates.length) panel.append(el('span',{className:'muted',text:'No other teams available.'}));
  for(const candidate of candidates){const button=el('button',{className:candidate.id===currentRival?.id?'primary-button team-actions-item':'secondary-button team-actions-item',text:candidate.title});button.type='button';button.addEventListener('click',()=>{if(setRivalry(team.id,candidate.id))render();});panel.append(button);}
  if(currentRival){const remove=el('button',{className:'danger-button team-actions-item',text:'Remove rivalry'});remove.type='button';remove.addEventListener('click',()=>{if(clearRivalry(team.id))render();});panel.append(remove);}
  panel.append(back);return panel;
}
function openMenu(team,host,render,onDelete){
  closeMenu(host);
  const menu=el('div',{className:'team-actions-menu'});menu.setAttribute('role','dialog');menu.setAttribute('aria-label',`Actions for ${team.title}`);
  const rename=el('button',{className:'secondary-button team-actions-item',text:'Rename'});rename.type='button';rename.addEventListener('click',()=>{const panel=createRenamePanel(team,host,render);menu.replaceChildren(panel);focusRenameInput(panel);});
  const rival=el('button',{className:'secondary-button team-actions-item',text:getRival(team.id)?`Rival: ${getRival(team.id).title}`:'Rival'});rival.type='button';rival.addEventListener('click',()=>menu.replaceChildren(createRivalPanel(team,host,render)));
  const opponent=el('label',{className:'toggle-field team-actions-opponent'}),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=team.isOpponent===true;checkbox.addEventListener('change',()=>{if(setTeamOpponent(team.id,checkbox.checked)){applyOpponentVisual(host,checkbox.checked);setTimeout(()=>render(),180);}});opponent.append(checkbox,el('span',{text:'Opponent'}));
  const remove=el('button',{className:'danger-button team-actions-item',text:'Delete'});remove.type='button';remove.addEventListener('click',()=>menu.replaceChildren(createDeletePanel(team,host,render,onDelete)));
  menu.append(rename,rival,opponent,remove);host.append(menu);
}
export function createTeamActionsButton(team,host,render,options={}){return createOverflowMenuButton({className:'team-actions-button',ariaLabel:`More actions for ${team.title}`,isOpen:()=>Boolean(host.querySelector('.team-actions-menu')),open:()=>openMenu(team,host,render,options.onDelete),close:()=>closeMenu(host)});}
