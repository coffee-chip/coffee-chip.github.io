import { VIEWS as BASE_VIEWS } from '../views.js';
import { renderStudy } from './study.js';
import { renderSettings } from './settings.js';

export const VIEWS = {
  ...BASE_VIEWS,
  study: renderStudy,
  settings: renderSettings
};
