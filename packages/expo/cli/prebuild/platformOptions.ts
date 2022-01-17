import { ModPlatform } from '@expo/config-plugins';
import chalk from 'chalk';

import * as Log from '../log';
import { CommandError } from '../utils/errors';

export function ensureValidPlatforms(platforms: ModPlatform[]): ModPlatform[] {
  const isWindows = process.platform === 'win32';
  // Skip ejecting for iOS on Windows
  if (isWindows && platforms.includes('ios')) {
    Log.warn(
      `⚠️  Skipping generating the iOS native project files. Run ${chalk.bold(
        'expo eject'
      )} again from macOS or Linux to generate the iOS project.`
    );
    Log.log();
    return platforms.filter((platform) => platform !== 'ios');
  }
  return platforms;
}

export function assertPlatforms(platforms: ModPlatform[]) {
  if (!platforms?.length) {
    throw new CommandError('At least one platform must be enabled when syncing');
  }
}
