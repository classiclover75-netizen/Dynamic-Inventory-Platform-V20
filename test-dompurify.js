import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const dirty = '<span style="font-size: 13pt; font-family: Arial; font-weight: bold; color: rgb(0, 0, 205);" data-sheets-root="1">Blu-ray</span>';
console.log(purify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'br', 'span', 'mark'],
      ALLOWED_ATTR: ['class', 'style'],
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    }));
