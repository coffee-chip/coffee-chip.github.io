import { VIEWS as BASE_VIEWS } from '../views.js';
import { renderQuiz } from './quiz.js';
import { renderStudy } from './study.js';
import { renderProgress } from './progress.js';
import { renderSettings } from './settings.js';
import { renderDebug } from './debug.js';

export const VIEWS = {
  ...BASE_VIEWS,
  quiz: renderQuiz,
  study: renderStudy,
  progress: renderProgress,
  settings: renderSettings,
  debug: renderDebug
};
