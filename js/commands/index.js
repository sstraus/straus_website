/**
 * Command loader - imports all commands after registry is initialized
 */
import './help.js';
import './clear.js';
import './about.js';
import './blog.js';
import './read.js';
import './skills.js';
import './contact.js';
import './zsh.js';
import { initTheme } from './theme.js';

// Initialize theme on load
initTheme();
