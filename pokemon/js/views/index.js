import { VIEWS as BASE_VIEWS } from '../views.js';
import { renderQuiz } from './quiz.js';
import { renderStudy } from './study.js';
import { renderSettings } from './settings.js';

export const VIEWS = {
  ...BASE_VIEWS,
  quiz: renderQuiz,
  study: renderStudy,
  settings: renderSettings
};
