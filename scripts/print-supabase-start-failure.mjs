// Print only bounded startup diagnostics from the disposable stack, never keys.
import { readFileSync } from 'node:fs';
const text=readFileSync(process.argv[2],'utf8')
 .replace(/\beyJ[A-Za-z0-9_.-]+/g,'[REDACTED_JWT]')
 .replace(/\b(?:sb_(?:secret|publishable)_|re_)[A-Za-z0-9_-]+/g,'[REDACTED_KEY]')
 .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/g,'$1[REDACTED]@');
console.error(text.split(/\r?\n/).slice(-65).join('\n'));
