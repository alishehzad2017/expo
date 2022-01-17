import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { isUrl } from '../utils/url';

export function resolveTemplateOption(template: string) {
  if (isUrl(template)) {
    return template;
  }
  const templatePath = path.resolve(template);
  assert(fs.existsSync(templatePath), 'template file does not exist: ' + templatePath);
  assert(
    fs.statSync(templatePath).isFile(),
    'template must be a tar file created by running `npm pack` in a project: ' + templatePath
  );

  return templatePath;
}
