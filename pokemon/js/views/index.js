import { renderQuiz } from './quiz.js';
import { renderStudy } from './study.js';
import { renderTeams } from './teams.js';
import { renderTeamDetail } from './teamDetail.js';
import { renderProgress } from './progress.js';
import { renderSettings } from './settings.js';
import { renderDebug } from './debug.js';

export const VIEWS = Object.freeze({
  quiz: renderQuiz,
  study: renderStudy,
  teams: renderTeams,
  team: renderTeamDetail,
  progress: renderProgress,
  settings: renderSettings,
  debug: renderDebug
});
