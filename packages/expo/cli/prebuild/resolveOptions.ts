import { ModPlatform } from '@expo/config-plugins';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { CommandError } from '../utils/errors';
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

export function resolveSkipDependencyUpdate(value: any) {
  if (!value || typeof value !== 'string') {
    return [];
  }
  return value.split(',');
}

export function resolvePlatformOption(
  platform: string = 'all',
  { loose }: { loose?: boolean } = {}
): ModPlatform[] {
  switch (platform) {
    case 'ios':
      return ['ios'];
    case 'android':
      return ['android'];
    case 'all':
      if (loose || process.platform !== 'win32') {
        return ['android', 'ios'];
      }
      return ['android'];
    default:
      throw new CommandError(`Unsupported platform "${platform}". Options are: ios, android, all`);
  }
}
